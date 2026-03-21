#!/usr/bin/env python3
"""
Streamlit app for normalizing item names from historical expense data.

Maps ~590 raw item names to ~250 canonical names using fuzzy clustering.
Exports mapping to analysis/data/item_name_mapping.json.

Usage:
    streamlit run analysis/normalize_app.py

Flow:
    1. Click "Run Clustering" — auto-groups similar names
    2. Review clusters — remove wrong items, apply canonical names
    3. Use the move/merge tool to fix misplaced items
    4. Save when done
"""

import json
from pathlib import Path

import pandas as pd
import streamlit as st
from rapidfuzz import fuzz

DATA_DIR = Path(__file__).resolve().parent / "data"
CSV_PATH = DATA_DIR / "items_flat.csv"
OUTPUT_PATH = DATA_DIR / "item_name_mapping.json"

SHARED_KEYWORDS = [
    "tax", "fees", "fee", "tip", "delivery", "service fee", "bag fee",
    "discount", "tax & fees", "checkout bag", "bag fee tax",
]


def load_items():
    """Load unique item names and their frequency from items_flat.csv."""
    df = pd.read_csv(CSV_PATH)
    counts = df["item_name"].value_counts().reset_index()
    counts.columns = ["item_name", "count"]
    return counts


def cluster_names(names, threshold):
    """Cluster item names using token_sort_ratio fuzzy matching."""
    lowered = [n.lower().strip() for n in names]
    visited = set()
    clusters = []

    for i, name_i in enumerate(lowered):
        if i in visited:
            continue
        cluster = [i]
        visited.add(i)
        for j, name_j in enumerate(lowered):
            if j in visited:
                continue
            score = fuzz.token_sort_ratio(name_i, name_j)
            if score >= threshold:
                cluster.append(j)
                visited.add(j)
        clusters.append(cluster)

    return clusters


def auto_detect_shared(name):
    """Check if a name is likely a shared/fee item."""
    lower = name.lower().strip()
    return any(kw in lower for kw in SHARED_KEYWORDS)


def get_clusters():
    """Get the editable clusters dict from session state."""
    if "editable_clusters" not in st.session_state:
        st.session_state.editable_clusters = {}
    return st.session_state.editable_clusters


