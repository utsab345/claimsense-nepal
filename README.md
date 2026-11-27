# ClaimSense Nepal

ClaimSense Nepal is an explainable motor insurance claim triage and analytics MVP. It provides claim management, analyst-oriented review priorities, trend summaries, and a database-grounded question assistant.

All records are synthetic, generated for this project, and do not represent actual insurance customers or Nepal insurance industry statistics.

## Problem statement

Claims teams need a consistent way to organize claims, find records that deserve manual review, and understand portfolio patterns. ClaimSense combines transparent business-rule indicators with a statistical outlier signal. It is decision support only. It does not determine coverage, prove fraud, or automatically reject claims.

## Features

- Generate 2,500 reproducible synthetic motor claims.
- Store and manage claims in SQLite through a FastAPI REST API.
- Paginate and filter claims by status, incident type, risk level, and identifier.
- Score claims from 0 to 100 and return an explanation for every triggered indicator.
- Use a standardized Isolation Forest model when at least 50 historical claims are available.
- Review aggregated claim amounts, claim trends, incident patterns, risk scores, and the high-priority queue.
- Ask a limited set of natural-language questions answered by predefined, read-only database queries.
- Run the API and Streamlit dashboard locally or with Docker Compose.

## Architecture

<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/8d98b3d1-abf8-46e2-bb17-a0111a485412" />


The service layer owns claim reads and writes. The analytics and assistant services use fixed SQLAlchemy expressions against the same SQLite database. The assistant cannot run user-supplied SQL.

## Technology stack

- Python 3.12
- FastAPI, Pydantic, SQLAlchemy, SQLite
- Pandas, Scikit-learn, Faker
- Streamlit, Plotly
- Pytest and FastAPI TestClient
- Docker and Docker Compose

## Dataset generation

Regenerate the CSV from the project root:

```bash
python scripts/generate_data.py
```

The default output is `data/generated/claims.csv`, containing 2,500 rows. Use `--count`, `--seed`, and `--output` to customize generation. The seed defaults to `20261125`. The generated file is committed so the application can start without a separate data-generation step.

### Synthetic data assumptions

- The reference date is fixed at 25 November 2026. A claim date is derived from the synthetic policy age and days since policy start.
- Vehicle types are sampled with fixed weights: motorcycle 45%, car 28%, SUV 12%, pickup 9%, and commercial 6%. Values are drawn from type-specific ranges.
- Premiums are generated from vehicle value using a 2.2% to 4.5% range with type-specific minimum amounts. These are modeling assumptions, not market rates.
- Claim severity begins in a 2.5% to 38% vehicle-value range and is adjusted by incident type. Repair cost is generated at 72% to 100% of claim amount.
- Incident categories have fixed sampling weights, with collision more common than the other generated categories. Locations are a fixed list of Nepal city names.
- Previous claim counts, vehicle ages, incident hours, documents, and claim statuses use fixed probability distributions in `scripts/generate_data.py`.
- Five percent of rows, rounded to at least one, are randomly selected for deliberately unusual patterns: claim amount above vehicle value, repeated prior claims, a very early claim, a high claim-to-premium ratio, or an overnight incident.
- Supporting-document counts are missing for about 1.2% of rows. Incident locations are missing for about 0.3%. These values remain nullable. Required monetary fields are checked for positive values, and generation fails if required rows are invalid.
- Identifiers are synthetic and do not contain real customer names or contact details.

These distributions are chosen to exercise application behavior. They must not be interpreted as measured insurance, accident, fraud, pricing, or demographic rates in Nepal.

### Data dictionary

| Field | Meaning |
| --- | --- |
| `claim_id` | Unique synthetic claim identifier |
| `policy_id` | Synthetic policy identifier |
| `customer_id` | Synthetic customer identifier |
| `vehicle_age` | Vehicle age in years |
| `vehicle_type` | Motorcycle, car, SUV, pickup, or commercial |
| `vehicle_value` | Declared vehicle value in NPR |
| `policy_age_days` | Policy age in days at the claim event |
| `incident_type` | Collision, theft, flood, fire, glass damage, or vandalism |
| `incident_location` | Synthetic city name, nullable |
| `claim_amount` | Claimed amount in NPR |
| `premium_amount` | Synthetic premium amount in NPR |
| `previous_claim_count` | Prior claim count for the synthetic customer |
| `days_since_policy_start` | Days between policy start and incident |
| `incident_hour` | Local incident hour from 0 through 23 |
| `repair_cost` | Synthetic estimated repair cost in NPR |
| `supporting_documents_count` | Recorded document count, nullable |
| `claim_status` | Open, Under Review, Approved, Rejected, or Paid |
| `claim_date` | Synthetic incident date in ISO format |

The API also returns generated assessment fields: `risk_score`, `review_priority`, `is_anomaly`, and `risk_indicators`. They are stored in SQLite and are not part of the source CSV.

## Risk scoring methodology

The score is an additive review signal capped at 100. Default indicator points are:

