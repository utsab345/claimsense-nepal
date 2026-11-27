from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Claim, Investigation, NotificationRead
from app.schemas.investigation import NotificationItem


DEFINITIONS = {
    "high-priority-queue": ("High-priority claims awaiting review", "warning"),
    "statistical-anomalies": ("Statistical anomalies recorded", "critical"),
    "under-review-backlog": ("Claims currently under review", "info"),
    "synthetic-data": ("Synthetic dataset notice", "info"),
}


def list_notifications(session: Session) -> list[NotificationItem]:
    high = session.scalars(
        select(Claim.claim_id)
        .outerjoin(Investigation, Investigation.claim_id == Claim.claim_id)
        .where(
            Claim.review_priority == "High",
            (Investigation.status.is_(None)) | (Investigation.status == "Open"),
        )
        .order_by(Claim.risk_score.desc())
        .limit(5)
    ).all()
    high_count = session.scalar(
        select(func.count())
        .select_from(Claim)
        .outerjoin(Investigation, Investigation.claim_id == Claim.claim_id)
        .where(
            Claim.review_priority == "High",
            (Investigation.status.is_(None)) | (Investigation.status == "Open"),
        )
    ) or 0
    anomaly_count = session.scalar(select(func.count()).select_from(Claim).where(Claim.is_anomaly.is_(True))) or 0
    under_review = session.scalar(
        select(func.count()).select_from(Claim).where(Claim.claim_status == "Under Review")
    ) or 0
    read_ids = set(session.scalars(select(NotificationRead.notification_id)).all())
    values = {
        "high-priority-queue": (
            f"{high_count} high-priority claim(s) have no active investigation.",
            list(high),
        ),
        "statistical-anomalies": (
            f"{anomaly_count} claim(s) were flagged by the statistical model.",
            [],
        ),
        "under-review-backlog": (
            f"{under_review} claim(s) are marked under review.",
            [],
        ),
        "synthetic-data": (
            "All records are synthetic and do not represent real Nepal insurance statistics.",
            [],
        ),
    }
    return [
        NotificationItem(
            id=key,
            title=title,
            body=values[key][0],
            severity=severity,
            read=key in read_ids,
            claim_ids=values[key][1],
        )
        for key, (title, severity) in DEFINITIONS.items()
    ]


def mark_read(session: Session, notification_id: str) -> bool:
    if notification_id not in DEFINITIONS:
        return False
    existing = session.get(NotificationRead, notification_id)
    if existing is None:
        session.add(NotificationRead(notification_id=notification_id))
        session.commit()
    return True
