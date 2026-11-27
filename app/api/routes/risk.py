from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.risk import RiskEngine
from app.database.session import get_db
from app.models import Claim
from app.schemas.claim import RiskAssessment
from app.services.audit import record
from app.services.claims import get_claim

router = APIRouter(prefix="/claims", tags=["risk"])

DISCLAIMER = "This assessment supports manual review and is not proof of fraud or grounds for automatic rejection."


@router.get("/{claim_id}/risk", response_model=RiskAssessment)
def claim_risk(claim_id: str, session: Session = Depends(get_db)):
    claim = get_claim(session, claim_id)
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    return RiskAssessment(
        claim_id=claim.claim_id,
        risk_score=claim.risk_score or 0.0,
        review_priority=claim.review_priority or "Low",
        is_anomaly=bool(claim.is_anomaly),
        risk_indicators=claim.risk_indicators or [],
        disclaimer=DISCLAIMER,
    )


@router.post("/{claim_id}/assess", response_model=RiskAssessment)
def assess_claim(claim_id: str, session: Session = Depends(get_db)):
    claim = get_claim(session, claim_id)
    if claim is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")
    history = session.scalars(select(Claim).where(Claim.claim_id != claim_id)).all()
    assessment = RiskEngine().assess(claim, history)
    claim.risk_score = assessment.risk_score
    claim.review_priority = assessment.review_priority
    claim.is_anomaly = assessment.is_anomaly
    claim.risk_indicators = [indicator.model_dump() for indicator in assessment.risk_indicators]
    record(
        session,
        "risk_assessed",
        f"{claim_id} scored {assessment.risk_score:.0f}/100 ({assessment.review_priority})",
        claim_id,
    )
    session.commit()
    return assessment