| Indicator | Default trigger | Points |
| --- | --- | --- |
| Claim relative to vehicle value | At least 75%: 25 points; at least 40%: 15 points | 25 or 15 |
| Previous claims | At least 3: 15 points; 2: 7 points | 15 or 7 |
| Early claim | Within 14 days: 20 points; within 60 days: 10 points | 20 or 10 |
| Claim relative to premium | At least 15x: 15 points; at least 8x: 7 points | 15 or 7 |
| Supporting documents | Missing or zero: 10 points; one document: 5 points | 10 or 5 |
| Overnight incident | 00:00 through 04:00 | 5 |
| Isolation Forest outlier | Flagged relative to available claim history | 20 |

Every triggered indicator includes its code, label, explanation, and points. Defaults are configurable through `.env` values shown in `.env.example`, including thresholds, indicator weights, and priority boundaries. The Python `RiskEngine` also accepts explicit `Settings` and `RiskWeights` objects.

The anomaly model standardizes claim-to-vehicle ratio, claim-to-premium ratio, previous claim count, policy tenure ratio, incident hour, document count, and repair-to-claim ratio. It uses 150 Isolation Forest trees and a fixed random state. It is not fitted when fewer than 50 other claims are available. The score and anomaly flag are separate: an anomaly is an unusual statistical pattern, not evidence of fraud. Scores never change claim status automatically.

The defaults are transparent heuristics for demonstrating the workflow. They have not been calibrated against real claims or validated for underwriting, fraud detection, or customer decisions.

## Assistant architecture

`POST /assistant/ask` recognizes supported question types and runs predefined SQLAlchemy queries for counts, averages, incident comparisons, early-policy claims, stored anomaly results, and stored claim explanations. Answers include a database citation or claim ID. Unsupported questions receive an explicit response. It does not execute generated SQL, alter records, or send claim information to a third-party model. No LLM key or network access is required.

The assistant has intentionally limited language coverage. It can only answer from the supported query set and stored assessments. Claims that have not been assessed are not described as detected anomalies.

## API endpoints

Swagger UI is available at `http://localhost:8000/docs`; ReDoc is at `http://localhost:8000/redoc`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/claims` | Filter and paginate claims |
| `GET` | `/claims/{claim_id}` | Retrieve a claim |
| `POST` | `/claims` | Validate and create a claim |
| `GET` | `/claims/analytics/overview` | Portfolio totals and review distribution |
| `GET` | `/claims/analytics/trends` | Monthly, incident, and status aggregates |
| `GET` | `/claims/analytics/risk-distribution` | Priority counts, score histogram, and anomaly count |
| `GET` | `/claims/high-risk` | High-priority review queue |
| `POST` | `/claims/{claim_id}/assess` | Assess and store a claim score and explanations |
| `POST` | `/assistant/ask` | Ask a supported database-grounded question |

`GET /claims` accepts `limit` (1 to 100), `offset`, `status`, `incident_type`, `risk_level`, and `search` query parameters.

## Local setup

Python 3.12 is recommended.

```bash
git clone https://github.com/utsab345/claimsense-nepal.git
cd claimsense-nepal
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python scripts/generate_data.py
```

The API creates `claimsense.db` and seeds it from the CSV on first startup if the database is empty. Existing database records are not overwritten.

### Run the backend

```bash
uvicorn app.main:app --reload
```

### Run the dashboard

In another terminal with the environment activated:

```bash
streamlit run dashboard/app.py
```

Open `http://localhost:8501`. Set `API_BASE_URL` if the API is hosted at a different address.

### Run tests

```bash
python -m pytest -q
```

## Environment configuration

Copy `.env.example` to `.env`. `DATABASE_URL` and `DATASET_PATH` choose the SQLite URL and seed CSV. The remaining `RISK_*` settings control score thresholds, rule cutoffs, points, and priority boundaries. `API_BASE_URL` controls the dashboard API address.

## Docker

Docker Compose starts the API and dashboard and persists SQLite in a named volume:

```bash
docker compose up --build
```

Open `http://localhost:8501` for the dashboard and `http://localhost:8000/docs` for the API. Stop services with `docker compose down`. The named database volume is retained unless explicitly removed.

## Limitations

- The dataset and its distributions are entirely synthetic and do not represent actual insurance customers or Nepal industry statistics.
- Scoring thresholds and points are configurable heuristics, not validated actuarial or fraud models.
- Isolation Forest output depends on the available synthetic claim history and should only prioritize human review.
- The assistant supports a limited intent set and cannot answer arbitrary natural-language questions.
- SQLite is suitable for a local assessment MVP, not a multi-user production workload.
- The project does not include authentication, role permissions, audit trails, claim document storage, or a claims decision workflow.

## Future improvements

- Calibrate and validate thresholds using appropriately governed, anonymized insurer data.
- Add authenticated analyst roles, audit history, and a controlled claim review workflow.
- Evaluate database and deployment choices for concurrent production use.
- Expand assistant language coverage while retaining predefined, read-only data tools and answer citations.
- Add monitoring and model performance review before using scores in operational decisions.
