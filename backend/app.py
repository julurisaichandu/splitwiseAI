# main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from splitwise import Splitwise
from splitwise.expense import Expense, ExpenseUser
import google.generativeai as genai
# import os
import json
import PIL.Image
from io import BytesIO
# from dotenv import load_dotenv

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
# load_dotenv()

# Models
class ApiKeys(BaseModel):
    SPLITWISE_CONSUMER_KEY: str
    SPLITWISE_SECRET_KEY: str
    SPLITWISE_API_KEY: str
    GEMINI_API_KEY: str

class ItemMember(BaseModel):
    member_name: str
    selected: bool

class Item(BaseModel):
    name: str
    price: float
    split_price: float
    members: Dict[str, bool]

class ExpenseRequest(BaseModel):
    splits: Dict[str, float]
    paid_user: str
    total_amt: float
    group_id: str
    description: str
    comment: str

@app.get("/")
def greet_json():
    return {"Hello": "World!"}

@app.post("/api/initialize")
async def initialize_apis(api_keys: ApiKeys):
    try:
        # Initialize Splitwise
        sObj = Splitwise(
            api_keys.SPLITWISE_CONSUMER_KEY,
            api_keys.SPLITWISE_SECRET_KEY,
            api_key=api_keys.SPLITWISE_API_KEY
        )
        
        # Test connection by getting current user
        user = sObj.getCurrentUser()
        
        # Initialize Gemini
        genai.configure(api_key=api_keys.GEMINI_API_KEY)
        
        return {"status": "success", "user": user.first_name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Initialization failed: {str(e)}")

@app.get("/api/members")
async def get_members(consumer_key: str, secret_key: str, api_key: str):
    try:
        sObj = Splitwise(consumer_key, secret_key, api_key=api_key)
        user = sObj.getCurrentUser()
        friends = sObj.getFriends()
        
        mem_to_id = {}
        mem_to_id[user.first_name] = user.id
        
        for friend in friends:
            mem_to_id[friend.first_name] = friend.id
            
        return {"members": list(mem_to_id.keys()), "mem_to_id": mem_to_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get members: {str(e)}")

@app.get("/api/groups")
async def get_groups(consumer_key: str, secret_key: str, api_key: str):
    try:
        sObj = Splitwise(consumer_key, secret_key, api_key=api_key)
        groups = sObj.getGroups()
        
        groups_to_ids = {}
        for group in groups:
            groups_to_ids[group.name] = group.id
            
        return {"groups": groups_to_ids}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get groups: {str(e)}")

@app.post("/api/analyze-bills")
async def analyze_bills(
    files: List[UploadFile] = File(...),
    gemini_key: str = Form(...)
):
    try:
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        images = []
        for file in files:
            contents = await file.read()
            img = PIL.Image.open(BytesIO(contents))
            images.append(img)
        
        prompt = """Extract only item names (max 5 chars) and prices from these bills. 
        Format as JSON array like: [{"name": "item", "price": 10.00}]. 
        Include only items with clear prices."""
        
        response = model.generate_content([prompt, *images])
        
        if not response.text.strip():
            raise HTTPException(status_code=400, detail="Empty response from AI model")
        
        # Clean the response text
        cleaned_text = response.text.strip('`json\n')
        cleaned_text = cleaned_text.replace('\\n', '')
        
        # Parse JSON
        items_json = json.loads(cleaned_text)
        
        return {"items": items_json}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to analyze bills: {str(e)}")

@app.post("/api/create-expense")
async def create_expense(expense_req: ExpenseRequest, consumer_key: str, secret_key: str, api_key: str):
    try:
        sObj = Splitwise(consumer_key, secret_key, api_key=api_key)
        print(expense_req)
        # Get member IDs
        user = sObj.getCurrentUser()
        friends = sObj.getFriends()
        
        mem_to_id = {}
        mem_to_id[user.first_name] = user.id
        for friend in friends:
            mem_to_id[friend.first_name] = friend.id
        
        # Get group IDs
        groups = sObj.getGroups()
        groups_to_ids = {}
        for group in groups:
            groups_to_ids[group.name] = group.id
        
        # Round amounts
        total_amt = round(expense_req.total_amt, 2)
        splits = {member: round(amount, 2) for member, amount in expense_req.splits.items()}
        
        # Calculate rounding difference
        splits_sum = sum(splits.values())
        rounding_difference = total_amt - splits_sum
        
        if expense_req.paid_user in splits:
            splits[expense_req.paid_user] = round(splits[expense_req.paid_user] + rounding_difference, 2)
        
        # Create expense
        expense = Expense()
        expense.setCost(str(total_amt))
        expense.setDescription(expense_req.description)
        expense.setGroupId(groups_to_ids[expense_req.group_id])
        expense.setDetails(expense_req.comment)
        
        # Create payer
        payer = ExpenseUser()
        payer.setId(mem_to_id[expense_req.paid_user])
        payer.setPaidShare(str(total_amt))
        
        # Set owed share for payer
        if expense_req.paid_user in splits:
            payer.setOwedShare(str(splits[expense_req.paid_user]))
        else:
            payer.setOwedShare('0')
        
        # Add payer to users list
        users = [payer]
        
        # Add debtors
        for member, amount in splits.items():
            if amount == 0 or member == expense_req.paid_user:
                continue
            
            debtor = ExpenseUser()
            debtor.setId(mem_to_id[member])
            debtor.setPaidShare('0')
            debtor.setOwedShare(str(amount))
            users.append(debtor)
        
        # Set users and create expense
        expense.setUsers(users)
        expense_res, errors = sObj.createExpense(expense)
        
        if errors:
            raise HTTPException(status_code=400, detail=f"Error creating expense: {errors}")
        
        return {"status": "success", "expense": expense_res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create expense: {str(e)}")
