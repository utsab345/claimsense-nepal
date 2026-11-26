from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models import Claim


def overview(session: Session) -> dict:
    row = session.execute(
        select(
            func.count(Claim.id),
            func.coalesce(func.sum(Claim.claim_amount), 0.0),
            func.coalesce(func.avg(Claim.claim_amount), 0.0),
            func.sum(case((Claim.claim_status == "Under Review", 1), else_=0)),
            func.sum(case((Claim.review_priority == "Low", 1), else_=0)),
            func.sum(case((Claim.review_priority == "Medium", 1), else_=0)),
            func.sum(case((Claim.review_priority == "High", 1), else_=0)),
        )
    ).one()
    return {
        "total_claims": row[0],
        "total_claim_amount": round(float(row[1]), 2),
        "average_claim_amount": round(float(row[2]), 2),
        "under_review": row[3] or 0,
        "risk_distribution": {
            "Low": row[4] or 0,
            "Medium": row[5] or 0,
            "High": row[6] or 0,
            "Unassessed": row[0] - (row[4] or 0) - (row[5] or 0) - (row[6] or 0),
        },
    }


def trends(session: Session) -> dict:
    monthly_rows = session.execute(
        select(
            func.strftime("%Y-%m", Claim.claim_date).label("month"),
            func.count(Claim.id),
            func.coalesce(func.sum(Claim.claim_amount), 0.0),
        )
        .group_by("month")
        .order_by("month")
    ).all()
    incident_rows = session.execute(
        select(Claim.incident_type, func.count(Claim.id), func.coalesce(func.avg(Claim.claim_amount), 0.0))
        .group_by(Claim.incident_type)
        .order_by(func.count(Claim.id).desc())
    ).all()
    status_rows = session.execute(select(Claim.claim_status, func.count(Claim.id)).group_by(Claim.claim_status)).all()
    return {
        "monthly": [
            {"month": row[0], "claim_count": row[1], "claim_amount": round(float(row[2]), 2)}
            for row in monthly_rows
        ],
        "incident_types": [
            {"incident_type": row[0], "claim_count": row[1], "average_claim_amount": round(float(row[2]), 2)}
            for row in incident_rows
        ],
        "statuses": [{"claim_status": row[0], "claim_count": row[1]} for row in status_rows],
    }


def risk_distribution(session: Session) -> dict:
    rows = session.execute(
        select(Claim.review_priority, func.count(Claim.id)).group_by(Claim.review_priority)
    ).all()
    distribution = {"Low": 0, "Medium": 0, "High": 0, "Unassessed": 0}
    for priority, count in rows:
        distribution[priority or "Unassessed"] = count
    anomaly_count = session.scalar(select(func.count()).select_from(Claim).where(Claim.is_anomaly.is_(True))) or 0
    return {"distribution": distribution, "anomaly_count": anomaly_count}
