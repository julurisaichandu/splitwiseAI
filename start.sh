#!/bin/bash

ROOT_DIR="$(dirname "$0")"

# Check if setup has been run
if [ ! -d "$ROOT_DIR/backend/venv" ]; then
  echo "Error: Backend venv not found. Run ./setup.sh first."
  exit 1
fi

if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
  echo "Error: Frontend dependencies not installed. Run ./setup.sh first."
  exit 1
fi

# Start backend
cd "$ROOT_DIR/backend"
source ./venv/bin/activate
export PYTHONPATH=$(pwd)
uvicorn app:app --port 8001 &
BACKEND_PID=$!

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend running on http://localhost:8001 (PID: $BACKEND_PID)"
echo "Frontend running on http://localhost:3000 (PID: $FRONTEND_PID)"
echo "Press Ctrl+C to stop both"

# Stop both on Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
