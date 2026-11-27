import re

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.assistant.tools import financial_exposure, portfolio_summary, top_high_priority_claims
from app.core.config import get_settings
from app.models import Claim
from app.schemas.assistant import AssistantAnswer


CLAIM_ID_PATTERN = re.compile(r"\b[A-Z][A-Z0-9]*(?:-[A-Za-z0-9]+)+\b", re.IGNORECASE)
_HIGH_RISK_TERMS = (
    "high priority",
    "high review priority",
    "high-risk",
    "high risk",
    "high-priority",
    "highest priority",
    "highest-priority",
)


def _result(
    tool: str,
    answer: str,
    citations: list[str],
    *,
    follow_ups: list[str] | None = None,
    claim_ids: list[str] | None = None,
    calculation: str | None = None,
    supported: bool = True,
) -> AssistantAnswer:
    return AssistantAnswer(
        answer=answer,
        citations=citations,
        supported=supported,
        claim_ids=list(claim_ids or []),
        calculation=calculation,
        tool=tool,
        follow_ups=list(follow_ups or []),
    )


def answer_question(session: Session, question: str) -> AssistantAnswer:
    normalized = question.casefold()
    claim_match = CLAIM_ID_PATTERN.search(question)
    if claim_match and any(term in normalized for term in ("why", "reason", "flag", "explain")):
        return _claim_explanation(session, claim_match.group().upper())
    if "exposure" in normalized or ("financial" in normalized and any(term in normalized for term in _HIGH_RISK_TERMS)):
        return _financial_exposure(session)
    if "summar" in normalized and "portfolio" in normalized:
        return _portfolio_summary(session)
    if any(term in normalized for term in _HIGH_RISK_TERMS):
        if any(term in normalized for term in ("five", "top", "list", "show", "which", "what are")):
            return _top_high_priority_claims(session)
        return _high_priority_claims(session)
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
    return _result(
        "unsupported",
        "I can answer questions about high-priority claims, financial exposure, portfolio summaries, "
        "average claim amounts, incident-type amounts, claim risk explanations, unusual claims with "
        "missing documents, and claims soon after policy start.",
        [],
        supported=False,
        follow_ups=["Summarize the claims portfolio.", "What are the five highest-priority claims?"],
    )


