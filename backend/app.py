# main.py
import re
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from splitwise import Splitwise
from splitwise.expense import Expense, ExpenseUser
import google.generativeai as genai
import json
import PIL.Image
from io import BytesIO
import tempfile
import os
from groq import Groq
from dotenv import load_dotenv

from datetime import datetime
from database.connection import connect_to_mongo, close_mongo_connection
from models.database import SplitData, MemberMapping
import json as json_lib

# Load environment variables
load_dotenv()



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


@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()


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
    groq_key: str = Form(...)
):
    try:
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))  # Use the passed key, not env variable
        
        images_base64 = []
        for file in files:
            contents = await file.read()
            import base64
            img_base64 = base64.b64encode(contents).decode('utf-8')
            images_base64.append(f"data:image/jpeg;base64,{img_base64}")
        
        # Simpler prompt for better results
        prompt = """Extract items and prices from this receipt. Return JSON array.
        
Rules:
- Abbreviate item names to 10 chars max
- Include price as number
- Format: [{"name": "item", "price": 10.00}]

Items in image:"""

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",  # Correct Groq vision model
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        *[{"type": "image_url", "image_url": {"url": img}} for img in images_base64]
                    ]
                }
            ],
            temperature=0.1
            # Remove response_format - Groq doesn't support it
        )
        
        # Extract JSON from response
        response_text = response.choices[0].message.content
        
        # Try to extract JSON from the response
        import re
        json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
        if json_match:
            items_json = json.loads(json_match.group())
        else:
            # Fallback: try to parse the entire response
            items_json = json.loads(response_text)
        
        # For the image you showed, expected output would be:
        # [
        #   {"name": "towel", "price": 17.59},
        #   {"name": "stvia", "price": 4.29},
        #   {"name": "peppr", "price": 2.55},
        #   {"name": "onion", "price": 2.65}
        # ]
        for item in items_json:
            item["members"] = []  # Empty array for members
        return {"items": items_json}
    except json.JSONDecodeError:
        # If JSON parsing fails, return empty array
        print(f"Failed to parse JSON from response: {response_text}")
        return {"items": []}
    except Exception as e:
        print(f"Error details: {str(e)}")
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
        # get expense id
        expense_id = expense_res.getId()
        print("Expense created successfully:", expense_res)
        print("Expense ID:", expense_id)

        # Update the expense with the expense ID in the comment
        if expense_id:
            # Get the original comment
            original_comment = expense.getDetails()
            
            # Add expense ID to the comment, preserving the ITEMDATA section
            updated_comment = f"EXPENSE_ID:{expense_id}\n{original_comment}"
            
            # Create a new expense object for updating
            expense.setId(expense_id)
            expense.setDetails(updated_comment)  # In Splitwise API, "details" is the comment field
            
            # Update the expense
            update_result, update_errors = sObj.updateExpense(expense)
            
            print("new expense id", update_result.getId())
            if update_errors:
                print(f"Warning: Could not update expense comment: {update_errors}")
                return {"status": "warning", "message": "Expense created but comment update failed."}
            else:
                print("Expense comment updated successfully to include expense ID", update_result.getId())

        # After successful Splitwise creation, ADD THIS BLOCK:
        # Parse the item data from comment
        item_data = parse_expense_comment(expense_req.comment)
        
        if item_data:
            # Save to MongoDB
            split_doc = SplitData(
                splitwise_id=str(expense_id),  # expense_id from your existing code
                group_id=str(groups_to_ids[expense_req.group_id]),
                group_name=expense_req.group_id,
                description=expense_req.description,
                total_amount=float(expense_req.total_amt),
                paid_by=expense_req.paid_user,
                created_by=user.first_name,  # Current user
                items=item_data,
                member_splits=expense_req.splits,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            
            # Save to database
            await split_doc.insert()
            print(f"Saved split data to MongoDB with ID: {split_doc.id}")



        # expense.setId(3774471460)
        # expense_res, errors = sObj.updateExpense(expense)

        if errors:
            raise HTTPException(status_code=400, detail=f"Error creating expense: {errors}")
        
        return {"status": "success", "expense": update_result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create expense: {str(e)}")


@app.get("/api/get-expense")
async def get_expense(expense_id: int, consumer_key: str, secret_key: str, api_key: str):
    try:
        sObj = Splitwise(consumer_key, secret_key, api_key=api_key)
        exp_obj = sObj.getExpense(expense_id)

        # get group name from group id
        groups = sObj.getGroups()
        group_name = None
        for group in groups:
            if group.id == exp_obj.getGroupId():
                group_name = group.name
                break
        if group_name is None:
            raise HTTPException(status_code=404, detail="Group not found")
        
        print("get description", exp_obj.getDescription())
        expense_details = {
            "cost": exp_obj.getCost(),
            "description": exp_obj.getDescription(),
            "comment": exp_obj.getDetails(),
            "users": [],
            "group_name":group_name
        }
        
        for user in exp_obj.getUsers():
            expense_details["users"].append({
                "first_name": user.getFirstName(),
                "owed_share": user.getOwedShare(),
                "paid_share": user.getPaidShare(),
                "user_id": user.getId()
            })

        return {"expense": expense_details}
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to get expense: {str(e)}")



class UpdateExpenseRequest(BaseModel):
    expense_id: str
    splits: Dict[str, float]
    paid_user: str
    total_amt: float
    group_id: str
    description: str
    comment: str

@app.post("/api/update-expense")  
async def update_expense(expense_req: UpdateExpenseRequest, consumer_key: str, secret_key: str, api_key: str):
    try:
        sObj = Splitwise(consumer_key, secret_key, api_key=api_key)
        print("Updating expense:", expense_req.expense_id)
        
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
        
        # Create expense object for update
        expense = Expense()
        expense.setId(expense_req.expense_id)
        expense.setCost(str(total_amt))
        expense.setDescription(expense_req.description)
        
        # Check if the comment already has the expense ID, if not add it
        if not expense_req.comment.startswith(f"EXPENSE_ID:{expense_req.expense_id}"):
            updated_comment = f"EXPENSE_ID:{expense_req.expense_id}\n{expense_req.comment}"
            expense.setDetails(updated_comment)
        else:
            expense.setDetails(expense_req.comment)
        
        # Ensure the group ID is properly set
        if expense_req.group_id in groups_to_ids:
            expense.setGroupId(groups_to_ids[expense_req.group_id])
        else:
            # If the group_id is already the ID and not the name
            expense.setGroupId(expense_req.group_id)
        
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
        
        # Set users and update expense
        expense.setUsers(users)
        updated_expense, errors = sObj.updateExpense(expense)
        
        if errors:
            raise HTTPException(status_code=400, detail=f"Error updating expense: {errors}")
        
        return {"status": "success", "expense": updated_expense}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to update expense: {str(e)}")
    


@app.post("/api/process-voice")
async def process_voice(audio: UploadFile = File(...), members: List[str] = Form(None)):
    try:
        # Save the uploaded audio to a temporary file
        temp_dir = tempfile.mkdtemp()
        audio_path = os.path.join(temp_dir, "recording.webm")
        
        with open(audio_path, "wb") as buffer:
            content = await audio.read()
            buffer.write(content)
        
        # Get members list from form data or use default from environment
        if not members:
            members = os.environ.get("MEMBERS_LIST", "").split(',')
        
        # Initialize Groq client
        groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        
        # Step 1: Transcribe audio using Whisper
        with open(audio_path, "rb") as audio_file:
            transcription_response = groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file
            )
        
        transcript = transcription_response.text
        print(f"Transcript: {transcript}")
        
        # Step 2: Create a prompt that emphasizes JSON formatting
        members_list = ", ".join(members)
        prompt = f"""
        You are helping parse a spoken description of a bill to split among people.
        
        The user has dictated which items were purchased and who should pay for them.
        
        Here is the transcript:
        
        {transcript}
        
        IMPORTANT: The ONLY valid member names are: {members_list}
        
        Extract each item purchased, its price, and which members should split it.
        
        STRICTLY FOLLOW THIS FORMAT for your response - a valid JSON array like this:
        
        [
          {{
            "name": "item name",
            "price": price_as_number,
            "members": ["person1", "person2"]
          }},
          {{
            "name": "another item",
            "price": price_as_number,
            "members": ["person1", "person3"]
          }}
        ]
        
        Your response MUST start with '[' and end with ']' to be valid JSON.
        If you can't determine the price, use 0. If you can't determine who splits an item, provide an empty array for members.
        
        Remember: ONLY use member names from this list: {members_list}
        """
        
        # Get the model from environment or use default
        model_name = os.environ.get("GROQ_MODEL", "deepseek-r1-distill-llama-70b")
        print(f"Using model: {model_name}")
        
        # ** KEY CHANGE: Don't use response_format for deepseek models **
        if model_name.startswith("deepseek"):
            llm_response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You parse spoken text into valid JSON arrays following the exact format specified."},
                    {"role": "user", "content": prompt}
                ]
                # No response_format parameter for deepseek
            )
        else:
            llm_response = groq_client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You parse spoken text into valid JSON arrays following the exact format specified."},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"}
            )
        
        # Extract the text from the response
        parsed_items_json = llm_response.choices[0].message.content
        print(f"Raw model response: {parsed_items_json}")
        
        # Process the response to extract items
        items = process_deepseek_response(parsed_items_json)
        
        # Clean up the temporary file
        os.remove(audio_path)
        os.rmdir(temp_dir)
        
        return {
            "transcript": transcript,
            "items": items
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process voice recording: {str(e)}")


def process_deepseek_response(response_text):
    """Process the raw text response from deepseek models."""
    # Try multiple approaches to extract JSON data
    
    # Approach 1: Look for JSON array in the text
    try:
        # Find text between square brackets
        array_match = re.search(r'\[(.*?)\]', response_text, re.DOTALL)
        if array_match:
            array_text = '[' + array_match.group(1) + ']'
            return json.loads(array_text)
    except:
        pass
    
    # Approach 2: Fix common JSON object sequence format
    try:
        # Check if it's a sequence of JSON objects
        if re.search(r'{\s*"name":', response_text) and not response_text.strip().startswith('['):
            # Add brackets around the sequence
            fixed_text = '[' + response_text + ']'
            try:
                return json.loads(fixed_text)
            except:
                # If that fails, try cleaning up the format
                cleaned_text = re.sub(r'},\s*{', '},{', response_text)
                return json.loads('[' + cleaned_text + ']')
    except:
        pass
    
    # Approach 3: Extract individual JSON objects using regex
    try:
        items = []
        pattern = r'{\s*"name":\s*"[^"]*",\s*"price":[^,}]*,\s*"members":\s*\[[^\]]*\]\s*}'
        matches = re.findall(pattern, response_text)
        
        for match in matches:
            try:
                item = json.loads(match)
                items.append(item)
            except:
                pass
        
        if items:
            return items
    except:
        pass
    
    # Approach 4: Last resort, manual extraction
    try:
        items = []
        # Use regex to extract name, price, and members separately
        name_matches = re.findall(r'"name":\s*"([^"]*)"', response_text)
        price_matches = re.findall(r'"price":\s*(\d+(?:\.\d+)?)', response_text)
        members_matches = re.findall(r'"members":\s*\[(.*?)\]', response_text, re.DOTALL)
        
        # Process extracted data
        for i in range(min(len(name_matches), len(price_matches), len(members_matches))):
            name = name_matches[i]
            try:
                price = float(price_matches[i])
            except:
                price = 0
                
            # Extract member names from the members array
            members_text = members_matches[i]
            members = []
            member_matches = re.findall(r'"([^"]*)"', members_text)
            members = [m for m in member_matches]
            
            items.append({
                "name": name,
                "price": price,
                "members": members
            })
        
        return items
    except:
        pass
    
    # If all else fails, return empty list
    return []



# ADD THIS HELPER FUNCTION
def parse_expense_comment(comment: str):
    """Parse the JSON data from Splitwise comment"""
    try:
        if "---ITEMDATA---" in comment:
            # Split and get the JSON part
            parts = comment.split("---ITEMDATA---")
            if len(parts) > 1:
                json_data = parts[1].strip()
                return json_lib.loads(json_data)
    except Exception as e:
        print(f"Error parsing comment JSON: {e}")
    return None
