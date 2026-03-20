from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class DisruptionPayload(BaseModel):
    city: str
    type: str = Field(..., description="rainfall, aqi, temperature, platform_outage")
    severity: str = Field(..., description="HIGH, EXTREME")
    rainfall: Optional[float] = 0.0
    aqi: Optional[int] = 0
    temperature: Optional[float] = 0.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ManualClaimPayload(BaseModel):
    worker_id: str
    disruption_type: str
    time_window: str
    gps_location: dict
    calculated_loss: float
    timestamp: datetime = Field(default_factory=datetime.utcnow)
