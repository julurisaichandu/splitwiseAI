# SplitWise AI

AI-powered bill splitting app that analyzes receipts (images/PDFs) using Google Gemini and creates itemized expenses in Splitwise.

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and **npm**

## Quick Start

```bash
git clone https://github.com/julurisaichandu/splitwiseAI.git
cd splitwiseAI

# Make scripts executable (one-time)
chmod +x setup.sh start.sh

# One-time setup (creates venv, installs all dependencies)
./setup.sh

# Start the app (backend + frontend)
./start.sh
```

Open `http://localhost:3000` and click the gear icon (top-right) to enter your API keys.

## API Credentials

The app needs **4 API keys**. Click the **gear icon** in the top-right corner to enter them — they are saved in your browser's local storage (never committed to code). Each field in the settings modal also has a link to the page where you can get the key.

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
