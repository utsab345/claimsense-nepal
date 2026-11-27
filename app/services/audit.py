from sqlalchemy.orm import Session

from app.models import AuditLog


def record(session: Session, action: str, summary: str, claim_id: str | None = None, actor: str = "system") -> AuditLog:
    entry = AuditLog(claim_id=claim_id, action=action, summary=summary, actor=actor)
    session.add(entry)
    session.flush()
    return entry
