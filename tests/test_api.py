from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.database.base import Base
from app.database.session import create_database_engine
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'api.db'}")
    Base.metadata.create_all(engine)
    application = create_app(engine, seed_data=False)
    with TestClient(application) as test_client:
        yield test_client
    engine.dispose()


def claim_payload(claim_id="CLM-API-1"):
    return {
        "claim_id": claim_id,
        "policy_id": "POL-API-1",
        "customer_id": "CUS-API-1",
        "vehicle_age": 4,
        "vehicle_type": "Car",
        "vehicle_value": 2_000_000,
        "policy_age_days": 600,
        "incident_type": "Collision",
        "incident_location": "Kathmandu",
        "claim_amount": 250_000,
        "premium_amount": 75_000,
        "previous_claim_count": 0,
        "days_since_policy_start": 300,
        "incident_hour": 10,
        "repair_cost": 200_000,
        "supporting_documents_count": 2,
        "claim_status": "Open",
        "claim_date": date(2026, 1, 15).isoformat(),
    }


def test_health_and_claim_create_read_list(client):
    assert client.get("/health").json() == {"status": "ok"}

    created = client.post("/claims", json=claim_payload())
    assert created.status_code == 201
    assert created.json()["claim_id"] == "CLM-API-1"
    assert created.json()["risk_score"] is None

    detail = client.get("/claims/CLM-API-1")
    assert detail.status_code == 200
    assert detail.json()["claim_amount"] == 250_000

    page = client.get("/claims", params={"limit": 1})
    assert page.status_code == 200
    assert page.json()["total"] == 1
    assert len(page.json()["items"]) == 1


def test_duplicate_claim_and_missing_claim_errors(client):
    assert client.post("/claims", json=claim_payload()).status_code == 201
    duplicate = client.post("/claims", json=claim_payload())

    assert duplicate.status_code == 409
    assert client.get("/claims/CLM-UNKNOWN").status_code == 404


def test_claim_validation_and_pagination_bounds(client):
    invalid = claim_payload()
    invalid["incident_hour"] = 25

    assert client.post("/claims", json=invalid).status_code == 422
    assert client.get("/claims", params={"limit": 101}).status_code == 422
    assert client.get("/claims", params={"offset": -1}).status_code == 422


def test_analytics_return_database_aggregates(client):
    client.post("/claims", json=claim_payload())
    client.post("/claims", json=claim_payload("CLM-API-2"))

    overview = client.get("/claims/analytics/overview").json()
    assert overview["total_claims"] == 2
    assert overview["total_claim_amount"] == 500_000
    assert overview["average_claim_amount"] == 250_000
    assert overview["risk_distribution"]["Unassessed"] == 2

    risk_distribution = client.get("/claims/analytics/risk-distribution").json()
    assert risk_distribution["distribution"]["Unassessed"] == 2
    assert risk_distribution["assessed_count"] == 0

    trend_data = client.get("/claims/analytics/trends").json()
    assert trend_data["monthly"][0]["claim_count"] == 2
    assert trend_data["incident_types"][0]["incident_type"] == "Collision"


def test_application_seeds_synthetic_dataset(tmp_path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'seed.db'}")
    application = create_app(engine)

    with TestClient(application) as test_client:
        page = test_client.get("/claims", params={"limit": 1})
        overview = test_client.get("/claims/analytics/overview").json()
        explanation = test_client.post(
            "/assistant/ask", json={"question": "Why was claim CLM-00001 flagged?"}
        ).json()

    assert page.status_code == 200
    assert page.json()["total"] == 2500
    assert page.json()["items"][0]["risk_score"] is not None
    assert overview["risk_distribution"]["Unassessed"] == 0
    assert overview["high_priority_claims"] > 0
    assert "score of" in explanation["answer"]
    assert explanation["claim_ids"] == ["CLM-00001"]
    engine.dispose()


def test_assessment_is_explained_and_never_changes_claim_status(client):
    payload = claim_payload()
    payload.update(
        {
            "claim_amount": 1_600_000,
            "previous_claim_count": 4,
            "days_since_policy_start": 10,
            "incident_hour": 2,
            "supporting_documents_count": 0,
        }
    )
    assert client.post("/claims", json=payload).status_code == 201

    result = client.post("/claims/CLM-API-1/assess")

    assert result.status_code == 200
    assert result.json()["review_priority"] == "High"
    assert result.json()["risk_score"] == 90
    claim = client.get("/claims/CLM-API-1").json()
    assert claim["claim_status"] == "Open"
    assert claim["risk_indicators"]
    assert client.get("/claims/high-risk").json()[0]["claim_id"] == "CLM-API-1"
    risk_distribution = client.get("/claims/analytics/risk-distribution").json()
    assert risk_distribution["distribution"]["High"] == 1
    assert risk_distribution["score_histogram"]["80-100"] == 1


def test_assistant_api_validates_question_and_answers_database_queries(client):
    response = client.post("/assistant/ask", json={"question": "What is the average claim amount?"})

    assert response.status_code == 200
    assert "2500" not in response.json()["answer"]
    assert response.json()["supported"] is True
    assert response.json()["citations"]
    assert client.post("/assistant/ask", json={"question": "?"}).status_code == 422
    assert client.post("/assistant/ask", json={"question": "   "}).status_code == 422


def test_unassessed_risk_is_explicit_and_custom_ids_are_explainable(client):
    assert client.post("/claims", json=claim_payload()).status_code == 201
    risk = client.get("/claims/CLM-API-1/risk")

    assert risk.status_code == 200
    assert risk.json()["assessed"] is False
    assert risk.json()["risk_indicators"] == []

    assert client.post("/claims/CLM-API-1/assess").status_code == 200
    answer = client.post(
        "/assistant/ask", json={"question": "Why was claim CLM-API-1 flagged?"}
    ).json()

    assert answer["claim_ids"] == ["CLM-API-1"]
    assert "/100" in answer["answer"]
    assert client.get("/claims/CLM-API-1/risk").json()["assessed"] is True
