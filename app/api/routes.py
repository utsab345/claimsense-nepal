from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.analytics.service import overview, risk_distribution, trends
from app.database.session import get_db
from app.schemas.claim import ClaimCreate, ClaimPage, ClaimRead, ClaimStatus, ReviewPriority
from app.services.claims import create_claim, get_claim, get_high_risk_claims, list_claims


router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/claims", response_model=ClaimPage)
def claims_list(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    status_filter: ClaimStatus | None = Query(default=None, alias="status"),
    incident_type: str | None = Query(default=None, min_length=1, max_length=32),
    risk_level: ReviewPriority | None = None,
    search: str | None = Query(default=None, min_length=1, max_length=64),
    session: Session = Depends(get_db),
):
    claims, total = list_claims(session, limit, offset, status_filter, incident_type, risk_level, search)
    return {"items": claims, "total": total, "limit": limit, "offset": offset}


@router.get("/claims/analytics/overview")
def claims_overview(session: Session = Depends(get_db)):
    return overview(session)


@router.get("/claims/analytics/trends")
def claims_trends(session: Session = Depends(get_db)):
    return trends(session)


@router.get("/claims/analytics/risk-distribution")
def claims_risk_distribution(session: Session = Depends(get_db)):
    return risk_distribution(session)


@router.get("/claims/high-risk", response_model=list[ClaimRead])
def high_risk_claims(
    limit: int = Query(default=100, ge=1, le=100),
    session: Session = Depends(get_db),
):
    return get_high_risk_claims(session, limit)


@router.get("/claims/{claim_id}", response_model=ClaimRead)
def claim_detail(claim_id: str, session: Session = Depends(get_db)):
    claim = get_claim(session, claim_id)
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return claim


@router.post("/claims", response_model=ClaimRead, status_code=status.HTTP_201_CREATED)
def claim_create(payload: ClaimCreate, session: Session = Depends(get_db)):
    try:
        return create_claim(session, payload)
    except IntegrityError as error:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A claim with this ID already exists") from error
