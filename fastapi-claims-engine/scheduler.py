from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime
import asyncio

def init_scheduler(db):
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        lambda: asyncio.create_task(process_auto_claims(db)),
        'interval',
        minutes=5,
        id='auto_claim_job',
        replace_existing=True
    )
    return scheduler

async def process_auto_claims(db):
    print(f"[{datetime.utcnow()}] Running continuous parametric auto claims engine...")
    
    # Fetch recent unprocessed disruptions
    recent_disruptions = await db.disruptions.find({"processed": {"$ne": True}}).to_list(100)
    for disruption in recent_disruptions:
        city = disruption.get("city")
        disruption_type = disruption.get("type")
        
        # 1. Identify active workers in the affected zone who are actively delivering
        cursor = db.users.find({
            "location.city": city,
            "currentOrder.status": "active"
        })
        
        async for user in cursor:
            # 2. Verify Active Policy
            policy = await db.policies.find_one({"userId": user["_id"], "status": "active"})
            if not policy:
                continue
                
            # 3. Detect Income Loss
            # Simulated formula based on prompt: (avg - actual) * earnings
            weekly_income = user.get("weeklyIncome", 3000)
            avg_daily_income = weekly_income / 6
            calculated_loss = round(avg_daily_income * 0.5, 2) # Simulate 50% loss for the day
            
            # 4. GPS location check
            current_gps = user.get("currentGps", user.get("location", {}))
            
            # 5. Fraud Detection Layer
            trust_score = user.get("trustScore", 100)
            fraud_score = 0
            if trust_score < 70: fraud_score += 25
            # For brevity in mock: assume GPS matches and non-duplicate
            
            if fraud_score > 50:
                claim_status = "REJECTED"
            else:
                claim_status = "APPROVED"

            # 6. Generate zero-touch claim
            claim = {
                "worker_id": str(user["_id"]),
                "disruption_type": disruption_type,
                "time_window": str(datetime.utcnow().date()),
                "gps_location": current_gps,
                "calculated_loss": calculated_loss,
                "payout_amount": policy.get("coverageAmount", 500) * 0.25,
                "status": claim_status,
                "fraud_score": fraud_score,
                "timestamp": datetime.utcnow()
            }
            await db.claims.insert_one(claim)
            
            print(f"[{datetime.utcnow()}] Auto Claim {claim_status} for Worker {user['_id']} in {city}")
            
            # In a full flow, triggering Razorpay or payout gateway happens here for APPROVED claims.
        
        # Mark disruption as processed
        await db.disruptions.update_one({"_id": disruption["_id"]}, {"$set": {"processed": True}})
