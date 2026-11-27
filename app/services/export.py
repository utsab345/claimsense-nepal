import csv
import io

from app.models import Claim

FIELDS = [
    "claim_id",
    "policy_id",
    "claim_date",
    "claim_status",
    "incident_type",
    "incident_location",
    "claim_amount",
    "premium_amount",
    "vehicle_type",
    "vehicle_value",
    "risk_score",
    "review_priority",
    "is_anomaly",
]


def claims_to_csv(claims: list[Claim]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(FIELDS)
    for claim in claims:
        writer.writerow([getattr(claim, field) for field in FIELDS])
    return output.getvalue()
