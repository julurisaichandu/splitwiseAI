#!/bin/bash

# Navigate to frontend and start the frontend server in the background
cd frontend
npm run dev &
FRONTEND_PID=$!

# Navigate to backend and start the backend server
cd ../backend
source ./venv/bin/activate
export PYTHONPATH=$(pwd)
uvicorn app:app

# Optional: Wait for frontend to finish (in case backend exits)
wait $FRONTEND_PID
