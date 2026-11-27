from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Claim, Investigation, InvestigationEvent, InvestigationNote
from app.schemas.investigation import InvestigationRead, InvestigationStatus
from app.services.audit import record


def get_or_create(session: Session, claim_id: str) -> Investigation:
    investigation = session.scalar(select(Investigation).where(Investigation.claim_id == claim_id))
    if investigation is None:
        investigation = Investigation(claim_id=claim_id, status="Open")
        session.add(investigation)
        session.flush()
        record(session, "investigation_opened", f"Investigation opened for {claim_id}", claim_id)
        session.commit()
    return investigation


def read(session: Session, claim_id: str) -> InvestigationRead:
    investigation = get_or_create(session, claim_id)
    notes = session.scalars(
        select(InvestigationNote).where(InvestigationNote.claim_id == claim_id).order_by(InvestigationNote.created_at)
    ).all()
    events = session.scalars(
        select(InvestigationEvent).where(InvestigationEvent.claim_id == claim_id).order_by(InvestigationEvent.created_at)
    ).all()
    return InvestigationRead(
        claim_id=investigation.claim_id,
        status=investigation.status,
        assigned_analyst=investigation.assigned_analyst,
        opened_at=investigation.opened_at,
        updated_at=investigation.updated_at,
        notes=list(notes),
        events=list(events),
    )


def add_note(session: Session, claim_id: str, body: str, author: str) -> InvestigationRead:
    get_or_create(session, claim_id)
    session.add(InvestigationNote(claim_id=claim_id, author=author, body=body))
    record(session, "note_added", f"Analyst note added to {claim_id}", claim_id, author)
    session.commit()
    return read(session, claim_id)


def update_status(
    session: Session, claim_id: str, status: InvestigationStatus, author: str, note: str | None
) -> InvestigationRead:
    investigation = get_or_create(session, claim_id)
    previous = investigation.status
    if previous != status:
        investigation.status = status
        session.add(
            InvestigationEvent(
                claim_id=claim_id,
                from_status=previous,
                to_status=status,
                author=author,
                detail=note,
            )
        )
        record(session, "status_changed", f"{claim_id}: {previous} -> {status}", claim_id, author)
    if note:
        session.add(InvestigationNote(claim_id=claim_id, author=author, body=note))
        record(session, "note_added", f"Analyst note added to {claim_id}", claim_id, author)
    session.commit()
    return read(session, claim_id)


def assign(session: Session, claim_id: str, analyst: str | None) -> InvestigationRead:
    investigation = get_or_create(session, claim_id)
    previous = investigation.assigned_analyst
    investigation.assigned_analyst = analyst
    record(
        session,
        "analyst_assigned",
        f"{claim_id}: assigned to {analyst or 'unassigned'} (was {previous or 'unassigned'})",
        claim_id,
    )
    session.commit()
    return read(session, claim_id)


def list_investigations(
    session: Session,
    status: InvestigationStatus | None,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[list[dict[str, object]], int]:
    filters = []
    if status == "Open":
        filters.append(or_(Investigation.status.is_(None), Investigation.status == "Open"))
    elif status:
        filters.append(Investigation.status == status)
    if search:
        term = f"%{search}%"
        filters.append(
            or_(
                Claim.claim_id.ilike(term),
                Investigation.assigned_analyst.ilike(term),
            )
        )
    total = session.scalar(
        select(func.count())
        .select_from(Claim)
        .outerjoin(Investigation, Investigation.claim_id == Claim.claim_id)
        .where(*filters)
    ) or 0
    rows = session.execute(
        select(Claim, Investigation)
        .outerjoin(Investigation, Investigation.claim_id == Claim.claim_id)
        .where(*filters)
        .order_by(func.coalesce(Investigation.updated_at, Claim.created_at).desc(), Claim.claim_id)
        .limit(limit)
        .offset(offset)
    ).all()
    items = [
        {
            "claim_id": claim.claim_id,
            "status": investigation.status if investigation is not None else "Open",
            "assigned_analyst": investigation.assigned_analyst if investigation is not None else None,
            "opened_at": investigation.opened_at if investigation is not None else claim.created_at,
            "updated_at": investigation.updated_at if investigation is not None else claim.created_at,
            "risk_score": claim.risk_score,
            "claim_amount": claim.claim_amount,
            "indicator_count": len(claim.risk_indicators or []),
        }
        for claim, investigation in rows
    ]
    return items, total
