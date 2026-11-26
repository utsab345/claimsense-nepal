import re

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Claim
from app.schemas.assistant import AssistantAnswer


CLAIM_ID_PATTERN = re.compile(r"\bCLM-\d+\b", re.IGNORECASE)


def answer_question(session: Session, question: str) -> AssistantAnswer:
    normalized = question.casefold()
    claim_match = CLAIM_ID_PATTERN.search(question)
    if claim_match and any(term in normalized for term in ("why", "reason", "flag")):
        return _claim_explanation(session, claim_match.group().upper())
    if "missing" in normalized and any(term in normalized for term in ("document", "support")) and any(
        term in normalized for term in ("unusual", "anomal", "outlier")
    ):
        return _unusual_missing_documents(session)
    if any(term in normalized for term in ("shortly after", "early claim", "policy activation", "policy start")):
        return _early_claim_patterns(session)
    if any(term in normalized for term in ("highest", "most")) and any(
        term in normalized for term in ("incident", "claim amount")
    ):
        return _incident_amounts(session, total="total" in normalized)
    if any(term in normalized for term in ("average", "avg", "mean")) and any(
        term in normalized for term in ("claim", "amount")
    ):
        return _average_claim_amount(session)
    if any(term in normalized for term in ("high priority", "high review priority", "high-risk", "high risk")) and any(
        term in normalized for term in ("how many", "count", "number", "show", "list")
    ):
        return _high_priority_claims(session)
    return AssistantAnswer(
        answer="I can answer questions about high-priority claim counts, average claim amounts, incident-type amounts, claim risk explanations, unusual claims with missing documents, and claims soon after policy start.",
        citations=[],
        supported=False,
    )


def _average_claim_amount(session: Session) -> AssistantAnswer:
    average = session.scalar(select(func.avg(Claim.claim_amount)))
    count = session.scalar(select(func.count()).select_from(Claim)) or 0
    if not count:
        return AssistantAnswer(answer="There are no claims in the database yet.", citations=["Claims database"])
    return AssistantAnswer(
        answer=f"The average claim amount is Rs {float(average):,.2f} across {count:,} claims.",
        citations=[f"Database aggregate: {count} claims"],
    )


def _high_priority_claims(session: Session) -> AssistantAnswer:
    count = session.scalar(
        select(func.count()).select_from(Claim).where(Claim.review_priority == "High")
    ) or 0
    ids = session.scalars(
        select(Claim.claim_id)
        .where(Claim.review_priority == "High")
        .order_by(Claim.risk_score.desc(), Claim.claim_id)
        .limit(10)
    ).all()
    answer = f"There are {count:,} claims with high review priority."
    if ids:
        answer += f" Highest-priority examples: {', '.join(ids)}."
    return AssistantAnswer(answer=answer, citations=["Claims database"], supported=True)


def _incident_amounts(session: Session, total: bool) -> AssistantAnswer:
    rows = session.execute(
        select(
            Claim.incident_type,
            func.count(Claim.id),
            func.avg(Claim.claim_amount),
            func.sum(Claim.claim_amount),
        ).group_by(Claim.incident_type)
    ).all()
    if not rows:
        return AssistantAnswer(answer="There are no claims in the database yet.", citations=["Claims database"])
    ordered = sorted(rows, key=lambda row: float(row[3] if total else row[2]), reverse=True)
    measure = "total" if total else "average"
    records = [
        f"{row[0]}: Rs {float(row[3] if total else row[2]):,.2f} {measure} across {row[1]} claims"
        for row in ordered[:3]
    ]
    return AssistantAnswer(
        answer=f"Incident types ranked by {measure} claim amount: {'; '.join(records)}.",
        citations=[f"Database aggregate: {sum(row[1] for row in rows)} claims grouped by incident type"],
    )


def _claim_explanation(session: Session, claim_id: str) -> AssistantAnswer:
    claim = session.scalar(select(Claim).where(Claim.claim_id == claim_id))
    if claim is None:
        return AssistantAnswer(
            answer=f"Claim {claim_id} was not found in the database.",
            citations=["Claims database"],
            supported=True,
        )
    if claim.risk_score is None:
        return AssistantAnswer(
            answer=f"Claim {claim_id} has not been assessed yet, so no risk indicators are stored.",
            citations=[f"Claim record: {claim_id}"],
            supported=True,
        )
    reasons = claim.risk_indicators or []
    reason_text = "; ".join(f"{item['label']}: {item['explanation']}" for item in reasons)
    if not reason_text:
        reason_text = "No rule indicators were triggered and the anomaly detector did not flag this claim."
    return AssistantAnswer(
        answer=f"Claim {claim_id} has a score of {claim.risk_score:.0f}/100 and {claim.review_priority} review priority. {reason_text}",
        citations=[f"Claim record: {claim_id}"],
        supported=True,
    )


def _unusual_missing_documents(session: Session) -> AssistantAnswer:
    filters = (
        Claim.is_anomaly.is_(True),
        or_(Claim.supporting_documents_count.is_(None), Claim.supporting_documents_count == 0),
    )
    count = session.scalar(select(func.count()).select_from(Claim).where(*filters)) or 0
    claim_ids = session.scalars(select(Claim.claim_id).where(*filters).order_by(Claim.claim_id).limit(10)).all()
    if not count:
        answer = "No assessed statistical outliers with missing or zero supporting documents are currently recorded."
    else:
        answer = f"Found {count} assessed statistical outliers with missing or zero supporting documents. Claim IDs: {', '.join(claim_ids)}."
        if count > len(claim_ids):
            answer += " The list is limited to 10 claims."
    return AssistantAnswer(answer=answer, citations=["Claims database"], supported=True)


def _early_claim_patterns(session: Session) -> AssistantAnswer:
    window = get_settings().risk_early_claim_days_medium
    early_filter = Claim.days_since_policy_start <= window
    early_count, early_average = session.execute(
        select(func.count(Claim.id), func.avg(Claim.claim_amount)).where(early_filter)
    ).one()
    total_count, total_average = session.execute(
        select(func.count(Claim.id), func.avg(Claim.claim_amount))
    ).one()
    examples = session.scalars(
        select(Claim.claim_id)
        .where(early_filter)
        .order_by(Claim.days_since_policy_start, Claim.claim_id)
        .limit(5)
    ).all()
    if not early_count:
        return AssistantAnswer(
            answer=f"No claims occurred within {window} days of policy start.",
            citations=["Claims database"],
        )
    answer = (
        f"{early_count} of {total_count} claims occurred within {window} days of policy start. "
        f"Their average amount was Rs {float(early_average):,.2f}, compared with Rs {float(total_average):,.2f} "
        "for all claims. This is a descriptive comparison, not evidence of wrongdoing."
    )
    if examples:
        answer += f" Example claim IDs: {', '.join(examples)}."
    return AssistantAnswer(answer=answer, citations=["Database aggregate: claims grouped by policy-start timing"])
