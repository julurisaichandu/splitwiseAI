# main.py
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from splitwise import Splitwise
from splitwise.expense import Expense, ExpenseUser
from google import genai
from google.genai import types
import json
import PIL.Image
from io import BytesIO
from pathlib import Path
from dotenv import load_dotenv
from rapidfuzz import fuzz

from datetime import datetime
# from database.connection import connect_to_mongo, close_mongo_connection
# from models.database import SplitData, MemberMapping
import json as json_lib

# Load environment variables
load_dotenv()



app = FastAPI()
# command to run server in port 8001 # uvicorn main:app --reload --port 8001

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

# Global member preferences for auto-split
member_preferences: dict = {}
# Raw item name → canonical name mapping for fuzzy pre-pass
item_name_mapping: dict = {}

ALWAYS_SHARED_KEYWORDS = ["tax", "service fee", "delivery fee", "tip", "bag fee", "discount", "fees", "tax & fees"]

# Models


@app.on_event("startup")
async def startup_event():
    global member_preferences, item_name_mapping
    # await connect_to_mongo()

    # Load member preferences
    prefs_path = Path(__file__).resolve().parent / "data" / "member_preferences.json"
    if prefs_path.exists():
        with open(prefs_path) as f:
            member_preferences = json.load(f)
        print(f"Loaded member preferences: {len(member_preferences)} items")
    else:
        print(f"Warning: member_preferences.json not found at {prefs_path}")

    # Load item name mapping for fuzzy matching pre-pass
    mapping_path = Path(__file__).resolve().parent.parent / "analysis" / "data" / "item_name_mapping.json"
    if mapping_path.exists():
        with open(mapping_path) as f:
            item_name_mapping = json.load(f)
        print(f"Loaded item name mapping: {len(item_name_mapping)} entries")
    else:
        print(f"Warning: item_name_mapping.json not found at {mapping_path}")

@app.on_event("shutdown")
async def shutdown_event():
    # await close_mongo_connection()
    pass


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
        client = genai.Client(api_key=gemini_key)

        # Read image bytes
        images_bytes = []
        for file in files:
            contents = await file.read()
            images_bytes.append(contents)

        # Prompt for extraction
        prompt = """Extract items and prices from this receipt. Return JSON array.

Rules:
- Abbreviate item names to 10 chars max
- Include price as number
- Format: [{"name": "item", "price": 10.00}]

Items in image:"""

        # Define JSON schema for structured output
        item_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "name": types.Schema(type=types.Type.STRING),
                "price": types.Schema(type=types.Type.NUMBER),
            },
            required=["name", "price"]
        )

        response_schema = types.Schema(
            type=types.Type.ARRAY,
            items=item_schema
        )

        # Build content parts
        content_parts = [types.Part.from_text(text=prompt)]
        for img_bytes in images_bytes:
            content_parts.append(types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"))

        # Call Gemini with structured output
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=content_parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.1
            )
        )

        # Parse JSON directly (structured output guarantees valid JSON)
        items_json = json.loads(response.text)

        # Add empty members array to each item
        for item in items_json:
            item["members"] = []

        # Calculate subtotal from items
        calculated_subtotal = sum(item["price"] for item in items_json)

        # Return unified format (matching PDF output)
        return {
            "items": items_json,
            "metadata": {
                "store": None,
                "delivery_date": None,
                "delivery_time": None,
                "subtotal": round(calculated_subtotal, 2),
                "fees": {
                    "bag_fee": 0,
                    "bag_fee_tax": 0,
                    "service_fee": 0,
                    "delivery_discount": 0,
                },
                "total": round(calculated_subtotal, 2),
                "validation_passed": True,
                "calculated_subtotal": round(calculated_subtotal, 2)
            }
        }
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON from response: {response.text}")
        return {"items": [], "metadata": None}
    except Exception as e:
        print(f"Error details: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to analyze bills: {str(e)}")


