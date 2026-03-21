#!/usr/bin/env python3
"""
Extract all itemized expenses from Splitwise that were created by SplitWise AI.

Looks for expenses where the `details` field starts with "EXPENSE_ID:" and
contains "---ITEMDATA---" with JSON item data.

Usage:
    python extract_expenses.py                  # Extract all expenses
    python extract_expenses.py --group-id 123   # Filter by group
    python extract_expenses.py --list-groups    # List available groups
    python extract_expenses.py --with-comments  # Also fetch comments (slower)
"""

import argparse
import json
import csv
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
from splitwise import Splitwise


# Load credentials from frontend/.env
FRONTEND_ENV = Path(__file__).resolve().parent.parent / "frontend" / ".env"
load_dotenv(FRONTEND_ENV)

CONSUMER_KEY = os.getenv("NEXT_PUBLIC_SPLITWISE_CONSUMER_KEY")
CONSUMER_SECRET = os.getenv("NEXT_PUBLIC_SPLITWISE_SECRET_KEY")
API_KEY = os.getenv("NEXT_PUBLIC_SPLITWISE_API_KEY")

DATA_DIR = Path(__file__).resolve().parent / "data"


def get_splitwise():
    """Initialize and return authenticated Splitwise instance."""
    if not all([CONSUMER_KEY, CONSUMER_SECRET, API_KEY]):
        print("Error: Missing Splitwise credentials in frontend/.env")
        print("Required: NEXT_PUBLIC_SPLITWISE_CONSUMER_KEY, NEXT_PUBLIC_SPLITWISE_SECRET_KEY, NEXT_PUBLIC_SPLITWISE_API_KEY")
        sys.exit(1)

    sObj = Splitwise(CONSUMER_KEY, CONSUMER_SECRET, api_key=API_KEY)
    user = sObj.getCurrentUser()
    print(f"Authenticated as: {user.getFirstName()} {user.getLastName()}")
    return sObj


def parse_expense_comment(comment: str):
    """Parse the JSON data from Splitwise expense details.

    Replicates backend/app.py:616 logic.
    """
    try:
        if "---ITEMDATA---" in comment:
            parts = comment.split("---ITEMDATA---")
            if len(parts) > 1:
                json_data = parts[1].strip()
                return json.loads(json_data)
    except Exception as e:
        print(f"  Warning: Error parsing item data: {e}")
    return None


def parse_expense_id(details: str):
    """Extract the EXPENSE_ID value from details field."""
    if not details:
        return None
    for line in details.split("\n"):
        line = line.strip()
        if line.startswith("EXPENSE_ID:"):
            return line.split("EXPENSE_ID:")[1].strip()
    return None


def fetch_all_expenses(sObj, group_id=None):
    """Paginate through ALL Splitwise expenses."""
    all_expenses = []
    offset = 0
    limit = 50

    while True:
        kwargs = {"offset": offset, "limit": limit}
        if group_id:
            kwargs["group_id"] = group_id

        print(f"  Fetching expenses offset={offset}...", end="", flush=True)
        expenses = sObj.getExpenses(**kwargs)
        print(f" got {len(expenses)}")

        if not expenses:
            break

        all_expenses.extend(expenses)
        offset += limit

    return all_expenses


def extract_expense_data(expense, sObj=None, fetch_comments=False):
    """Extract structured data from a single Splitwise expense."""
    details = expense.getDetails() or ""
    expense_id = str(expense.getId())

    # Parse the stored EXPENSE_ID and item data
    stored_id = parse_expense_id(details)
    item_data = parse_expense_comment(details)

    # Extract user splits
    users = expense.getUsers()
    payer = None
    splits = {}
    for u in users:
        name = f"{u.getFirstName()} {u.getLastName() or ''}".strip()
        paid = float(u.getPaidShare() or 0)
        owed = float(u.getOwedShare() or 0)
        if paid > 0:
            payer = name
        if owed > 0:
            splits[name] = owed

    data = {
        "expense_id": expense_id,
        "stored_expense_id": stored_id,
        "description": expense.getDescription(),
        "cost": float(expense.getCost() or 0),
        "date": expense.getDate(),
        "created_at": expense.getCreatedAt(),
        "group_id": str(expense.getGroupId()) if expense.getGroupId() else None,
        "payer": payer,
        "splits": splits,
        "num_users": len(splits),
        "item_data": item_data,
        "num_items": len(item_data) if item_data else 0,
        "raw_details": details,
    }

    # Optionally fetch comments
    if fetch_comments and sObj:
        try:
            time.sleep(0.5)  # Rate limit
            comments = sObj.getComments(expense_id)
            data["comments"] = [
                {
                    "user": f"{c.getUser().getFirstName() if c.getUser() else 'Unknown'}",
                    "content": c.getContent(),
                    "created_at": c.getCreatedAt(),
                }
                for c in comments
            ]
        except Exception as e:
            print(f"  Warning: Could not fetch comments for {expense_id}: {e}")
            data["comments"] = []

    return data


