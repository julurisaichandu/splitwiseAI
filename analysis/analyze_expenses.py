#!/usr/bin/env python3
"""
Analyze extracted Splitwise expense data.

Usage:
    python analyze_expenses.py              # Full summary
    python analyze_expenses.py --top-items 20  # Top 20 most expensive items
"""

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd


DATA_DIR = Path(__file__).resolve().parent / "data"
RAW_JSON = DATA_DIR / "expenses_raw.json"


def load_data():
    """Load expenses from JSON file."""
    if not RAW_JSON.exists():
        print(f"Error: {RAW_JSON} not found. Run extract_expenses.py first.")
        raise SystemExit(1)

    with open(RAW_JSON) as f:
        data = json.load(f)
    print(f"Loaded {len(data)} expenses from {RAW_JSON.name}\n")
    return data


def build_dataframes(data):
    """Build expense-level and item-level DataFrames."""
    expenses_df = pd.DataFrame([
        {
            "expense_id": e["expense_id"],
            "description": e["description"],
            "cost": e["cost"],
            "date": e["date"],
            "payer": e.get("payer"),
            "num_users": e.get("num_users", 0),
            "num_items": e.get("num_items", 0),
            "group_id": e.get("group_id"),
        }
        for e in data
    ])
    expenses_df["date"] = pd.to_datetime(expenses_df["date"])
    expenses_df["month"] = expenses_df["date"].dt.to_period("M")

    items = []
    for e in data:
        if not e.get("item_data"):
            continue
        for item in e["item_data"]:
            name = item.get("name", item.get("item_name", ""))
            price = float(item.get("price", item.get("item_price", 0)))
            members_dict = item.get("members", {})
            if isinstance(members_dict, dict):
                selected = [m for m, s in members_dict.items() if s]
            elif isinstance(members_dict, list):
                selected = members_dict
            else:
                selected = []
            per_member = price / len(selected) if selected else 0

            items.append({
                "expense_id": e["expense_id"],
                "expense_date": e["date"],
                "item_name": name,
                "item_price": price,
                "num_members": len(selected),
                "members": selected,
                "per_member_cost": round(per_member, 2),
            })

    items_df = pd.DataFrame(items)
    if not items_df.empty:
        items_df["expense_date"] = pd.to_datetime(items_df["expense_date"])

    return expenses_df, items_df


def print_summary(expenses_df):
    """Print overall summary statistics."""
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total expenses:      {len(expenses_df)}")
    print(f"Total spend:         ${expenses_df['cost'].sum():,.2f}")
    print(f"Average expense:     ${expenses_df['cost'].mean():,.2f}")
    print(f"Median expense:      ${expenses_df['cost'].median():,.2f}")
    print(f"Max expense:         ${expenses_df['cost'].max():,.2f}")
    print(f"Date range:          {expenses_df['date'].min().date()} → {expenses_df['date'].max().date()}")
    print(f"Total items tracked: {expenses_df['num_items'].sum()}")
    print()


def print_spending_by_member(data):
    """Print total amount owed per member across all expenses."""
    member_totals = defaultdict(float)
    for e in data:
        for member, amount in e.get("splits", {}).items():
            member_totals[member] += amount

    print("=" * 60)
    print("SPENDING BY MEMBER (total owed)")
    print("=" * 60)
    sorted_members = sorted(member_totals.items(), key=lambda x: x[1], reverse=True)
    for member, total in sorted_members:
        print(f"  {member:<25} ${total:>10,.2f}")
    print()


def print_payer_stats(expenses_df):
    """Print who paid for expenses most often."""
    payer_counts = expenses_df["payer"].value_counts()
    payer_totals = expenses_df.groupby("payer")["cost"].sum()

    print("=" * 60)
    print("PAYER STATS (who paid)")
    print("=" * 60)
    for payer in payer_counts.index:
        print(f"  {payer:<25} {payer_counts[payer]:>3} expenses  ${payer_totals[payer]:>10,.2f}")
    print()


def print_top_items(items_df, n=15):
    """Print top most expensive items."""
    if items_df.empty:
        print("No item data available.\n")
        return

    print("=" * 60)
    print(f"TOP {n} MOST EXPENSIVE ITEMS")
    print("=" * 60)
    top = items_df.nlargest(n, "item_price")
    for _, row in top.iterrows():
        print(f"  ${row['item_price']:>8.2f}  {row['item_name']}")
    print()


def print_monthly_trends(expenses_df):
    """Print monthly spending trends."""
    monthly = expenses_df.groupby("month").agg(
        count=("expense_id", "count"),
        total=("cost", "sum"),
        avg=("cost", "mean"),
    )

    print("=" * 60)
    print("MONTHLY SPENDING TRENDS")
    print("=" * 60)
    print(f"  {'Month':<12} {'Count':>6} {'Total':>12} {'Average':>12}")
    print(f"  {'-'*12} {'-'*6} {'-'*12} {'-'*12}")
    for month, row in monthly.iterrows():
        print(f"  {str(month):<12} {int(row['count']):>6} ${row['total']:>10,.2f} ${row['avg']:>10,.2f}")
    print()


def print_item_frequency(items_df, n=20):
    """Print most frequently ordered items."""
    if items_df.empty:
        print("No item data available.\n")
        return

    freq = items_df["item_name"].value_counts().head(n)
    print("=" * 60)
    print(f"TOP {n} MOST FREQUENT ITEMS")
    print("=" * 60)
    for name, count in freq.items():
        avg_price = items_df[items_df["item_name"] == name]["item_price"].mean()
        print(f"  {count:>3}x  {name:<40} avg ${avg_price:>.2f}")
    print()


def print_member_item_frequency(items_df, n=10):
    """Print per-member item frequency."""
    if items_df.empty:
        print("No item data available.\n")
        return

    member_items = defaultdict(list)
    for _, row in items_df.iterrows():
        for member in row["members"]:
            member_items[member].append(row["item_name"])

    print("=" * 60)
    print(f"PER-MEMBER TOP {n} ITEMS")
    print("=" * 60)
    for member in sorted(member_items.keys()):
        counter = Counter(member_items[member])
        top = counter.most_common(n)
        print(f"\n  {member}:")
        for item, count in top:
            print(f"    {count:>3}x  {item}")
    print()


def main():
    parser = argparse.ArgumentParser(description="Analyze extracted Splitwise expenses")
    parser.add_argument("--top-items", type=int, default=15, help="Number of top items to show")
    args = parser.parse_args()

    data = load_data()
    expenses_df, items_df = build_dataframes(data)

    print_summary(expenses_df)
    print_spending_by_member(data)
    print_payer_stats(expenses_df)
    print_monthly_trends(expenses_df)
    print_top_items(items_df, n=args.top_items)
    print_item_frequency(items_df)
    print_member_item_frequency(items_df)


if __name__ == "__main__":
    main()
