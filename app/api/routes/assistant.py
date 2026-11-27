from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent.service import answer_question
from app.database.session import get_db
from app.schemas.assistant import AssistantAnswer, AssistantQuestion

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/ask", response_model=AssistantAnswer)
def assistant_ask(payload: AssistantQuestion, session: Session = Depends(get_db)):
    return answer_question(session, payload.question)
