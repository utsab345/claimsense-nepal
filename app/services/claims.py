from datetime import date
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Claim
from app.schemas.claim import ClaimCreate, ClaimStatus, ReviewPriority

SortField = Literal["claim_date", "claim_amount", "risk_score"]
SortDirection = Literal["asc", "desc"]


def _filters(
    status: ClaimStatus | None,
    incident_type: str | None,
    risk_level: ReviewPriority | None,
    search: str | None,
    is_anomaly: bool | None,
    from_date: date | None,
    to_date: date | None,
):
    filters = []
    if status:
        filters.append(Claim.claim_status == status)
    if incident_type:
        filters.append(Claim.incident_type == incident_type)
    if risk_level:
        filters.append(Claim.review_priority == risk_level)
    if is_anomaly is not None:
        filters.append(Claim.is_anomaly.is_(is_anomaly))
    if from_date:
        filters.append(Claim.claim_date >= from_date)
    if to_date:
        filters.append(Claim.claim_date <= to_date)
    if search:
        term = f"%{search}%"
        filters.append(or_(Claim.claim_id.ilike(term), Claim.policy_id.ilike(term), Claim.customer_id.ilike(term)))
    return filters


def list_claims(
    session: Session,
    limit: int,
    offset: int,
    status: ClaimStatus | None = None,
    incident_type: str | None = None,
    risk_level: ReviewPriority | None = None,
    search: str | None = None,
    *,
    is_anomaly: bool | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    sort_by: SortField = "claim_date",
    sort_dir: SortDirection = "desc",
) -> tuple[list[Claim], int]:
    filters = _filters(status, incident_type, risk_level, search, is_anomaly, from_date, to_date)
    total = session.scalar(select(func.count()).select_from(Claim).where(*filters)) or 0
    column = getattr(Claim, sort_by)
    order = column.asc() if sort_dir == "asc" else column.desc()
    claims = session.scalars(
        select(Claim).where(*filters).order_by(order, Claim.claim_id).limit(limit).offset(offset)
    ).all()
    return list(claims), total


def get_claim(session: Session, claim_id: str) -> Claim | None:
    return session.scalar(select(Claim).where(Claim.claim_id == claim_id))


def create_claim(session: Session, payload: ClaimCreate) -> Claim:
    claim = Claim(**payload.model_dump())
    session.add(claim)
    session.commit()
    session.refresh(claim)
    return claim


def get_high_risk_claims(session: Session, limit: int = 100) -> list[Claim]:
    return list(
        session.scalars(
            select(Claim)
            .where(Claim.review_priority == "High")
            .order_by(Claim.risk_score.desc(), Claim.claim_date.desc())
            .limit(limit)
        ).all()
    )
