import argparse
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd
from faker import Faker


DEFAULT_COUNT = 2500
DEFAULT_SEED = 20261125
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "generated" / "claims.csv"
REFERENCE_DATE = date(2026, 11, 25)
VEHICLE_TYPES = {
    "Motorcycle": (180_000, 2_500_000, 18_000),
    "Car": (900_000, 12_000_000, 65_000),
    "SUV": (2_000_000, 22_000_000, 110_000),
    "Pickup": (1_200_000, 10_000_000, 85_000),
    "Commercial": (2_500_000, 30_000_000, 180_000),
}
INCIDENT_TYPES = ("Collision", "Theft", "Flood", "Fire", "Glass Damage", "Vandalism")
LOCATIONS = (
    "Kathmandu",
    "Lalitpur",
    "Bhaktapur",
    "Pokhara",
    "Biratnagar",
    "Birgunj",
    "Bharatpur",
    "Butwal",
    "Dharan",
    "Nepalgunj",
    "Hetauda",
    "Dhangadhi",
)
CLAIM_COLUMNS = (
    "claim_id",
    "policy_id",
    "customer_id",
    "vehicle_age",
    "vehicle_type",
    "vehicle_value",
    "policy_age_days",
    "incident_type",
    "incident_location",
    "claim_amount",
    "premium_amount",
    "previous_claim_count",
    "days_since_policy_start",
    "incident_hour",
    "repair_cost",
    "supporting_documents_count",
    "claim_status",
    "claim_date",
)


def generate_claims(count: int = DEFAULT_COUNT, seed: int = DEFAULT_SEED) -> pd.DataFrame:
    if count < 1:
        raise ValueError("count must be at least 1")
    rng = random.Random(seed)
    faker = Faker("en_US")
    faker.seed_instance(seed)
    unusual_count = max(1, round(count * 0.05))
    unusual_indices = set(rng.sample(range(count), unusual_count))
    rows = []

    for index in range(count):
        unusual = index in unusual_indices
        vehicle_type = rng.choices(
            list(VEHICLE_TYPES),
            weights=(0.45, 0.28, 0.12, 0.09, 0.06),
            k=1,
        )[0]
        minimum_value, maximum_value, base_premium = VEHICLE_TYPES[vehicle_type]
        vehicle_value = round(rng.triangular(minimum_value, maximum_value, minimum_value * 1.8), 2)
        premium_amount = round(
            max(4_000, vehicle_value * rng.uniform(0.022, 0.045), base_premium * rng.uniform(0.8, 1.3)),
            2,
        )
        policy_age_days = rng.randint(30, 2500)
        previous_claim_count = rng.choices((0, 1, 2, 3, 4), weights=(0.49, 0.30, 0.14, 0.05, 0.02), k=1)[0]
        incident_type = rng.choices(INCIDENT_TYPES, weights=(0.52, 0.10, 0.08, 0.05, 0.17, 0.08), k=1)[0]
        days_since_policy_start = rng.randint(1, policy_age_days)
        incident_hour = rng.choices(range(24), weights=(2, 1, 1, 1, 1, 1, 2, 4, 6, 6, 5, 5, 5, 5, 5, 5, 6, 6, 6, 5, 4, 3, 2, 2), k=1)[0]
        severity = rng.uniform(0.025, 0.38)
        severity *= {"Collision": 1.25, "Theft": 0.92, "Flood": 1.1, "Fire": 1.15, "Glass Damage": 0.22, "Vandalism": 0.45}[incident_type]
        claim_amount = vehicle_value * severity * rng.uniform(0.72, 1.15)

        if unusual:
            pattern = index % 5
            if pattern == 0:
                claim_amount = vehicle_value * rng.uniform(1.05, 1.6)
            elif pattern == 1:
                previous_claim_count = rng.randint(4, 8)
            elif pattern == 2:
                days_since_policy_start = rng.randint(1, min(12, policy_age_days))
            elif pattern == 3:
                claim_amount = premium_amount * rng.uniform(15, 35)
            else:
                incident_hour = rng.choice((0, 1, 2, 3, 4))

        claim_amount = round(max(1_000, claim_amount), 2)
        repair_cost = round(claim_amount * rng.uniform(0.72, 1.0), 2)
        document_count = rng.choices((0, 1, 2, 3, 4), weights=(0.035, 0.15, 0.34, 0.31, 0.165), k=1)[0]
        if rng.random() < 0.012:
            document_count = None
        status_weights = (0.25, 0.24, 0.22, 0.08, 0.21) if unusual else (0.24, 0.12, 0.25, 0.07, 0.32)
        claim_status = rng.choices(("Open", "Under Review", "Approved", "Rejected", "Paid"), weights=status_weights, k=1)[0]
        claim_date = REFERENCE_DATE - timedelta(days=policy_age_days - days_since_policy_start)

        rows.append(
            {
                "claim_id": f"CLM-{index + 1:05d}",
                "policy_id": f"POL-{faker.unique.bothify(text='????-#####').upper()}",
                "customer_id": f"CUS-{faker.unique.bothify(text='????-#####').upper()}",
                "vehicle_age": rng.randint(0, 22),
                "vehicle_type": vehicle_type,
                "vehicle_value": vehicle_value,
                "policy_age_days": policy_age_days,
                "incident_type": incident_type,
                "incident_location": rng.choice(LOCATIONS) if rng.random() >= 0.003 else None,
                "claim_amount": claim_amount,
                "premium_amount": premium_amount,
                "previous_claim_count": previous_claim_count,
                "days_since_policy_start": days_since_policy_start,
                "incident_hour": incident_hour,
                "repair_cost": repair_cost,
                "supporting_documents_count": document_count,
                "claim_status": claim_status,
                "claim_date": claim_date.isoformat(),
            }
        )

    dataframe = pd.DataFrame(rows, columns=CLAIM_COLUMNS)
    dataframe = dataframe.dropna(subset=("claim_id", "claim_amount", "vehicle_value", "claim_date"))
    if len(dataframe) != count:
        raise ValueError(f"generated {len(dataframe)} valid rows; expected {count}")
    if (dataframe["claim_amount"] <= 0).any() or (dataframe["vehicle_value"] <= 0).any():
        raise ValueError("generated monetary values must be positive")
    return dataframe


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    arguments = parser.parse_args()
    dataframe = generate_claims(arguments.count, arguments.seed)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    dataframe.to_csv(arguments.output, index=False)
    print(f"Wrote {len(dataframe)} synthetic claims to {arguments.output}")


if __name__ == "__main__":
    main()
