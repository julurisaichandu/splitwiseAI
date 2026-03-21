# SplitWise AI

AI-powered bill splitting app that analyzes receipts (images/PDFs) using Google Gemini, creates itemized expenses in Splitwise, and stores data in MongoDB.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/julurisaichandu/splitwiseAI.git
cd splitwiseAI
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

Create a `frontend/.env` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:8001
```

### 4. Run the app

```bash
# From the frontend/ directory — starts both backend and frontend
npm run dev:all
```

Or run them separately:

```bash
# Terminal 1: Backend (port 8001)
cd backend && source venv/bin/activate && uvicorn app:app --port 8001

# Terminal 2: Frontend (port 3000)
cd frontend && npm run dev
```

The app will be available at `http://localhost:3000`.

## API Credentials

The app needs **4 API keys** to work. Click the **gear icon** in the top-right corner of the app to enter them — they are saved in your browser's local storage (never committed to code).

### Splitwise (3 keys)

1. Go to [https://secure.splitwise.com/apps](https://secure.splitwise.com/apps) and log in
2. Click **Register your application**
3. Fill in the form:
   - **Application name**: anything (e.g. "My Bill Splitter")
   - **Application description**: anything
   - **Homepage URL**: `http://localhost:3000`
   - **Callback URL**: `http://localhost:3000`
4. After registering, you will see your **Consumer Key** and **Consumer Secret**
5. Click on your app name to find the **API Key**

These map to the settings modal fields:
| Splitwise page | Settings field |
|---|---|
| Consumer Key | Splitwise Consumer Key |
| Consumer Secret | Splitwise Secret Key |
| API Key | Splitwise API Key |

### Gemini (1 key)

1. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) and sign in with Google
2. Click **Create API Key**
3. Select or create a Google Cloud project
4. Copy the key into the **Gemini API Key** field in the settings modal
