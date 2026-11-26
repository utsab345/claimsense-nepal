from datetime import date

from sqlalchemy import select

from app.database.base import Base
from app.database.session import create_database_engine, create_session_factory
from app.models import Claim
from app.schemas.claim import ClaimCreate


def test_claim_persists_with_optional_fields(tmp_path):
    engine = create_database_engine(f"sqlite:///{tmp_path / 'claims.db'}")
    Base.metadata.create_all(engine)
    session_factory = create_session_factory(engine)
    claim = Claim(
        claim_id="CLM-TEST-1",
        policy_id="POL-TEST-1",
        customer_id="CUS-TEST-1",
        vehicle_age=4,
        vehicle_type="Car",
        vehicle_value=2_000_000,
        policy_age_days=600,
        incident_type="Collision",
        incident_location=None,
        claim_amount=250_000,
        premium_amount=75_000,
        previous_claim_count=0,
        days_since_policy_start=300,
        incident_hour=10,
        repair_cost=200_000,
        supporting_documents_count=None,
        claim_status="Open",
        claim_date=date(2026, 1, 15),
    )

    with session_factory() as session:
        session.add(claim)
        session.commit()
        stored = session.scalar(select(Claim).where(Claim.claim_id == "CLM-TEST-1"))

    assert stored is not None
    assert stored.incident_location is None
    assert stored.supporting_documents_count is None
    engine.dispose()


def test_claim_schema_rejects_impossible_policy_timing():
    data = {
        "claim_id": "CLM-TEST-2",
        "policy_id": "POL-TEST-2",
        "customer_id": "CUS-TEST-2",
        "vehicle_age": 4,
        "vehicle_type": "Car",
        "vehicle_value": 2_000_000,
        "policy_age_days": 20,
        "incident_type": "Collision",
        "claim_amount": 250_000,
        "premium_amount": 75_000,
        "previous_claim_count": 0,
        "days_since_policy_start": 21,
        "incident_hour": 10,
        "repair_cost": 200_000,
        "claim_date": "2026-01-15",
    }

    try:
        ClaimCreate.model_validate(data)
    except ValueError as error:
        assert "cannot exceed policy_age_days" in str(error)
    else:
        raise AssertionError("policy timing validation should reject invalid claim")


def test_claim_schema_rejects_invalid_incident_hour():
    data = {
        "claim_id": "CLM-TEST-3",
        "policy_id": "POL-TEST-3",
        "customer_id": "CUS-TEST-3",
        "vehicle_age": 4,
        "vehicle_type": "Car",
        "vehicle_value": 2_000_000,
        "policy_age_days": 20,
        "incident_type": "Collision",
        "claim_amount": 250_000,
        "premium_amount": 75_000,
        "previous_claim_count": 0,
        "days_since_policy_start": 10,
        "incident_hour": 24,
        "repair_cost": 200_000,
        "claim_date": "2026-01-15",
    }

    try:
        ClaimCreate.model_validate(data)
    except ValueError as error:
        assert "incident_hour" in str(error)
    else:
        raise AssertionError("incident hour validation should reject invalid claim")
