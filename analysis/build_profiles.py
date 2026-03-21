#!/usr/bin/env python3
"""
Build member preference profiles from normalized item data.

Reads items_flat.csv + item_name_mapping.json, aggregates member frequency
per canonical item, and outputs member_preferences.json.

Usage:
    python analysis/build_profiles.py
"""

import json
import shutil
from collections import defaultdict
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_PATH = DATA_DIR / "items_flat.csv"
MAPPING_PATH = DATA_DIR / "item_name_mapping.json"
OUTPUT_PATH = DATA_DIR / "member_preferences.json"
BACKEND_DATA_DIR = Path(__file__).resolve().parent.parent / "backend" / "data"
BACKEND_OUTPUT = BACKEND_DATA_DIR / "member_preferences.json"


def main():
    # Load data
    if not CSV_PATH.exists():
        print(f"Error: {CSV_PATH} not found. Run extract_expenses.py first.")
        return

    if not MAPPING_PATH.exists():
        print(f"Error: {MAPPING_PATH} not found. Run the Streamlit normalize_app.py first.")
        return

    df = pd.read_csv(CSV_PATH)
    with open(MAPPING_PATH) as f:
        name_mapping = json.load(f)

    print(f"Loaded {len(df)} item rows, {len(name_mapping)} name mappings")

    # Build expanded rows: one row per (canonical_name, original_row)
    # Handles comma-separated canonical names for combined items (e.g. "paneer, onions")
    expanded_rows = []
    for _, row in df.iterrows():
        raw_name = row["item_name"]
        mapped = name_mapping.get(raw_name)

        if mapped is None:
            # Fallback: use lowercased raw name
            canonicals = [raw_name.lower().strip()]
        elif mapped == "__SHARED__":
            canonicals = ["__SHARED__"]
        elif "," in mapped:
            # Combined item — split into multiple canonical names
            canonicals = [c.strip() for c in mapped.split(",") if c.strip()]
        else:
            canonicals = [mapped]

        for canon in canonicals:
            expanded_rows.append({
                "canonical_name": canon,
                "item_price": row["item_price"],
                "members": row["members"],
            })

    df_expanded = pd.DataFrame(expanded_rows)
    print(f"Expanded to {len(df_expanded)} rows ({len(df)} original, {len(df_expanded) - len(df)} from splits)")

    # Build preference profiles
    preferences = {}

    for canonical, group in df_expanded.groupby("canonical_name"):
        # Count member frequency
        member_counts = defaultdict(int)
        for members_str in group["members"]:
            if pd.isna(members_str):
                continue
            for member in str(members_str).split("|"):
                member = member.strip()
                if member:
                    member_counts[member] += 1

        preferences[canonical] = {
            "members": dict(sorted(member_counts.items(), key=lambda x: -x[1])),
            "total_appearances": len(group),
            "avg_price": round(group["item_price"].mean(), 2),
        }

    # Sort by total appearances
    preferences = dict(sorted(preferences.items(), key=lambda x: -x[1]["total_appearances"]))

    print(f"\nBuilt preferences for {len(preferences)} canonical items")
    print(f"Top 10 most frequent items:")
    for name, data in list(preferences.items())[:10]:
        members_str = ", ".join(f"{m}:{c}" for m, c in list(data["members"].items())[:3])
        print(f"  {data['total_appearances']:3d}x  {name:<30s}  ({members_str})")

    # Save to analysis/data/
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(preferences, f, indent=2)
    print(f"\nSaved preferences to {OUTPUT_PATH}")

    # Copy to backend/data/
    BACKEND_DATA_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUTPUT_PATH, BACKEND_OUTPUT)
    print(f"Copied to {BACKEND_OUTPUT}")


if __name__ == "__main__":
    main()
