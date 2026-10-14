import uuid
from datetime import datetime, timezone, date
from sqlalchemy import Column, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database.base import Base


class WeightEntry(Base):
    __tablename__ = "weight_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    weight_kg = Column(Float, nullable=False)
    date = Column(Date, nullable=False, index=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="weight_entries")
