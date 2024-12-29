import math
import streamlit as st
import pandas as pd
from splitwise import Splitwise
from splitwise.expense import Expense, ExpenseUser


# Display API Key Input Section
st.sidebar.header("API Keys")

# Initialize session state for API keys if not already present
if 'api_keys_initialized' not in st.session_state:
    st.session_state.api_keys_initialized = False
    st.session_state.api_keys = {
        "SPLITWISE_CONSUMER_KEY": "",
        "SPLITWISE_SECRET_KEY": "",
        "SPLITWISE_API_KEY": ""
    }

# Handle API key inputs
for key_name in st.session_state.api_keys.keys():
    # Only show input field if key is not set:
    api_key_input = st.sidebar.text_input(
        f"Enter your {key_name}:",
        key=f"input_{key_name}",
        value=st.session_state.api_keys[key_name],
        type="password"
    )
 # Update session state if new value is entered
    if api_key_input != st.session_state.api_keys[key_name]:
        st.session_state.api_keys[key_name] = api_key_input
        if api_key_input:
            st.sidebar.success(f"{key_name} saved!")

# Reset button for API keys
if st.sidebar.button("Reset API Keys"):
    for key_name in st.session_state.api_keys:
        st.session_state.api_keys[key_name] = ""
    st.sidebar.warning("API keys have been reset. Please enter new keys.")
    st.rerun()

# load_dotenv()

# execute app only if all keys are present
if not all(st.session_state.api_keys.values()):
    st.warning("Please enter all API keys to proceed.")
    st.stop()
    st.error("Please enter all API keys to proceed.")


# Initialize Splitwise object using API keys from session_state
consumer_key = st.session_state.api_keys.get("SPLITWISE_CONSUMER_KEY")
secret_key = st.session_state.api_keys.get("SPLITWISE_SECRET_KEY")
splitwise_api_key = st.session_state.api_keys.get("SPLITWISE_API_KEY")


# Initialize Splitwise object
# load_dotenv()
# consumer_key = os.getenv("SPLITWISE_CONSUMER_KEY")
# secret_key = os.getenv("SPLITWISE_SECRET_KEY")
# splitwise_api_key = os.getenv("SPLITWISE_API_KEY")
sObj = Splitwise(consumer_key, secret_key, api_key=splitwise_api_key)
user = sObj.getCurrentUser()

###### Adding friends to the dictionary
friends = sObj.getFriends()
mem_to_id = {}
mem_to_id[user.first_name] = user.id
for i in range(len(friends)):
    mem_to_id[friends[i].first_name] = friends[i].id


# Application Title
st.title("Itemized Bill Splitter")

# Input for Members
st.header("Step 1: Add Members")

st.write("Members:")
members_list = list(mem_to_id.keys())

# Function to generate chip-style HTML
def generate_chips(members):
    chips_html = ""
    for member in members:
        chips_html += f'''
        <span style="display: inline-block; background-color: #e0e0e0; border-radius: 15px; padding: 5px 10px; margin: 5px; font-size: 14px; color: #333;">
            {member}
        </span>
        '''
    return chips_html

# Display the chips
st.markdown(generate_chips(members_list), unsafe_allow_html=True)

st.write(f"Members: {members_list}")

groups = sObj.getGroups()
groups_obj = {} 
for i in range(len(groups)):
    groups_obj[groups[i].name] = groups[i].id


# Group selection
group_id = st.selectbox("Select the group to add expense", options=list(groups_obj.keys()), index=0)


paid_user = st.selectbox("Select the User who paid full amount for transaction", options=list(mem_to_id.keys()), index=0)
st.write(f"Paid User: {paid_user}")
if not members_list:
    st.warning("Please add at least one member to proceed.")
    st.stop()

# Initialize session state for items
if "items" not in st.session_state:
    st.session_state["items"] = []
    # Initialize with two default items
    for i in range(2):
        st.session_state["items"].append({
            "name": f"Item {i+1}",
            "price": 0.0,
            "split_price": 0.0,
            "members": {member: False for member in members_list}
        })

# Function to handle checkbox changes
def handle_checkbox(item_idx, member_name):
    items = st.session_state["items"]
    items[item_idx]["members"][member_name] = not items[item_idx]["members"][member_name]
    st.session_state["items"] = items