def _average_claim_amount(session: Session) -> AssistantAnswer:
    average = session.scalar(select(func.avg(Claim.claim_amount)))
    count = session.scalar(select(func.count()).select_from(Claim)) or 0
    if not count:
        return _result(
            "average_claim_amount",
            "There are no claims in the database yet.",
            ["Claims database"],
            follow_ups=["Summarize the claims portfolio."],
        )
    return _result(
        "average_claim_amount",
        f"The average claim amount is NPR {float(average):,.2f} across {count:,} claims.",
        [f"Database aggregate: {count} claims"],
        calculation="AVG(claim_amount) over all claims in the database",
        follow_ups=[
            "Which incident categories have the highest average claim amounts?",
            "Summarize the claims portfolio.",
        ],
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
    return _result(
        "high_priority_claims",
        answer,
        ["Claims database"],
        claim_ids=list(ids),
        calculation="COUNT(claims) WHERE review_priority = 'High'",
        follow_ups=[
            "What are the five highest-priority claims?",
            "What is the financial exposure of high-priority claims?",
        ],
    )


def _top_high_priority_claims(session: Session) -> AssistantAnswer:
    rows = top_high_priority_claims(session, limit=5)
    if not rows:
        return _result(
            "high_priority_claims",
            "There are no claims with high review priority in the database.",
            ["Claims database"],
            follow_ups=["Summarize the claims portfolio."],
        )
    details = "; ".join(
        f"{row['claim_id']} (score {float(row['risk_score']):.0f}, NPR {row['claim_amount']:,.2f}, {row['incident_type']})"
        for row in rows
    )
    claim_ids = [row["claim_id"] for row in rows]
    return _result(
        "high_priority_claims",
        f"The five highest-priority claims by stored risk score are: {details}.",
        ["Claims database"],
        claim_ids=claim_ids,
        calculation="ORDER BY risk_score DESC, claim_id LIMIT 5 WHERE review_priority = 'High'",
        follow_ups=[
            f"Why was claim {claim_ids[0]} flagged?",
            "What is the financial exposure of high-priority claims?",
        ],
    )


def _financial_exposure(session: Session) -> AssistantAnswer:
    result = financial_exposure(session)
    total = result["total_amount"]
    high = result["high_priority_amount"]
    share = (high / total * 100) if total else 0.0
    ids = [row["claim_id"] for row in top_high_priority_claims(session, limit=5)]
    answer = (
        f"High-priority claims account for NPR {high:,.2f} across {result['high_priority_count']:,} claims, "
        f"{share:.1f}% of the NPR {total:,.2f} total claimed amount in the database. "
        "This is a claim-amount total, not an expected loss or a fraud finding."
    )
    if ids:
        answer += f" Largest high-priority exposures include: {', '.join(ids)}."
    return _result(
        "financial_exposure",
        answer,
        ["Claims database", "Stored review priority and claim_amount fields"],
        claim_ids=ids,
        calculation="SUM(claim_amount) WHERE review_priority = 'High'; share = high_priority_sum / total_sum",
        follow_ups=[
            "What are the five highest-priority claims?",
            "Summarize the claims portfolio.",
        ],
    )


def _portfolio_summary(session: Session) -> AssistantAnswer:
    result = portfolio_summary(session)
    if not result["claims"]:
        return _result(
            "portfolio_summary",
            "There are no claims in the database yet.",
            ["Claims database"],
            follow_ups=["What is the average claim amount?"],
        )
    answer = (
        f"The portfolio holds {result['claims']:,} synthetic claims totalling NPR {result['total_amount']:,.2f}. "
        f"{result['open_claims']:,} are open and {result['under_review']:,} are under review. "
        f"{result['anomalies']:,} claims have a recorded statistical anomaly flag and "
        f"NPR {result['high_priority_amount']:,.2f} sits in high-priority claims. "
        "These figures describe generated data only, not the Nepal insurance market."
    )
    return _result(
        "portfolio_summary",
        answer,
        ["Claims database", "Synthetic dataset disclaimer"],
        calculation="COUNT and SUM aggregates over all claim records",
        follow_ups=[
            "What are the five highest-priority claims?",
            "Were there claims within 14 days of policy start?",
        ],
    )


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
        return _result(
            "incident_amounts",
            "There are no claims in the database yet.",
            ["Claims database"],
            follow_ups=["Summarize the claims portfolio."],
        )
    ordered = sorted(rows, key=lambda row: float(row[3] if total else row[2]), reverse=True)
    measure = "total" if total else "average"
    records = [
        f"{row[0]}: NPR {float(row[3] if total else row[2]):,.2f} {measure} across {row[1]} claims"
        for row in ordered[:3]
    ]
    return _result(
        "incident_amounts",
        f"Incident types ranked by {measure} claim amount: {'; '.join(records)}.",
        [f"Database aggregate: {sum(row[1] for row in rows)} claims grouped by incident type"],
        calculation=f"GROUP BY incident_type, ordered by {measure}(claim_amount)",
        follow_ups=[
            "What is the average claim amount?",
            "What are the five highest-priority claims?",
        ],
    )


def _claim_explanation(session: Session, claim_id: str) -> AssistantAnswer:
    claim = session.scalar(select(Claim).where(Claim.claim_id == claim_id))
    if claim is None:
        return _result(
            "claim_explanation",
            f"Claim {claim_id} was not found in the database.",
            ["Claims database"],
            follow_ups=["Summarize the claims portfolio."],
        )
    if claim.risk_score is None:
        return _result(
            "claim_explanation",
            f"Claim {claim_id} has not been assessed yet, so no risk indicators are stored.",
            [f"Claim record: {claim_id}"],
            follow_ups=["What are the five highest-priority claims?"],
        )
    reasons = claim.risk_indicators or []
    reason_text = "; ".join(
        f"{item.get('label', item.get('code', 'Indicator'))}: {item.get('explanation', '')}" for item in reasons
    )
    if not reason_text:
        reason_text = "No rule indicators were triggered and the anomaly detector did not flag this claim."
    anomaly_text = " The statistical model flagged an anomaly; this is separate from the rule score." if claim.is_anomaly else ""
    return _result(
        "claim_explanation",
        f"Claim {claim_id} has a score of {claim.risk_score:.0f}/100 and {claim.review_priority} review priority. "
        f"{reason_text}{anomaly_text} A risk score is not a fraud probability and does not trigger rejection.",
        [f"Claim record: {claim_id}"],
        claim_ids=[claim_id],
        calculation="Stored rule-based score = sum of triggered indicator points, capped at 100",
        follow_ups=[
            "What are the five highest-priority claims?",
            "Summarize the claims portfolio.",
        ],
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
    follow_ups = (
        [f"Why was claim {claim_ids[0]} flagged?", "Summarize the claims portfolio."]
        if claim_ids
        else ["Summarize the claims portfolio."]
    )
    return _result(
        "unusual_missing_documents",
        answer,
        ["Claims database"],
        claim_ids=list(claim_ids),
        calculation="COUNT WHERE is_anomaly = true AND supporting_documents_count is null or 0",
        follow_ups=follow_ups,
    )


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
        return _result(
            "early_claim_patterns",
            f"No claims occurred within {window} days of policy start.",
            ["Claims database"],
            follow_ups=["Summarize the claims portfolio."],
        )
    answer = (
        f"{early_count} of {total_count} claims occurred within {window} days of policy start. "
        f"Their average amount was NPR {float(early_average):,.2f}, compared with NPR {float(total_average):,.2f} "
        "for all claims. This is a descriptive comparison, not evidence of wrongdoing."
    )
    if examples:
        answer += f" Example claim IDs: {', '.join(examples)}."
    return _result(
        "early_claim_patterns",
        answer,
        ["Database aggregate: claims grouped by policy-start timing"],
        claim_ids=list(examples),
        calculation=f"COUNT and AVG(claim_amount) WHERE days_since_policy_start <= {window}",
        follow_ups=[
            "Show unusual claims with missing documents",
            "Summarize the claims portfolio.",
        ],
    )
