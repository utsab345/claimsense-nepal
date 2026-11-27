from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.database.base import Base
from app.database.session import create_database_engine
from app.main import create_app


@pytest.fixture
def client(tmp_path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'workflow.db'}")
    Base.metadata.create_all(engine)
    application = create_app(engine, seed_data=False)
    with TestClient(application) as test_client:
        yield test_client
    engine.dispose()


def claim_payload(claim_id="CLM-WF-1", claim_date="2026-01-15", location="Kathmandu"):
    return {
        "claim_id": claim_id,
        "policy_id": f"POL-{claim_id}",
        "customer_id": f"CUS-{claim_id}",
        "vehicle_age": 4,
        "vehicle_type": "Car",
        "vehicle_value": 2_000_000,
        "policy_age_days": 600,
        "incident_type": "Collision",
        "incident_location": location,
        "claim_amount": 250_000,
        "premium_amount": 75_000,
        "previous_claim_count": 0,
        "days_since_policy_start": 300,
        "incident_hour": 10,
        "repair_cost": 200_000,
        "supporting_documents_count": 2,
        "claim_status": "Open",
        "claim_date": claim_date,
    }


def high_risk_payload(claim_id):
    payload = claim_payload(claim_id)
    payload.update(
        {
            "claim_amount": 1_600_000,
            "previous_claim_count": 4,
            "days_since_policy_start": 10,
            "incident_hour": 2,
            "supporting_documents_count": 0,
        }
    )
    return payload


def test_investigation_workflow_persists_notes_history_and_audit(client):
    assert client.post("/claims", json=claim_payload()).status_code == 201
    assert client.get("/claims/CLM-WF-1/investigation").json()["status"] == "Open"

    updated = client.patch(
        "/claims/CLM-WF-1/investigation/status",
        json={"status": "Under Review", "author": "Analyst A", "note": "Requested police report"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "Under Review"

    assigned = client.patch(
        "/claims/CLM-WF-1/investigation/assignment", json={"assigned_analyst": "Analyst A"}
    )
    assert assigned.json()["assigned_analyst"] == "Analyst A"

    noted = client.post(
        "/claims/CLM-WF-1/investigation/note", json={"body": "Report received", "author": "Analyst A"}
    )
    assert noted.status_code == 200
    assert [note["body"] for note in noted.json()["notes"]] == ["Requested police report", "Report received"]

    resolved = client.patch(
        "/claims/CLM-WF-1/investigation/status",
        json={"status": "Additional Information Required", "author": "Analyst A"},
    )
    assert resolved.json()["status"] == "Additional Information Required"
    final = client.patch(
        "/claims/CLM-WF-1/investigation/status", json={"status": "Resolved", "author": "Analyst A"}
    ).json()
    assert [event["to_status"] for event in final["events"]] == [
        "Under Review",
        "Additional Information Required",
        "Resolved",
    ]

    assert client.get("/claims/CLM-WF-1").json()["claim_status"] == "Open"
    audit = client.get("/audit", params={"claim_id": "CLM-WF-1"}).json()
    assert audit["total"] >= 5
    assert any(entry["action"] == "status_changed" for entry in audit["items"])


def test_investigation_list_filters_and_unknown_claim(client):
    for claim_id in ("CLM-WF-1", "CLM-WF-2"):
        assert client.post("/claims", json=claim_payload(claim_id)).status_code == 201
    client.patch("/claims/CLM-WF-1/investigation/status", json={"status": "Under Review"})

    all_items = client.get("/investigations").json()
    assert all_items["total"] == 2
    filtered = client.get("/investigations", params={"status": "Under Review"}).json()
    assert [item["claim_id"] for item in filtered["items"]] == ["CLM-WF-1"]
    assert client.get("/claims/UNKNOWN/investigation").status_code == 404


def test_export_contains_only_filtered_claims(client):
    assert client.post("/claims", json=claim_payload()).status_code == 201
    closed = claim_payload("CLM-WF-2")
    closed["claim_status"] = "Paid"
    assert client.post("/claims", json=closed).status_code == 201

    response = client.get("/claims/export", params={"status": "Open"})
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    rows = response.text.strip().splitlines()
    assert len(rows) == 2
    assert "CLM-WF-1" in response.text
    assert "CLM-WF-2" not in response.text


def test_analytics_date_range_and_portfolio(client):
    assert client.post("/claims", json=claim_payload(claim_date="2026-01-15")).status_code == 201
    assert client.post("/claims", json=claim_payload("CLM-WF-2", "2026-03-10")).status_code == 201

    filtered = client.get("/claims/analytics/overview", params={"from_date": "2026-03-01"}).json()
    assert filtered["total_claims"] == 1
    portfolio = client.get("/claims/analytics/portfolio").json()
    assert portfolio["locations"][0]["location"] == "Kathmandu"
    assert portfolio["claim_premium_ratio"]["claims_count"] == 2
    assert portfolio["high_priority_exposure"]["claim_count"] == 0


def test_notifications_settings_and_detailed_health(client):
    assert client.post("/claims", json=high_risk_payload("CLM-WF-1")).status_code == 201
    client.post("/claims/CLM-WF-1/assess")

    notifications = client.get("/notifications").json()
    assert notifications[0]["id"] == "high-priority-queue"
    assert notifications[0]["read"] is False
    assert client.post("/notifications/high-priority-queue/read").status_code == 200
    assert client.get("/notifications").json()[0]["read"] is True

    settings = client.get("/settings").json()
    assert settings["currency"] == "NPR"
    assert settings["features"]["external_llm"] is False
    assert "synthetic" in settings["disclaimer"].lower()
    assert client.get("/health/detailed").json()["claims"] == 1


def test_assistant_exposure_summary_and_top_claims(client):
    assert client.post("/claims", json=high_risk_payload("CLM-WF-1")).status_code == 201
    assert client.post("/claims/CLM-WF-1/assess").status_code == 200

    exposure = client.post("/assistant/ask", json={"question": "What is the financial exposure of high-priority claims?"}).json()
    assert "NPR" in exposure["answer"]
    assert exposure["claim_ids"] == ["CLM-WF-1"]
    assert exposure["calculation"]

    summary = client.post("/assistant/ask", json={"question": "Summarize the claims portfolio."}).json()
    assert "synthetic" in summary["answer"].lower()

    top = client.post("/assistant/ask", json={"question": "What are the five highest-priority claims?"}).json()
    assert "CLM-WF-1" in top["answer"]
    assert top["supported"] is True


def test_cors_allows_configured_frontend_origin(client):
    response = client.options(
        "/health",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
