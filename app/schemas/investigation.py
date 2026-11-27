from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


InvestigationStatus = Literal["Open", "Under Review", "Additional Information Required", "Resolved"]


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=2000)
    author: str = Field(default="Analyst", min_length=1, max_length=64)


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: InvestigationStatus
    author: str = Field(default="Analyst", min_length=1, max_length=64)
    note: str | None = Field(default=None, max_length=1000)


class AssignmentUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    assigned_analyst: str | None = Field(default=None, max_length=64)


class NoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author: str
    body: str
    created_at: datetime


class EventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_status: str | None
    to_status: str
    author: str
    detail: str | None
    created_at: datetime


class InvestigationRead(BaseModel):
    claim_id: str
    status: InvestigationStatus
    assigned_analyst: str | None
    opened_at: datetime
    updated_at: datetime
    notes: list[NoteRead]
    events: list[EventRead]


class InvestigationSummary(BaseModel):
    claim_id: str
    status: InvestigationStatus
    assigned_analyst: str | None
    opened_at: datetime
    updated_at: datetime
    risk_score: float | None
    claim_amount: float
    indicator_count: int


class InvestigationPage(BaseModel):
    items: list[InvestigationSummary]
    total: int
    limit: int
    offset: int


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    claim_id: str | None
    action: str
    summary: str
    actor: str
    created_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogRead]
    total: int
    limit: int
    offset: int


class NotificationItem(BaseModel):
    id: str
    title: str
    body: str
    severity: Literal["info", "warning", "critical"]
    read: bool
    claim_ids: list[str] = []


class SettingsRead(BaseModel):
    application: str
    version: str
    database: str
    dataset: str
    dataset_records: int
    currency: str
    risk_thresholds: dict[str, int]
    features: dict[str, bool]
    disclaimer: str
