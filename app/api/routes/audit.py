from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import AuditLog
from app.schemas.investigation import AuditLogPage

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=AuditLogPage)
def audit_history(
    claim_id: str | None = Query(default=None, max_length=32),
    action: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_db),
):
    filters = []
    if claim_id:
        filters.append(AuditLog.claim_id == claim_id)
    if action:
        filters.append(AuditLog.action == action)
    total = session.scalar(select(func.count()).select_from(AuditLog).where(*filters)) or 0
    entries = session.scalars(
        select(AuditLog).where(*filters).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).offset(offset)
    ).all()
    return {"items": list(entries), "total": total, "limit": limit, "offset": offset}
