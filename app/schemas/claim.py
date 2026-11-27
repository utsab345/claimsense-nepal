from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ClaimStatus = Literal["Open", "Under Review", "Approved", "Rejected", "Paid"]
ReviewPriority = Literal["Low", "Medium", "High"]


class ClaimCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    claim_id: str = Field(min_length=1, max_length=32, pattern=r"^[A-Za-z0-9-]+$")
    policy_id: str = Field(min_length=1, max_length=32)
    customer_id: str = Field(min_length=1, max_length=32)
    vehicle_age: int = Field(ge=0, le=100)
    vehicle_type: str = Field(min_length=1, max_length=32)
    vehicle_value: float = Field(gt=0)
    policy_age_days: int = Field(ge=1)
    incident_type: str = Field(min_length=1, max_length=32)
    incident_location: str | None = Field(default=None, max_length=64)
    claim_amount: float = Field(gt=0)
    premium_amount: float = Field(gt=0)
    previous_claim_count: int = Field(ge=0)
    days_since_policy_start: int = Field(ge=0)
    incident_hour: int = Field(ge=0, le=23)
    repair_cost: float = Field(gt=0)
    supporting_documents_count: int | None = Field(default=None, ge=0)
    claim_status: ClaimStatus = "Open"
    claim_date: date

    @model_validator(mode="after")
    def validate_policy_timing(self):
        if self.days_since_policy_start > self.policy_age_days:
            raise ValueError("days_since_policy_start cannot exceed policy_age_days")
        return self


class RiskIndicator(BaseModel):
    code: str
    label: str
    explanation: str
    points: int = Field(ge=0)


class ClaimRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    claim_id: str
    policy_id: str
    customer_id: str
    vehicle_age: int
    vehicle_type: str
    vehicle_value: float
    policy_age_days: int
    incident_type: str
    incident_location: str | None
    claim_amount: float
    premium_amount: float
    previous_claim_count: int
    days_since_policy_start: int
    incident_hour: int
    repair_cost: float
    supporting_documents_count: int | None
    claim_status: ClaimStatus
    claim_date: date
    risk_score: float | None
    review_priority: ReviewPriority | None
    is_anomaly: bool | None
    risk_indicators: list[RiskIndicator] | None
    created_at: datetime


class ClaimPage(BaseModel):
    items: list[ClaimRead]
    total: int
    limit: int
    offset: int


class RiskAssessment(BaseModel):
    claim_id: str
    assessed: bool = True
    risk_score: float = Field(ge=0, le=100)
    review_priority: ReviewPriority
    is_anomaly: bool
    risk_indicators: list[RiskIndicator]
    disclaimer: str = "This assessment supports manual review and is not proof of fraud or grounds for automatic rejection."