def main():
    st.set_page_config(page_title="Item Name Normalizer", layout="wide")
    st.title("Item Name Normalizer")

    if not CSV_PATH.exists():
        st.error(f"Data file not found: {CSV_PATH}")
        st.info("Run `python analysis/extract_expenses.py` first to generate items_flat.csv")
        return

    # Load data
    item_counts = load_items()
    counts_dict = dict(zip(item_counts["item_name"], item_counts["count"]))
    unique_names = item_counts["item_name"].tolist()

    # Initialize mapping
    if "mapping" not in st.session_state:
        if OUTPUT_PATH.exists():
            with open(OUTPUT_PATH) as f:
                st.session_state.mapping = json.load(f)
        else:
            st.session_state.mapping = {}

    mapping = st.session_state.mapping
    mapped_count = len([n for n in unique_names if n in mapping])

    # Progress
    st.progress(mapped_count / len(unique_names) if unique_names else 0)
    st.caption(f"{mapped_count} / {len(unique_names)} names mapped")

    # =============================================
    # Step 1: Cluster
    # =============================================
    st.markdown("### Step 1: Cluster similar names")
    st.caption("Groups similar names together. You can then edit clusters before applying.")

    threshold = st.slider("Similarity threshold (higher = stricter)", 50, 100, 75, 5)

    if st.button("Run Clustering", type="primary"):
        with st.spinner("Clustering..."):
            raw_clusters = cluster_names(unique_names, threshold)
            raw_clusters.sort(key=len, reverse=True)

            # Convert to editable format: dict of cluster_id -> list of item names
            editable = {}
            for i, indices in enumerate(raw_clusters):
                items = [unique_names[idx] for idx in indices]
                editable[f"c{i}"] = items
            st.session_state.editable_clusters = editable

    clusters = get_clusters()
    if not clusters:
        st.info("Click 'Run Clustering' to start.")
        st.markdown("---")
        # Still show save if there's an existing mapping
        if mapping:
            _render_save_section(mapping, unique_names, mapped_count)
        return

    # Quick actions
    multi_clusters = {k: v for k, v in clusters.items() if len(v) > 1}
    single_clusters = {k: v for k, v in clusters.items() if len(v) == 1}
    unmapped_singles = [v[0] for v in single_clusters.values() if v[0] not in mapping]
    unmapped_shared = [n for n in unique_names if auto_detect_shared(n) and n not in mapping]

    if unmapped_singles or unmapped_shared:
        st.markdown("#### Quick actions")
        col1, col2 = st.columns(2)
        with col1:
            if unmapped_singles and st.button(f"Auto-map {len(unmapped_singles)} single-name items"):
                for name in unmapped_singles:
                    mapping[name] = "__SHARED__" if auto_detect_shared(name) else name.lower().strip()
                st.rerun()
        with col2:
            if unmapped_shared and st.button(f"Mark {len(unmapped_shared)} fee/tax items as SHARED"):
                for name in unmapped_shared:
                    mapping[name] = "__SHARED__"
                st.rerun()

    # =============================================
    # Step 2: Review & edit clusters
    # =============================================
    st.markdown(f"### Step 2: Review clusters ({len(multi_clusters)} multi-name groups)")
    st.caption(
        "**Remove** items that don't belong (they become their own cluster). "
        "**Apply** sets the canonical name for all items in the cluster."
    )

    for cid, cluster_items in sorted(multi_clusters.items(), key=lambda x: -len(x[1])):
        all_mapped = all(n in mapping for n in cluster_items)
        status = " (done)" if all_mapped else ""

        # Default canonical: most frequent item name
        freq_sorted = sorted(cluster_items, key=lambda n: -counts_dict.get(n, 0))
        default_canonical = freq_sorted[0].lower().strip()
        if cluster_items[0] in mapping and mapping[cluster_items[0]] != "__SHARED__":
            default_canonical = mapping[cluster_items[0]]

        with st.expander(
            f"{freq_sorted[0]} — {len(cluster_items)} variants{status}",
            expanded=not all_mapped,
        ):
            # Select all checkbox
            select_all = st.checkbox("Select all", key=f"selall_{cid}")

            # Checkboxes to select items to REMOVE from this cluster
            items_to_remove = []
            for name in sorted(cluster_items, key=lambda n: -counts_dict.get(n, 0)):
                count = counts_dict.get(name, 0)
                tag = "  [SHARED]" if auto_detect_shared(name) else ""
                check = "  done" if name in mapping else ""
                col_cb, col_label = st.columns([1, 8])
                with col_cb:
                    remove = st.checkbox(
                        "", key=f"rm_{cid}_{name}",
                        value=select_all,
                        label_visibility="collapsed",
                    )
                with col_label:
                    st.text(f"{count:3d}x  {name}{tag}{check}")
                if remove:
                    items_to_remove.append(name)

            # Action row
            col_input, col_apply, col_remove = st.columns([3, 1, 1])

            with col_input:
                canonical = st.text_input(
                    "Canonical name",
                    value=default_canonical,
                    key=f"canon_{cid}",
                    label_visibility="collapsed",
                )

            with col_apply:
                if st.button("Apply", key=f"apply_{cid}", type="primary" if not all_mapped else "secondary"):
                    for name in cluster_items:
                        if auto_detect_shared(name):
                            mapping[name] = "__SHARED__"
                        else:
                            mapping[name] = canonical
                    st.rerun()

            with col_remove:
                if items_to_remove:
                    if st.button(f"Remove {len(items_to_remove)}", key=f"remove_{cid}", type="secondary"):
                        # Pull selected items out into individual clusters
                        remaining = [n for n in cluster_items if n not in items_to_remove]
                        clusters[cid] = remaining
                        for name in items_to_remove:
                            new_id = f"c{len(clusters)}"
                            clusters[new_id] = [name]
                        # Clean up empty clusters
                        if not remaining:
                            del clusters[cid]
                        st.rerun()
                else:
                    st.caption("Check items above to remove them")

    # =============================================
    # Step 2b: Combined items (and/&/+)
    # =============================================
    st.markdown("---")
    st.markdown("### Combined items (and / & / +)")
    st.caption(
        "These items contain multiple products in one name. "
        "Enter comma-separated canonical names to split them "
        "(e.g. `paneer, onions`). They'll each get mapped separately."
    )

    combined_items = []
    for name in unique_names:
        low = name.lower()
        if " and " in low or " & " in low or " + " in low:
            combined_items.append(name)

    if not combined_items:
        st.info("No combined items found.")
    else:
        for name in combined_items:
            count = counts_dict.get(name, 0)
            current = mapping.get(name, "")
            done = name in mapping

            col_label, col_input, col_btn = st.columns([3, 3, 1])
            with col_label:
                tag = "  done" if done else ""
                st.text(f"{count:3d}x  {name}{tag}")
            with col_input:
                split_val = st.text_input(
                    "Canonical (comma-separated to split)",
                    value=current or name.lower().strip(),
                    key=f"split_{name}",
                    label_visibility="collapsed",
                )
            with col_btn:
                if st.button("Apply", key=f"apply_split_{name}"):
                    mapping[name] = split_val.strip()
                    st.rerun()

    # =============================================
    # Step 3: Move / merge items between clusters
    # =============================================
    st.markdown("---")
    st.markdown("### Move items between clusters")
    st.caption(
        "If an item ended up in the wrong cluster, pick it here and move it to the right one. "
        "Or type a new cluster name to create a fresh group."
    )

    # Build a flat list of all items with their current cluster
    all_items_flat = []
    item_to_cluster = {}
    for cid, items in clusters.items():
        for name in items:
            all_items_flat.append(name)
            item_to_cluster[name] = cid

    col_item, col_target, col_go = st.columns([3, 3, 1])

    with col_item:
        item_to_move = st.selectbox(
            "Item to move",
            options=sorted(all_items_flat),
            index=None,
            placeholder="Select an item...",
        )

    # Build target options: show cluster labels (first item name + count)
    cluster_labels = {}
    for cid, items in clusters.items():
        freq_sorted = sorted(items, key=lambda n: -counts_dict.get(n, 0))
        label = f"{freq_sorted[0]} ({len(items)} items)"
        cluster_labels[label] = cid

    with col_target:
        target_options = list(cluster_labels.keys()) + ["-- New cluster --"]
        target_label = st.selectbox(
            "Move to cluster",
            options=target_options,
            index=None,
            placeholder="Select target cluster...",
        )

    with col_go:
        st.markdown("<br>", unsafe_allow_html=True)  # vertical alignment
        move_clicked = st.button("Move", type="primary")

    if move_clicked and item_to_move and target_label:
        # Remove from old cluster
        old_cid = item_to_cluster[item_to_move]
        clusters[old_cid] = [n for n in clusters[old_cid] if n != item_to_move]
        if not clusters[old_cid]:
            del clusters[old_cid]

        # Add to target cluster
        if target_label == "-- New cluster --":
            new_id = f"c{len(clusters) + 100}"
            clusters[new_id] = [item_to_move]
        else:
            target_cid = cluster_labels[target_label]
            clusters[target_cid].append(item_to_move)

        # Clear mapping for moved item so user re-applies
        if item_to_move in mapping:
            del mapping[item_to_move]

        st.success(f"Moved '{item_to_move}'")
        st.rerun()

    # =============================================
    # Step 4: Save
    # =============================================
    st.markdown("---")
    _render_save_section(mapping, unique_names, mapped_count)


def _render_save_section(mapping, unique_names, mapped_count):
    """Render the save/export section."""
    st.markdown("### Save")

    shared_count = len([n for n in unique_names if mapping.get(n) == "__SHARED__"])
    canonical_set = set(v for v in mapping.values() if v != "__SHARED__")
    st.caption(f"{mapped_count} mapped | {shared_count} shared | {len(canonical_set)} canonical names")

    col_save, col_download = st.columns(2)
    with col_save:
        if st.button("Save to item_name_mapping.json", type="primary"):
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with open(OUTPUT_PATH, "w") as f:
                json.dump(mapping, f, indent=2, sort_keys=True)
            st.success(f"Saved {len(mapping)} mappings to {OUTPUT_PATH}")

    with col_download:
        if mapping:
            st.download_button(
                "Download JSON",
                json.dumps(mapping, indent=2, sort_keys=True),
                "item_name_mapping.json",
                "application/json",
            )


if __name__ == "__main__":
    main()
