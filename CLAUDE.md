# SplitWise AI

## Overview
AI-powered bill splitting app that analyzes receipts (images/PDFs) using Google Gemini, creates itemized expenses in Splitwise, and stores data in MongoDB.

**Stack:** FastAPI backend (Python) + Next.js 15 frontend (TypeScript) + MongoDB (Beanie ODM)

## How to Run

```bash
# Backend (port 8001)
cd backend && source venv/bin/activate && uvicorn app:app --port 8001

# Frontend (port 3000)
cd frontend && npm run dev

# Both together
cd frontend && npm run dev:all
```

## Key Endpoints (backend/app.py)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/initialize` | POST | Initialize Splitwise + Gemini API keys |
| `/api/members` | GET | Fetch Splitwise members with name→ID mapping |
| `/api/groups` | GET | Fetch Splitwise groups with name→ID mapping |
| `/api/analyze-bills` | POST | Analyze receipt image via Gemini |
| `/api/analyze-pdf` | POST | Analyze receipt PDF via Gemini |
| `/api/create-expense` | POST | Create expense in Splitwise + save to MongoDB |
| `/api/update-expense` | POST | Update existing Splitwise expense |
| `/api/auto-split` | POST | Auto-assign members to items using historical preferences + Gemini |
| `/api-expense` | GET | Fetch expense details from Splitwise |

## Environment Variables

- **Backend:** `backend/.env` — MONGO_URL, DATABASE_NAME, GEMINI_API_KEY, MEMBERS_LIST
- **Frontend:** `frontend/.env` — NEXT_PUBLIC_SPLITWISE_CONSUMER_KEY, NEXT_PUBLIC_SPLITWISE_SECRET_KEY, NEXT_PUBLIC_SPLITWISE_API_KEY, NEXT_PUBLIC_GEMINI_API_KEY, NEXT_PUBLIC_API_URL

## Database Models (backend/models/database.py)

- **SplitData** — Main collection: splitwise_id, group_id, group_name, description, total_amount, paid_by, items[], member_splits{}
- **PendingUpdate** — Proposed changes awaiting approval
- **MemberMapping** — Email↔Splitwise name mapping

## Important Patterns

### Expense Comment Format
When creating an expense, the `details` field is structured as:
```
EXPENSE_ID:{splitwise_expense_id}
{original_comment}
---ITEMDATA---
[{json array of items with name, price, members}]
```

### Key Functions
- `parse_expense_comment()` at `backend/app.py:616` — Extracts JSON item data from the `---ITEMDATA---` delimiter in expense details
- Expense creation flow at `backend/app.py:346-473` — Creates Splitwise expense, updates details with EXPENSE_ID prefix, saves to MongoDB

## analysis/ Folder
Contains scripts for extracting and analyzing all Splitwise expenses that were created by this app. Extracts item-level data from the `---ITEMDATA---` format stored in expense details.

- `extract_expenses.py` — Fetches all expenses from Splitwise API, parses item data, saves to JSON/CSV
- `analyze_expenses.py` — CLI analysis: spending stats, member breakdowns, trends
- `explore.ipynb` — Interactive Jupyter notebook for visualizations
- `normalize_app.py` — Streamlit app to map raw item names to canonical names using fuzzy clustering
- `build_profiles.py` — Builds member preference profiles from normalized item data
- `data/` — Output directory (gitignored)

## Auto-Split Pipeline

1. **Normalize:** `streamlit run analysis/normalize_app.py` — map raw item names to canonical names, export `item_name_mapping.json`
2. **Build profiles:** `python analysis/build_profiles.py` — generate `member_preferences.json` from normalized data
3. **Backend:** Loads `backend/data/member_preferences.json` at startup, serves `/api/auto-split` endpoint
4. **Frontend:** Calls auto-split after item detection, pre-fills member toggles based on historical preferences
