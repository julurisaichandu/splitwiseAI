import math
import streamlit as st
import pandas as pd

# Application Title
st.title("Itemized Bill Splitter")

# Input for Members
st.header("Step 1: Add Members")
members = st.text_input("Enter names of people, separated by commas:", "Sai, Pranav, Dheeraj, Vamsi, Satwik, Danush, Tharak, Bharadwaj, Mayank, Puneeth")
members_list = [name.strip() for name in members.split(",") if name.strip()]

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

# Calculate Splits
st.header("Step 3: Calculate Final Splits")
if st.button("Calculate Splits"):
    splits = {member: 0 for member in members_list}
    splits_per_item = {member: "" for member in members_list}  # Track splits per item as a string

    for item in st.session_state["items"]:
        selected_members = [member for member, selected in item["members"].items() if selected]
        split_price = item["price"] / max(1, len(selected_members))

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