# Editable Item List
st.header("Step 2: Edit Items and Assign Members")
for idx, item in enumerate(st.session_state["items"]):
    cols = st.columns([3, 2, 2, 3])
    
    # Item Name
    new_name = cols[0].text_input(f"Item Name {idx+1}", value=item["name"], key=f"name_{idx}")
    st.session_state["items"][idx]["name"] = new_name
    
    # Full Price
    price_input = cols[1].text_input(f"Full Price {idx+1} (e.g., 20 + 5 or 15*2)", value=str(item["price"]), key=f"price_{idx}")
    
    try:
        new_price = eval(price_input, {"__builtins__": None}, {"math": math})
        st.session_state["items"][idx]["price"] = new_price
    except:
        st.session_state["items"][idx]["price"] = 0.0
        st.warning(f"Invalid expression in price for Item {idx+1}. Setting it to 0.")

    # Member Selection with Checkboxes
    with cols[3].expander("Select Members"):
        for member in members_list:
            is_selected = st.session_state["items"][idx]["members"][member]
            st.checkbox(
                member,
                value=is_selected,
                key=f"checkbox_{idx}_{member}",
                on_change=handle_checkbox,
                args=(idx, member)
            )

    # Split Price calculation
    selected_members = [member for member, selected in st.session_state["items"][idx]["members"].items() if selected]
    split_price = st.session_state["items"][idx]["price"] / max(1, len(selected_members))
    st.session_state["items"][idx]["split_price"] = split_price
    cols[2].write(f"Split Price: ${split_price:.2f}")

# Add item button
if st.button("Add Item"):
    st.session_state["items"].append({
        "name": f"Item {len(st.session_state['items'])+1}",
        "price": 0.0,
        "split_price": 0.0,
        "members": {member: False for member in members_list}
    })
    st.rerun()

# Function to create expenses in Splitwise
def update_expenses(splits, paid_user, total_amt, mem_to_id, group_id):
    try:
        # Initialize the expense object
        expense = Expense()
        expense.setCost(str(total_amt))
        expense.setDescription("Test Bill Split")
        expense.setGroupId(group_id)

        # Create the payer object
        payer = ExpenseUser()
        payer.setId(mem_to_id[paid_user])
        payer.setPaidShare(str(total_amt))
        payer.setOwedShare('0')

        # Check if the paid user owes any amount
        if paid_user in splits:
            payer.setOwedShare(str(splits[paid_user]))
        else:
            payer.setOwedShare('0')

        # Add the payer to the list of users
        users = [payer]

        # Create debtor objects and add them to the users list
        for member, amount in splits.items():
            if amount == 0 or member == paid_user:
                continue  # Skip the paid user if they are already handled
            
            debtor = ExpenseUser()
            debtor.setId(mem_to_id[member])
            debtor.setPaidShare('0')
            debtor.setOwedShare(str(amount))
            users.append(debtor)

        # Add all users to the expense
        expense.setUsers(users)

        # Create the expense in Splitwise
        expense_res, errors = sObj.createExpense(expense)
        st.write(expense_res)
        # Handle errors
        if errors:
            st.error(f"Error creating the expense: {errors}")
        else:
            st.success(f"Expense created successfully: ${total_amt:.2f}")

    except KeyError as e:
        st.error(f"Error: {e}. Ensure all members are in the mem_to_id mapping.")
    except Exception as e:
        st.error(f"Unexpected error: {e}")

# Calculate Splits
st.header("Step 3: Calculate Final Splits")
if st.button("Calculate Splits"):
    splits = {member: 0 for member in members_list}
    splits_per_item = {member: "" for member in members_list}  # Track splits per item as a string
    total_bill = 0
    for item in st.session_state["items"]:
        selected_members = [member for member, selected in item["members"].items() if selected]
        split_price = item["price"] / max(1, len(selected_members))
        total_bill += item["price"]
        for member in selected_members:
            splits[member] += split_price
            splits_per_item[member] += f"{item["name"]}=${split_price:.2f}, "  # Append each item's split as a string


    # Prepare final data for table
    final_data = []
    for member, total_split in splits.items():
        # Remove trailing comma and space from the string
        item_splits = splits_per_item[member].strip(", ")
        final_data.append([member, item_splits, f"${total_split:.2f}"])

    # Display the final table
    columns = ["Member", "Item Splits", "Total Split ($)"]
    df = pd.DataFrame(final_data, columns=columns)
    st.subheader("Final Splits")
    st.table(df)


    # add splits to splitwise
    ########################################
    ##### create expense obj ###############
    ########################################
    update_expenses(splits=splits, \
                    paid_user=paid_user, \
                    total_amt=total_bill, \
                        mem_to_id=mem_to_id, \
                            group_id = group_id)


# Reset Button
if st.button("Reset All"):
    st.session_state["items"] = []
    for i in range(2):
        st.session_state["items"].append({
            "name": f"Item {i+1}",
            "price": 0.0,
            "split_price": 0.0,
            "members": {member: False for member in members_list}
        })
    st.rerun()