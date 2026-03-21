import sys
import os

# Add parent dir to path so we can import the FastAPI app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
