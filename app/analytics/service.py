from datetime import date

from sqlalchemy import String, case, func, select
from sqlalchemy.orm import Session

from app.models import Claim


def _date_filters(from_date: date | None, to_date: date | None):
    filters = []
    if from_date:
        filters.append(Claim.claim_date >= from_date)
    if to_date:
        filters.append(Claim.claim_date <= to_date)
    return filters


def overview(session: Session, from_date: date | None = None, to_date: date | None = None) -> dict:
    filters = _date_filters(from_date, to_date)
    row = session.execute(
        select(
            func.count(Claim.id),
            func.coalesce(func.sum(Claim.claim_amount), 0.0),
            func.coalesce(func.avg(Claim.claim_amount), 0.0),
            func.sum(case((Claim.claim_status == "Under Review", 1), else_=0)),
            func.sum(case((Claim.claim_status == "Open", 1), else_=0)),
            func.sum(case((Claim.review_priority == "Low", 1), else_=0)),
            func.sum(case((Claim.review_priority == "Medium", 1), else_=0)),
            func.sum(case((Claim.review_priority == "High", 1), else_=0)),
            func.sum(case((Claim.is_anomaly.is_(True), 1), else_=0)),
        ).where(*filters)
    ).one()
    assessed = (row[5] or 0) + (row[6] or 0) + (row[7] or 0)
    return {
        "total_claims": row[0],
        "total_claim_amount": round(float(row[1]), 2),
        "average_claim_amount": round(float(row[2]), 2),
        "open_claims": row[4] or 0,
        "under_review": row[3] or 0,
        "high_priority_claims": row[7] or 0,
        "anomaly_count": row[8] or 0,
        "risk_distribution": {
            "Low": row[5] or 0,
            "Medium": row[6] or 0,
            "High": row[7] or 0,
            "Unassessed": max(0, row[0] - assessed),
        },
    }


def trends(session: Session, from_date: date | None = None, to_date: date | None = None) -> dict:
    filters = _date_filters(from_date, to_date)
    month = func.substr(func.cast(Claim.claim_date, String), 1, 7).label("month")
    monthly_rows = session.execute(
        select(month, func.count(Claim.id), func.coalesce(func.sum(Claim.claim_amount), 0.0))
        .where(*filters)
        .group_by("month")
        .order_by("month")
    ).all()
    incident_rows = session.execute(
        select(Claim.incident_type, func.count(Claim.id), func.coalesce(func.avg(Claim.claim_amount), 0.0))
        .where(*filters)
        .group_by(Claim.incident_type)
        .order_by(func.count(Claim.id).desc())
    ).all()
    status_rows = session.execute(
        select(Claim.claim_status, func.count(Claim.id)).where(*filters).group_by(Claim.claim_status)
    ).all()
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


def risk_distribution(session: Session, from_date: date | None = None, to_date: date | None = None) -> dict:
    filters = _date_filters(from_date, to_date)
    rows = session.execute(
        select(Claim.review_priority, func.count(Claim.id)).where(*filters).group_by(Claim.review_priority)
    ).all()
    distribution = {"Low": 0, "Medium": 0, "High": 0, "Unassessed": 0}
    for priority, count in rows:
        key = priority or "Unassessed"
        if key in distribution:
            distribution[key] = count
    score_rows = session.execute(
        select(
            func.sum(case((Claim.risk_score < 20, 1), else_=0)),
            func.sum(case(((Claim.risk_score >= 20) & (Claim.risk_score < 40), 1), else_=0)),
            func.sum(case(((Claim.risk_score >= 40) & (Claim.risk_score < 60), 1), else_=0)),
            func.sum(case(((Claim.risk_score >= 60) & (Claim.risk_score < 80), 1), else_=0)),
            func.sum(case((Claim.risk_score >= 80, 1), else_=0)),
            func.count(Claim.risk_score),
        ).where(*filters)
    ).one()
    anomaly_count = session.scalar(
        select(func.count()).select_from(Claim).where(Claim.is_anomaly.is_(True), *filters)
    ) or 0
    return {
        "distribution": distribution,
        "score_histogram": {
            "0-19": score_rows[0] or 0,
            "20-39": score_rows[1] or 0,
            "40-59": score_rows[2] or 0,
            "60-79": score_rows[3] or 0,
            "80-100": score_rows[4] or 0,
        },
        "assessed_count": score_rows[5],
        "anomaly_count": anomaly_count,
    }


def portfolio(session: Session, from_date: date | None = None, to_date: date | None = None) -> dict:
    filters = _date_filters(from_date, to_date)
    location_rows = session.execute(
        select(
            func.coalesce(Claim.incident_location, "Unknown"),
            func.count(Claim.id),
            func.coalesce(func.sum(Claim.claim_amount), 0.0),
        )
        .where(*filters)
        .group_by(func.coalesce(Claim.incident_location, "Unknown"))
        .order_by(func.count(Claim.id).desc())
    ).all()
    ratio = Claim.claim_amount / Claim.premium_amount
    ratio_row = session.execute(
        select(
            func.coalesce(func.avg(ratio), 0.0),
            func.sum(case((ratio > 10, 1), else_=0)),
            func.count(Claim.id),
            func.sum(case((Claim.review_priority == "High", Claim.claim_amount), else_=0.0)),
            func.sum(case((Claim.review_priority == "High", 1), else_=0)),
        ).where(*filters)
    ).one()
    anomaly_rows = session.execute(
        select(Claim.review_priority, func.count(Claim.id))
        .where(Claim.is_anomaly.is_(True), *filters)
        .group_by(Claim.review_priority)
    ).all()
    return {
        "locations": [
            {"location": row[0], "claim_count": row[1], "total_amount": round(float(row[2]), 2)}
            for row in location_rows
        ],
        "claim_premium_ratio": {
            "average_ratio": round(float(ratio_row[0]), 2),
            "claims_above_ten_x": ratio_row[1] or 0,
            "claims_count": ratio_row[2] or 0,
        },
        "high_priority_exposure": {
            "total_amount": round(float(ratio_row[3] or 0.0), 2),
            "claim_count": ratio_row[4] or 0,
        },
        "anomaly_distribution": {
            "Low": 0,
            "Medium": 0,
            "High": 0,
            "Unassessed": 0,
            **{key: value for key, value in anomaly_rows if key in {"Low", "Medium", "High"}},
        },
    }