@app.post("/api/analyze-pdf")
async def analyze_pdf(
    file: UploadFile = File(...),
    gemini_key: str = Form(...)
):
    """Parse Instacart receipt PDF and extract items with metadata."""
    try:
        client = genai.Client(api_key=gemini_key)

        # Read PDF bytes
        pdf_bytes = await file.read()

        prompt = """Extract ALL data from this Instacart receipt PDF.

Instructions:
1. Extract store_name (e.g. "ALDI")
2. Extract delivery_date and delivery_time from the header
3. Extract EVERY item with FULL product name including size/weight in parentheses
4. For each item: name, quantity (as number), unit_price, final_price
5. Mark refunded items (in ADJUSTMENTS section) with is_refunded=true
6. Extract totals: items_subtotal, checkout_bag_fee, bag_fee_tax, service_fee, delivery_discount, total
7. For items on sale, use the DISCOUNTED price (the lower green price) as final_price

CRITICAL: Prices must match the PDF exactly. The sum of all non-refunded item final_prices should equal items_subtotal."""

        # Define schema for structured output
        item_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "name": types.Schema(type=types.Type.STRING, description="Full product name with size e.g. 'Season's Choice Shelled Edamame, Bag (16 oz)'"),
                "quantity": types.Schema(type=types.Type.NUMBER, description="Quantity e.g. 1, 2, 5.0"),
                "unit_price": types.Schema(type=types.Type.NUMBER, description="Price per unit e.g. 2.75"),
                "final_price": types.Schema(type=types.Type.NUMBER, description="Total price for this line item"),
                "is_refunded": types.Schema(type=types.Type.BOOLEAN, description="True if in ADJUSTMENTS/NOT CHARGED section"),
            },
            required=["name", "quantity", "unit_price", "final_price", "is_refunded"]
        )

        totals_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "items_subtotal": types.Schema(type=types.Type.NUMBER, description="Items Subtotal from ORDER TOTALS section e.g. 50.84"),
                "checkout_bag_fee": types.Schema(type=types.Type.NUMBER, description="Checkout Bag Fee if present e.g. 0.36"),
                "bag_fee_tax": types.Schema(type=types.Type.NUMBER, description="Checkout Bag Fee Tax if present e.g. 0.02"),
                "service_fee": types.Schema(type=types.Type.NUMBER, description="Service Fee if present e.g. 2.96"),
                "delivery_discount": types.Schema(type=types.Type.NUMBER, description="Scheduled delivery discount as positive number e.g. 2.00 even if shown as -$2.00"),
                "total": types.Schema(type=types.Type.NUMBER, description="Final Total from ORDER TOTALS section e.g. 52.18"),
            },
            required=["items_subtotal", "total"]
        )

        receipt_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "store_name": types.Schema(type=types.Type.STRING),
                "delivery_date": types.Schema(type=types.Type.STRING, description="e.g. January 19th, 2026"),
                "delivery_time": types.Schema(type=types.Type.STRING, description="e.g. 6:17 PM"),
                "items": types.Schema(type=types.Type.ARRAY, items=item_schema),
                "totals": totals_schema,
            },
            required=["store_name", "delivery_date", "delivery_time", "items", "totals"]
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
                types.Part.from_text(text=prompt)
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=receipt_schema,
                temperature=0.0
            )
        )

        receipt = json.loads(response.text)

        # Validate: sum of non-refunded items should equal subtotal
        calculated_subtotal = sum(
            item["final_price"] for item in receipt["items"]
            if not item.get("is_refunded", False)
        )
        expected_subtotal = receipt["totals"]["items_subtotal"]
        validation_passed = abs(calculated_subtotal - expected_subtotal) < 0.01

        # Transform to frontend format (exclude refunded items)
        items = []
        for item in receipt["items"]:
            if not item.get("is_refunded", False):
                items.append({
                    "name": item["name"],
                    "price": item["final_price"],
                    "members": []
                })

        return {
            "items": items,
            "metadata": {
                "store": receipt["store_name"],
                "delivery_date": receipt["delivery_date"],
                "delivery_time": receipt["delivery_time"],
                "subtotal": receipt["totals"]["items_subtotal"],
                "fees": {
                    "bag_fee": receipt["totals"].get("checkout_bag_fee", 0),
                    "bag_fee_tax": receipt["totals"].get("bag_fee_tax", 0),
                    "service_fee": receipt["totals"].get("service_fee", 0),
                    "delivery_discount": receipt["totals"].get("delivery_discount", 0),
                },
                "total": receipt["totals"]["total"],
                "validation_passed": validation_passed,
                "calculated_subtotal": round(calculated_subtotal, 2)
            }
        }
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON from Gemini response")
        raise HTTPException(status_code=400, detail="Failed to parse PDF response as JSON")
    except Exception as e:
        print(f"Error parsing PDF: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")


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
        
        # if item_data:
        #     # Save to MongoDB
        #     split_doc = SplitData(
        #         splitwise_id=str(expense_id),
        #         group_id=str(groups_to_ids[expense_req.group_id]),
        #         group_name=expense_req.group_id,
        #         description=expense_req.description,
        #         total_amount=float(expense_req.total_amt),
        #         paid_by=expense_req.paid_user,
        #         created_by=user.first_name,
        #         items=item_data,
        #         member_splits=expense_req.splits,
        #         created_at=datetime.utcnow(),
        #         updated_at=datetime.utcnow()
        #     )
        #     await split_doc.insert()
        #     print(f"Saved split data to MongoDB with ID: {split_doc.id}")



        # expense.setId(3774471460)
        # expense_res, errors = sObj.updateExpense(expense)

        if errors:
            raise HTTPException(status_code=400, detail=f"Error creating expense: {errors}")
        
        return {"status": "success", "expense": update_result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create expense: {str(e)}")


# --- Auto-Split Models and Endpoint ---

class AutoSplitItem(BaseModel):
    name: str
    price: float

class AutoSplitRequest(BaseModel):
    items: List[AutoSplitItem]
    members: List[str]
    gemini_key: Optional[str] = None

class AutoSplitResultItem(BaseModel):
    name: str
    price: float
    members: List[str]
    confidence: str  # "high", "medium", "low", "unmatched", "shared"
    matched_canonical: Optional[str] = None

class AutoSplitResponse(BaseModel):
    items: List[AutoSplitResultItem]
    auto_assigned: int
    shared: int
    unmatched: int


def _is_shared_item(name: str) -> bool:
    """Check if an item name matches shared/fee keywords."""
    lower = name.lower().strip()
    for kw in ALWAYS_SHARED_KEYWORDS:
        if kw in lower:
            return True
    return False


def _fuzzy_match_item(name: str, mapping: dict, threshold: int = 50) -> str | None:
    """Try to match a receipt item name to a canonical name using fuzzy matching.

    Uses the same token_sort_ratio algorithm as normalize_app.py.
    Returns the canonical name if best score >= threshold, else None.
    """
    lower_name = name.lower().strip()
    best_score = 0
    best_canonical = None

    for raw_name, canonical in mapping.items():
        if canonical == "__SHARED__":
            continue
        score = fuzz.token_sort_ratio(lower_name, raw_name.lower().strip())
        if score > best_score:
            best_score = score
            best_canonical = canonical

    if best_score >= threshold:
        return best_canonical
    return None


def _build_compact_preferences(preferences: dict, active_members: List[str], top_n: int = 5) -> str:
    """Build a compact string of preferences for the Gemini prompt.

    Items where all active members have purchased are marked as ALL
    to reduce prompt size and signal universal assignment.
    """
    num_active = len(active_members)
    lines = []
    for canonical, data in preferences.items():
        if canonical == "__SHARED__":
            continue
        item_members = data["members"]
        # Count how many of the active members appear in this item's history
        active_buyers = sum(1 for m in active_members if m in item_members)

        if num_active > 1 and active_buyers == num_active:
            # All active members have bought this — mark as ALL
            lines.append(f"- {canonical}: ALL [{data['total_appearances']}x]")
        else:
            top_members = list(item_members.items())[:top_n]
            members_str = ", ".join(f"{m}({c})" for m, c in top_members)
            lines.append(f"- {canonical}: {members_str} [{data['total_appearances']}x]")
    return "\n".join(lines)


async def _gemini_auto_assign(
    items: List[dict],
    members: List[str],
    preferences: dict,
    gemini_key: str,
) -> List[dict]:
    """Use Gemini to match receipt items to canonical names and assign members."""
    compact_prefs = _build_compact_preferences(preferences, members)

    items_list = "\n".join(f"- {item['name']} (${item['price']:.2f})" for item in items)

    # Build member-count-aware instructions
    all_members_str = ", ".join(members)
    num_members = len(members)

    if num_members > 7:
        member_rule = (
            "- If historical data shows 'ALL', assign ALL available members.\n"
            "- For items that are clearly common/shared groceries (staples, produce, household), assign ALL available members.\n"
            "- Only assign a subset when the item is clearly personal (snacks, specific dietary items, etc.)."
        )
    else:
        member_rule = (
            "- If historical data shows 'ALL', assign ALL available members.\n"
            "- Otherwise assign members who appear in more than 30% of that product's purchase history."
        )

    prompt = f"""You are matching receipt items to known product names from historical grocery data.

RECEIPT ITEMS TO MATCH:
{items_list}

AVAILABLE MEMBERS ({num_members}): {all_members_str}

HISTORICAL PRODUCT DATA (canonical_name: member(times_bought) or ALL [total_purchases]):
{compact_prefs}

TASK:
For each receipt item, find the closest matching canonical product name from the historical data.
Consider abbreviations, typos, brand names, size variations, and truncated names.
Then assign members based on these rules:
{member_rule}

For each item return:
- "name": the original receipt item name
- "matched_canonical": the matched canonical product name, or null if no match
- "members": list of member names to assign (from AVAILABLE MEMBERS only)
- "confidence": "high" if exact/very close match, "medium" if reasonable match, "low" if uncertain, "unmatched" if no match found

If you cannot match an item, return empty members list and confidence "unmatched"."""

    # Schema for structured output
    result_schema = types.Schema(
        type=types.Type.ARRAY,
        items=types.Schema(
            type=types.Type.OBJECT,
            properties={
                "name": types.Schema(type=types.Type.STRING),
                "matched_canonical": types.Schema(type=types.Type.STRING, nullable=True),
                "members": types.Schema(
                    type=types.Type.ARRAY,
                    items=types.Schema(type=types.Type.STRING),
                ),
                "confidence": types.Schema(type=types.Type.STRING),
            },
            required=["name", "matched_canonical", "members", "confidence"],
        ),
    )

    client = genai.Client(api_key=gemini_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[types.Part.from_text(text=prompt)],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=result_schema,
            temperature=0.1,
        ),
    )

    return json.loads(response.text)


