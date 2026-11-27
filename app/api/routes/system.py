from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.database.session import get_db
from app.models import Claim
from app.schemas.investigation import NotificationItem, SettingsRead
from app.services.notifications import list_notifications, mark_read

router = APIRouter(tags=["system"])

DISCLAIMER = (
    "All records are synthetic. Risk scores and anomaly flags are uncalibrated decision-support signals, "
    "not fraud probabilities, and never cause automatic approval or rejection."
)


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/detailed")
def detailed_health(session: Session = Depends(get_db)):
    claims = session.scalar(select(func.count()).select_from(Claim)) or 0
    return {"status": "ok", "database": "ok", "claims": claims}


@router.get("/settings", response_model=SettingsRead)
def application_settings(session: Session = Depends(get_db)):
    settings = get_settings()
    claims = session.scalar(select(func.count()).select_from(Claim)) or 0
    return {
        "application": "ClaimSense Nepal",
        "version": settings.api_version,
        "database": "SQLite" if settings.database_url.startswith("sqlite") else "Configured database",
        "dataset": settings.dataset_path,
        "dataset_records": claims,
        "currency": "NPR",
        "risk_thresholds": {
            "high": settings.risk_high_threshold,
            "medium": settings.risk_medium_threshold,
            "anomaly_points": settings.risk_anomaly_weight,
        },
        "features": {
            "investigations": True,
            "assistant": True,
            "anomaly_detection": True,
            "external_llm": False,
        },
        "disclaimer": DISCLAIMER,
    }


@router.get("/notifications", response_model=list[NotificationItem])
def notifications(session: Session = Depends(get_db)):
    return list_notifications(session)


@router.post("/notifications/{notification_id}/read", response_model=NotificationItem)
def notification_read(notification_id: str, session: Session = Depends(get_db)):
    from fastapi import HTTPException

    if not mark_read(session, notification_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    for item in list_notifications(session):
        if item.id == notification_id:
            return item
    raise HTTPException(status_code=404, detail="Notification not found")
