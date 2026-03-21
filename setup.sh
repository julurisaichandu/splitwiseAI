#!/bin/bash
set -e

echo "=== SplitWise AI Setup ==="
echo ""

# Backend setup
echo "[1/3] Creating Python virtual environment..."
cd backend
python3 -m venv venv
source ./venv/bin/activate
echo "[2/3] Installing backend dependencies..."
pip install -r requirements.txt --quiet
deactivate
cd ..

# Frontend setup
echo "[3/3] Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

# Create frontend .env if missing
if [ ! -f frontend/.env ]; then
  echo "NEXT_PUBLIC_API_URL=http://localhost:8001" > frontend/.env
  echo "Created frontend/.env"
fi

echo ""
echo "=== Setup complete ==="
echo "Run ./start.sh to start the app"
echo "Then open http://localhost:3000 and click the gear icon to enter your API keys"
