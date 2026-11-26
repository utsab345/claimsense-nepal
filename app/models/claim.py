from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    claim_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    policy_id: Mapped[str] = mapped_column(String(32), index=True)
    customer_id: Mapped[str] = mapped_column(String(32), index=True)
    vehicle_age: Mapped[int] = mapped_column(Integer)
    vehicle_type: Mapped[str] = mapped_column(String(32))
    vehicle_value: Mapped[float] = mapped_column(Float)
    policy_age_days: Mapped[int] = mapped_column(Integer)
    incident_type: Mapped[str] = mapped_column(String(32), index=True)
    incident_location: Mapped[str | None] = mapped_column(String(64), nullable=True)
    claim_amount: Mapped[float] = mapped_column(Float)
    premium_amount: Mapped[float] = mapped_column(Float)
    previous_claim_count: Mapped[int] = mapped_column(Integer)
    days_since_policy_start: Mapped[int] = mapped_column(Integer)
    incident_hour: Mapped[int] = mapped_column(Integer)
    repair_cost: Mapped[float] = mapped_column(Float)
    supporting_documents_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claim_status: Mapped[str] = mapped_column(String(24), index=True)
    claim_date: Mapped[date] = mapped_column(Date, index=True)
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_priority: Mapped[str | None] = mapped_column(String(16), nullable=True, index=True)
    is_anomaly: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    risk_indicators: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