def save_data(expenses_data):
    """Save extracted data to JSON and CSV files."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Full JSON
    json_path = DATA_DIR / "expenses_raw.json"
    with open(json_path, "w") as f:
        json.dump(expenses_data, f, indent=2, default=str)
    print(f"Saved {len(expenses_data)} expenses to {json_path}")

    # 2. Expenses flat CSV
    csv_path = DATA_DIR / "expenses_flat.csv"
    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "expense_id", "stored_expense_id", "description", "cost", "date",
            "created_at", "group_id", "payer", "num_users", "num_items",
            "split_members", "split_amounts",
        ])
        writer.writeheader()
        for exp in expenses_data:
            writer.writerow({
                "expense_id": exp["expense_id"],
                "stored_expense_id": exp.get("stored_expense_id"),
                "description": exp["description"],
                "cost": exp["cost"],
                "date": exp["date"],
                "created_at": exp.get("created_at"),
                "group_id": exp.get("group_id"),
                "payer": exp.get("payer"),
                "num_users": exp.get("num_users", 0),
                "num_items": exp.get("num_items", 0),
                "split_members": "|".join(exp.get("splits", {}).keys()),
                "split_amounts": "|".join(str(v) for v in exp.get("splits", {}).values()),
            })
    print(f"Saved expenses flat CSV to {csv_path}")

    # 3. Items flat CSV
    items_csv_path = DATA_DIR / "items_flat.csv"
    item_rows = []
    for exp in expenses_data:
        if not exp.get("item_data"):
            continue
        for item in exp["item_data"]:
            # Handle both possible item formats
            item_name = item.get("name", item.get("item_name", ""))
            item_price = item.get("price", item.get("item_price", 0))

            # Extract members who are selected for this item
            members_dict = item.get("members", {})
            if isinstance(members_dict, dict):
                selected_members = [m for m, selected in members_dict.items() if selected]
            elif isinstance(members_dict, list):
                selected_members = members_dict
            else:
                selected_members = []

            per_member_cost = float(item_price) / len(selected_members) if selected_members else 0

            item_rows.append({
                "expense_id": exp["expense_id"],
                "expense_description": exp["description"],
                "expense_date": exp["date"],
                "item_name": item_name,
                "item_price": float(item_price),
                "num_members": len(selected_members),
                "members": "|".join(selected_members),
                "per_member_cost": round(per_member_cost, 2),
            })

    with open(items_csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "expense_id", "expense_description", "expense_date",
            "item_name", "item_price", "num_members", "members", "per_member_cost",
        ])
        writer.writeheader()
        writer.writerows(item_rows)
    print(f"Saved {len(item_rows)} item rows to {items_csv_path}")


def list_groups(sObj):
    """List all available Splitwise groups."""
    groups = sObj.getGroups()
    print(f"\n{'ID':<15} {'Name':<40} {'Members'}")
    print("-" * 70)
    for g in groups:
        members = [m.getFirstName() for m in g.getMembers()]
        print(f"{g.getId():<15} {g.getName():<40} {', '.join(members)}")


def main():
    parser = argparse.ArgumentParser(description="Extract Splitwise expenses created by SplitWise AI")
    parser.add_argument("--group-id", type=int, help="Filter by Splitwise group ID")
    parser.add_argument("--list-groups", action="store_true", help="List available groups and exit")
    parser.add_argument("--with-comments", action="store_true", help="Also fetch comments (slower due to rate limits)")
    args = parser.parse_args()

    sObj = get_splitwise()

    if args.list_groups:
        list_groups(sObj)
        return

    # Fetch all expenses
    print("\nFetching expenses from Splitwise...")
    all_expenses = fetch_all_expenses(sObj, group_id=args.group_id)
    print(f"Total expenses fetched: {len(all_expenses)}")

    # Filter for SplitWise AI expenses (have EXPENSE_ID in details)
    print("\nFiltering for SplitWise AI itemized expenses...")
    extracted = []
    skipped_payments = 0
    skipped_deleted = 0
    skipped_no_id = 0

    for exp in all_expenses:
        # Skip payments
        if exp.getPayment():
            skipped_payments += 1
            continue

        # Skip deleted
        if exp.getDeletedAt():
            skipped_deleted += 1
            continue

        details = exp.getDetails() or ""
        if not details.startswith("EXPENSE_ID:"):
            skipped_no_id += 1
            continue

        print(f"  Extracting: {exp.getDescription()} (${exp.getCost()})")
        data = extract_expense_data(exp, sObj=sObj, fetch_comments=args.with_comments)
        extracted.append(data)

    print(f"\nExtraction complete:")
    print(f"  Itemized expenses found: {len(extracted)}")
    print(f"  Skipped (payments): {skipped_payments}")
    print(f"  Skipped (deleted): {skipped_deleted}")
    print(f"  Skipped (no EXPENSE_ID): {skipped_no_id}")

    if extracted:
        print("\nSaving data...")
        save_data(extracted)
        print("\nDone! Files saved to analysis/data/")
    else:
        print("\nNo itemized expenses found. Nothing to save.")


if __name__ == "__main__":
    main()
