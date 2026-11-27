from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.claim import ClaimCreate, ClaimPage, ClaimRead, ClaimStatus, ReviewPriority
from app.services.audit import record
from app.services.claims import create_claim, get_claim, get_high_risk_claims, list_claims
from app.services.export import claims_to_csv

router = APIRouter(prefix="/claims", tags=["claims"])


@router.get("/high-risk", response_model=list[ClaimRead])
def high_risk_claims(
    limit: int = Query(default=100, ge=1, le=100),
    session: Session = Depends(get_db),
):
    return get_high_risk_claims(session, limit)


@router.get("/export")
def export_claims(
    limit: int = Query(default=2500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
    status_filter: ClaimStatus | None = Query(default=None, alias="status"),
    incident_type: str | None = Query(default=None, min_length=1, max_length=32),
    risk_level: ReviewPriority | None = None,
    search: str | None = Query(default=None, min_length=1, max_length=64),
    is_anomaly: bool | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    sort_by: Literal["claim_date", "claim_amount", "risk_score"] = "claim_date",
    sort_dir: Literal["asc", "desc"] = "desc",
    session: Session = Depends(get_db),
):
    claims, _ = list_claims(
        session,
        limit,
        offset,
        status_filter,
        incident_type,
        risk_level,
        search,
        is_anomaly=is_anomaly,
        from_date=from_date,
        to_date=to_date,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return Response(
        content=claims_to_csv(claims),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="claimsense-claims.csv"'},
    )


@router.get("", response_model=ClaimPage)
def claims_list(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: ClaimStatus | None = Query(default=None, alias="status"),
    incident_type: str | None = Query(default=None, min_length=1, max_length=32),
    risk_level: ReviewPriority | None = None,
    search: str | None = Query(default=None, min_length=1, max_length=64),
    is_anomaly: bool | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    sort_by: Literal["claim_date", "claim_amount", "risk_score"] = "claim_date",
    sort_dir: Literal["asc", "desc"] = "desc",
    session: Session = Depends(get_db),
):
    claims, total = list_claims(
        session,
        limit,
        offset,
        status_filter,
        incident_type,
        risk_level,
        search,
        is_anomaly=is_anomaly,
        from_date=from_date,
        to_date=to_date,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return {"items": claims, "total": total, "limit": limit, "offset": offset}


@router.get("/{claim_id}", response_model=ClaimRead)
def claim_detail(claim_id: str, session: Session = Depends(get_db)):
    claim = get_claim(session, claim_id)
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim


@router.post("", response_model=ClaimRead, status_code=status.HTTP_201_CREATED)
def claim_create(payload: ClaimCreate, session: Session = Depends(get_db)):
    try:
        claim = create_claim(session, payload)
        record(session, "claim_created", f"Claim {payload.claim_id} created", payload.claim_id)
        session.commit()
        return claim
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A claim with this ID already exists") from error
