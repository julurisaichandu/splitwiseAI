# backend/database/connection.py
import os
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from models.database import SplitData, PendingUpdate, MemberMapping

# MongoDB connection settings
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "splitwise_ai")

class Database:
    client: AsyncIOMotorClient = None
    database = None

# Global database instance
db = Database()

async def connect_to_mongo():
    """Create database connection"""
    print(f"Connecting to MongoDB at {MONGO_URL}")
    db.client = AsyncIOMotorClient(MONGO_URL)
    db.database = db.client[DATABASE_NAME]
    
    # Initialize Beanie with the document models
    await init_beanie(
        database=db.database,
        document_models=[SplitData, PendingUpdate, MemberMapping]
    )
    print("Connected to MongoDB successfully!")

async def close_mongo_connection():
    """Close database connection"""
    if db.client:
        db.client.close()
        print("Disconnected from MongoDB")

async def get_database():
    """Get database instance"""
    return db.database