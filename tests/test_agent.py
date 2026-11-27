from datetime import date

import pytest

from app.agent.service import answer_question
from app.database.base import Base
from app.database.session import create_database_engine, create_session_factory
from app.models import Claim


@pytest.fixture
def session(tmp_path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'assistant.db'}")
    Base.metadata.create_all(engine)
    session_factory = create_session_factory(engine)
    with session_factory() as database_session:
        database_session.add_all(
            [
                Claim(
                    claim_id="CLM-00001",
                    policy_id="POL-1",
                    customer_id="CUS-1",
                    vehicle_age=4,
                    vehicle_type="Car",
                    vehicle_value=2_000_000,
                    policy_age_days=600,
                    incident_type="Collision",
                    incident_location="Kathmandu",
                    claim_amount=300_000,
                    premium_amount=75_000,
                    previous_claim_count=1,
                    days_since_policy_start=10,
                    incident_hour=10,
                    repair_cost=200_000,
                    supporting_documents_count=None,
                    claim_status="Open",
                    claim_date=date(2026, 1, 15),
                    risk_score=85,
                    review_priority="High",
                    is_anomaly=True,
                    risk_indicators=[
                        {
                            "code": "documents_missing",
                            "label": "Supporting documents missing",
                            "explanation": "No supporting documents are recorded for this claim.",
                            "points": 10,
                        }
                    ],
                ),
                Claim(
                    claim_id="CLM-00002",
                    policy_id="POL-2",
                    customer_id="CUS-2",
                    vehicle_age=5,
                    vehicle_type="Car",
                    vehicle_value=2_500_000,
                    policy_age_days=800,
                    incident_type="Theft",
                    incident_location="Pokhara",
                    claim_amount=100_000,
                    premium_amount=85_000,
                    previous_claim_count=0,
                    days_since_policy_start=100,
                    incident_hour=11,
                    repair_cost=80_000,
                    supporting_documents_count=2,
                    claim_status="Paid",
                    claim_date=date(2026, 2, 15),
                ),
                Claim(
                    claim_id="CLM-00003",
                    policy_id="POL-3",
                    customer_id="CUS-3",
                    vehicle_age=6,
                    vehicle_type="SUV",
                    vehicle_value=4_000_000,
                    policy_age_days=900,
                    incident_type="Flood",
                    incident_location="Biratnagar",
                    claim_amount=200_000,
                    premium_amount=120_000,
                    previous_claim_count=0,
                    days_since_policy_start=30,
                    incident_hour=12,
                    repair_cost=150_000,
                    supporting_documents_count=0,
                    claim_status="Approved",
                    claim_date=date(2026, 3, 15),
                ),
            ]
        )
        database_session.commit()
        yield database_session
    engine.dispose()


def test_assistant_answers_aggregates_with_database_citations(session):
    average = answer_question(session, "What is the average claim amount?")
    high_priority = answer_question(session, "How many claims have high review priority?")
    highest_incident = answer_question(session, "Which incident types have the highest claim amounts?")

    assert "NPR 200,000.00" in average.answer
    assert average.citations
    assert "1 claims" in high_priority.answer
    assert "CLM-00001" in high_priority.answer
    assert "Collision" in highest_incident.answer
    assert highest_incident.citations


def test_assistant_explains_claim_and_lists_assessed_outliers(session):
    explanation = answer_question(session, "Why was claim CLM-00001 flagged?")
    missing_documents = answer_question(session, "Show unusual claims with missing documents")

    assert "85/100" in explanation.answer
    assert "Supporting documents missing" in explanation.answer
    assert "CLM-00001" in explanation.citations[0]
    assert "CLM-00001" in missing_documents.answer
    assert "CLM-00003" not in missing_documents.answer


def test_assistant_describes_policy_start_patterns_and_unsupported_queries(session):
    early = answer_question(session, "What patterns appear shortly after policy activation?")
    unsupported = answer_question(session, "Can you predict next year's claims?")

    assert "2 of 3 claims" in early.answer
    assert "not evidence of wrongdoing" in early.answer
    assert unsupported.supported is False
    assert "approved database queries" not in unsupported.answer


def test_assistant_handles_unassessed_and_unknown_claims(session):
    unassessed = answer_question(session, "Why was CLM-00002 flagged?")
    unknown = answer_question(session, "Why was CLM-99999 flagged?")

    assert "has not been assessed" in unassessed.answer
    assert "was not found" in unknown.answer
