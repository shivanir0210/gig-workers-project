from fastapi import FastAPI, BackgroundTasks, HTTPException
from contextlib import asynccontextmanager
from motor.motor_asyncio import AsyncIOMotorClient
import os
from scheduler import init_scheduler
from models import DisruptionPayload, ManualClaimPayload
from database import get_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.mongodb_client = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
    app.mongodb = app.mongodb_client.gigshield
    
    # Init scheduler
    scheduler = init_scheduler(app.mongodb)
    scheduler.start()
    
    yield
    
    # Shutdown
    scheduler.shutdown()
    app.mongodb_client.close()

app = FastAPI(title="GigShield AI Claim Engine", lifespan=lifespan)

@app.post("/simulate-disruption")
async def simulate_disruption(payload: DisruptionPayload):
    """Manually trigger a disruption event for a specific city to force auto-claims testing"""
    db = get_db(app)
    disruption = payload.dict()
    await db.disruptions.insert_one(disruption)
    # Background processing would pick it up normally, but we can return success
    return {"message": "Disruption recorded and will be processed next cycle", "data": disruption}

@app.get("/claims/{worker_id}")
async def get_worker_claims(worker_id: str):
    db = get_db(app)
    claims = await db.claims.find({"worker_id": worker_id}).to_list(length=100)
    for c in claims:
        c["_id"] = str(c["_id"])
    return claims

@app.post("/manual-claim")
async def file_manual_claim(payload: ManualClaimPayload):
    db = get_db(app)
    claim = payload.dict()
    claim["status"] = "PENDING"
    result = await db.claims.insert_one(claim)
    return {"message": "Claim filed", "claim_id": str(result.inserted_id)}

@app.get("/admin/claims")
async def get_all_claims():
    db = get_db(app)
    claims = await db.claims.find().sort("timestamp", -1).limit(50).to_list(length=50)
    for c in claims:
        c["_id"] = str(c["_id"])
    return claims

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