@app.post("/api/auto-split")
async def auto_split(request: AutoSplitRequest):
    """Auto-assign members to items based on historical preferences."""
    try:
        results: List[AutoSplitResultItem] = []
        non_shared_items = []
        auto_assigned = 0
        shared_count = 0
        unmatched_count = 0

        # Step 1: Handle shared items
        for item in request.items:
            if _is_shared_item(item.name):
                results.append(AutoSplitResultItem(
                    name=item.name,
                    price=item.price,
                    members=request.members,  # All members
                    confidence="shared",
                    matched_canonical="__SHARED__",
                ))
                shared_count += 1
            else:
                non_shared_items.append({"name": item.name, "price": item.price})

        # Step 2: Fuzzy matching pre-pass using item_name_mapping
        gemini_items = []
        if non_shared_items and member_preferences and item_name_mapping:
            for item in non_shared_items:
                canonical = _fuzzy_match_item(item["name"], item_name_mapping)
                if canonical and canonical in member_preferences:
                    # Look up members from preferences
                    pref_data = member_preferences[canonical]
                    item_members = pref_data.get("members", {})
                    active_buyers = [m for m in request.members if m in item_members]

                    if len(active_buyers) == len(request.members) and len(request.members) > 1:
                        assigned = list(request.members)
                    else:
                        # Assign members who bought >30% of the time
                        total = pref_data.get("total_appearances", 1)
                        assigned = [
                            m for m in active_buyers
                            if item_members[m] / total > 0.3
                        ]

                    if assigned:
                        results.append(AutoSplitResultItem(
                            name=item["name"],
                            price=item["price"],
                            members=assigned,
                            confidence="fuzzy_match",
                            matched_canonical=canonical,
                        ))
                        auto_assigned += 1
                    else:
                        gemini_items.append(item)
                else:
                    gemini_items.append(item)
        else:
            gemini_items = non_shared_items

        # Step 3: Use Gemini for remaining unmatched items
        if gemini_items and member_preferences:
            gemini_key = request.gemini_key
            if not gemini_key:
                # No Gemini key — return items unassigned
                for item in gemini_items:
                    results.append(AutoSplitResultItem(
                        name=item["name"],
                        price=item["price"],
                        members=[],
                        confidence="unmatched",
                    ))
                    unmatched_count += 1
            else:
                try:
                    gemini_results = await _gemini_auto_assign(
                        gemini_items, request.members, member_preferences, gemini_key
                    )

                    for gr in gemini_results:
                        # Filter members to only include those in the request
                        valid_members = [m for m in gr.get("members", []) if m in request.members]
                        confidence = gr.get("confidence", "unmatched")

                        results.append(AutoSplitResultItem(
                            name=gr["name"],
                            price=next((i["price"] for i in gemini_items if i["name"] == gr["name"]), 0),
                            members=valid_members,
                            confidence=confidence,
                            matched_canonical=gr.get("matched_canonical"),
                        ))

                        if confidence in ("high", "medium", "low") and valid_members:
                            auto_assigned += 1
                        else:
                            unmatched_count += 1

                except Exception as e:
                    print(f"Gemini auto-assign failed: {e}")
                    # Fallback: return items unassigned
                    for item in gemini_items:
                        results.append(AutoSplitResultItem(
                            name=item["name"],
                            price=item["price"],
                            members=[],
                            confidence="unmatched",
                        ))
                        unmatched_count += 1
        elif gemini_items:
            # No preferences loaded — return items unassigned
            for item in gemini_items:
                results.append(AutoSplitResultItem(
                    name=item["name"],
                    price=item["price"],
                    members=[],
                    confidence="unmatched",
                ))
                unmatched_count += 1

        return AutoSplitResponse(
            items=results,
            auto_assigned=auto_assigned,
            shared=shared_count,
            unmatched=unmatched_count,
        )

    except Exception as e:
        print(f"Auto-split error: {e}")
        raise HTTPException(status_code=400, detail=f"Auto-split failed: {str(e)}")


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
