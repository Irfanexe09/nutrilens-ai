from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., json_schema_extra={"example": "healthy"})
    app: str = Field(..., json_schema_extra={"example": "NutriLens"})
    version: str = Field(..., json_schema_extra={"example": "0.2.0"})
    environment: str = Field("development", json_schema_extra={"example": "production"})
    database: str = Field(..., json_schema_extra={"example": "connected"})
    database_latency_ms: Optional[float] = Field(None, json_schema_extra={"example": 1.45})
    storage: str = Field("ready", json_schema_extra={"example": "ready"})
    ai_provider: str = Field(..., json_schema_extra={"example": "gemini"})
    timestamp: datetime
