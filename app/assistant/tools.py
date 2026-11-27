from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Claim

READ_ONLY_TOOLS = (
    "average_claim_amount",
    "claim_explanation",
    "early_claim_patterns",
    "financial_exposure",
    "high_priority_claims",
    "incident_amounts",
    "portfolio_summary",
    "unusual_missing_documents",
)

_HIGH_AMOUNT = case((Claim.review_priority == "High", Claim.claim_amount), else_=0.0)


def financial_exposure(session: Session) -> dict:
    row = session.execute(
        select(
            func.coalesce(func.sum(_HIGH_AMOUNT), 0.0),
            func.count(Claim.id),
            func.coalesce(func.sum(Claim.claim_amount), 0.0),
            func.sum(case((Claim.review_priority == "High", 1), else_=0)),
        )
    ).one()
    return {
        "high_priority_amount": float(row[0] or 0.0),
        "claims_count": row[1],
        "total_amount": float(row[2] or 0.0),
        "high_priority_count": row[3] or 0,
    }


def top_high_priority_claims(session: Session, limit: int = 5) -> list[dict]:
    rows = session.execute(
        select(Claim.claim_id, Claim.risk_score, Claim.claim_amount, Claim.incident_type)
        .where(Claim.review_priority == "High")
        .order_by(Claim.risk_score.desc(), Claim.claim_id)
        .limit(limit)
    ).all()
    return [
        {
            "claim_id": row[0],
            "risk_score": row[1],
            "claim_amount": float(row[2]),
            "incident_type": row[3],
        }
        for row in rows
    ]


def portfolio_summary(session: Session) -> dict:
    row = session.execute(
        select(
            func.count(Claim.id),
            func.coalesce(func.sum(Claim.claim_amount), 0.0),
            func.sum(_HIGH_AMOUNT),
            func.sum(case((Claim.claim_status == "Open", 1), else_=0)),
            func.sum(case((Claim.claim_status == "Under Review", 1), else_=0)),
            func.sum(case((Claim.is_anomaly.is_(True), 1), else_=0)),
        )
    ).one()
    return {
        "claims": row[0],
        "total_amount": float(row[1] or 0.0),
        "high_priority_amount": float(row[2] or 0.0),
        "open_claims": row[3] or 0,
        "under_review": row[4] or 0,
        "anomalies": row[5] or 0,
    }
