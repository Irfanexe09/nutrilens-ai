from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., json_schema_extra={"example": "healthy"})
    app: str = Field(..., json_schema_extra={"example": "NutriLens"})
    version: str = Field(..., json_schema_extra={"example": "0.1.0"})
    database: str = Field(..., json_schema_extra={"example": "connected"})
    ai_provider: str = Field(..., json_schema_extra={"example": "placeholder"})
    timestamp: datetime
