from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.investigation import (
    AssignmentUpdate,
    InvestigationPage,
    InvestigationRead,
    InvestigationStatus,
    NoteCreate,
    StatusUpdate,
)
from app.services.claims import get_claim
from app.services.investigations import add_note, assign, list_investigations, read, update_status

router = APIRouter(tags=["investigations"])


def _require_claim(claim_id: str, session: Session) -> None:
    if get_claim(session, claim_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Claim not found")


@router.get("/investigations", response_model=InvestigationPage)
def investigations_list(
    status_filter: InvestigationStatus | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: Session = Depends(get_db),
):
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="limit must be between 1 and 100")
    items, total = list_investigations(session, status_filter, search, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/claims/{claim_id}/investigation", response_model=InvestigationRead)
def investigation_detail(claim_id: str, session: Session = Depends(get_db)):
    _require_claim(claim_id, session)
    return read(session, claim_id)


@router.post("/claims/{claim_id}/investigation/note", response_model=InvestigationRead)
def investigation_note(claim_id: str, payload: NoteCreate, session: Session = Depends(get_db)):
    _require_claim(claim_id, session)
    return add_note(session, claim_id, payload.body, payload.author)


@router.patch("/claims/{claim_id}/investigation/status", response_model=InvestigationRead)
def investigation_status(claim_id: str, payload: StatusUpdate, session: Session = Depends(get_db)):
    _require_claim(claim_id, session)
    return update_status(session, claim_id, payload.status, payload.author, payload.note)


@router.patch("/claims/{claim_id}/investigation/assignment", response_model=InvestigationRead)
def investigation_assignment(claim_id: str, payload: AssignmentUpdate, session: Session = Depends(get_db)):
    _require_claim(claim_id, session)
    return assign(session, claim_id, payload.assigned_analyst)
