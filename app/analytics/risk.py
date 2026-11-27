from dataclasses import dataclass
from typing import Sequence

import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.core.config import Settings, get_settings
from app.models import Claim
from app.schemas.claim import ClaimCreate, RiskAssessment, RiskIndicator


@dataclass(frozen=True)
class RiskWeights:
    high_claim_vehicle_ratio: int = 25
    moderate_claim_vehicle_ratio: int = 15
    repeated_claims: int = 15
    early_claim: int = 20
    elevated_claim_premium_ratio: int = 15
    missing_documents: int = 10
    limited_documents: int = 5
    overnight_incident: int = 5


ClaimLike = Claim | ClaimCreate


class RiskEngine:
    def __init__(self, settings: Settings | None = None, weights: RiskWeights | None = None):
        self.settings = settings or get_settings()
        self.weights = weights or RiskWeights(
            high_claim_vehicle_ratio=self.settings.risk_points_claim_vehicle_high,
            moderate_claim_vehicle_ratio=self.settings.risk_points_claim_vehicle_medium,
            repeated_claims=self.settings.risk_points_repeated_claims,
            early_claim=self.settings.risk_points_early_claim,
            elevated_claim_premium_ratio=self.settings.risk_points_claim_premium,
            missing_documents=self.settings.risk_points_missing_documents,
            limited_documents=self.settings.risk_points_limited_documents,
            overnight_incident=self.settings.risk_points_overnight_incident,
        )

    def assess(self, claim: ClaimLike, history: Sequence[ClaimLike]) -> RiskAssessment:
        indicators = self._rule_indicators(claim)
        is_anomaly = self._is_statistical_anomaly(claim, history)
        if is_anomaly:
            indicators.append(
                RiskIndicator(
                    code="statistical_anomaly",
                    label="Statistical outlier",
                    explanation="Isolation Forest identified an unusual combination of claim features relative to the available claim history. This is not evidence of fraud.",
                    points=self.settings.risk_anomaly_weight,
                )
            )
        score = min(100, sum(indicator.points for indicator in indicators))
        if score >= self.settings.risk_high_threshold:
            priority = "High"
        elif score >= self.settings.risk_medium_threshold:
            priority = "Medium"
        else:
            priority = "Low"
        return RiskAssessment(
            claim_id=claim.claim_id,
            risk_score=score,
            review_priority=priority,
            is_anomaly=is_anomaly,
            risk_indicators=indicators,
        )

    def assess_batch(self, claims: Sequence[ClaimLike]) -> list[RiskAssessment]:
        if not claims:
            return []
        anomalies = self._batch_anomalies(claims)
        results = []
        for claim, is_anomaly in zip(claims, anomalies):
            indicators = self._rule_indicators(claim)
            if is_anomaly:
                indicators.append(
                    RiskIndicator(
                        code="statistical_anomaly",
                        label="Statistical outlier",
                        explanation="Isolation Forest identified an unusual combination of claim features relative to the available claim history. This is not evidence of fraud.",
                        points=self.settings.risk_anomaly_weight,
                    )
                )
            score = min(100, sum(indicator.points for indicator in indicators))
            if score >= self.settings.risk_high_threshold:
                priority = "High"
            elif score >= self.settings.risk_medium_threshold:
                priority = "Medium"
            else:
                priority = "Low"
            results.append(
                RiskAssessment(
                    claim_id=claim.claim_id,
                    risk_score=score,
                    review_priority=priority,
                    is_anomaly=is_anomaly,
                    risk_indicators=indicators,
                )
            )
        return results

    def _rule_indicators(self, claim: ClaimLike) -> list[RiskIndicator]:
        indicators = []
        claim_vehicle_ratio = claim.claim_amount / claim.vehicle_value
        if claim_vehicle_ratio >= self.settings.risk_claim_vehicle_ratio_high:
            indicators.append(
                RiskIndicator(
                    code="claim_vehicle_ratio_high",
                    label="Claim is high relative to vehicle value",
                    explanation=f"Claim amount is {claim_vehicle_ratio:.0%} of the declared vehicle value, above the configured {self.settings.risk_claim_vehicle_ratio_high:.0%} review threshold.",
                    points=self.weights.high_claim_vehicle_ratio,
                )
            )
        elif claim_vehicle_ratio >= self.settings.risk_claim_vehicle_ratio_medium:
            indicators.append(
                RiskIndicator(
                    code="claim_vehicle_ratio_elevated",
                    label="Claim is elevated relative to vehicle value",
                    explanation=f"Claim amount is {claim_vehicle_ratio:.0%} of the declared vehicle value, above the configured {self.settings.risk_claim_vehicle_ratio_medium:.0%} review threshold.",
                    points=self.weights.moderate_claim_vehicle_ratio,
                )
            )
        if claim.previous_claim_count >= self.settings.risk_repeated_claim_count:
            indicators.append(
                RiskIndicator(
                    code="repeat_claims_high",
                    label="Multiple previous claims",
                    explanation=f"Customer has {claim.previous_claim_count} previous claims, meeting the configured threshold of {self.settings.risk_repeated_claim_count}.",
                    points=self.weights.repeated_claims,
                )
            )
        elif claim.previous_claim_count == 2:
            indicators.append(
                RiskIndicator(
                    code="repeat_claims_elevated",
                    label="Previous claims recorded",
                    explanation="Customer has 2 previous claims.",
                    points=self.weights.repeated_claims // 2,
                )
            )
        if claim.days_since_policy_start <= self.settings.risk_early_claim_days_high:
            indicators.append(
                RiskIndicator(
                    code="early_claim_high",
                    label="Claim soon after policy start",
                    explanation=f"Incident occurred {claim.days_since_policy_start} days after policy start, within the configured {self.settings.risk_early_claim_days_high}-day review window.",
                    points=self.weights.early_claim,
                )
            )
        elif claim.days_since_policy_start <= self.settings.risk_early_claim_days_medium:
            indicators.append(
                RiskIndicator(
                    code="early_claim_elevated",
                    label="Claim relatively soon after policy start",
                    explanation=f"Incident occurred {claim.days_since_policy_start} days after policy start, within the configured {self.settings.risk_early_claim_days_medium}-day review window.",
                    points=self.weights.early_claim // 2,
                )
            )
        claim_premium_ratio = claim.claim_amount / claim.premium_amount
        if claim_premium_ratio >= self.settings.risk_claim_premium_ratio_high:
            indicators.append(
                RiskIndicator(
                    code="claim_premium_ratio_high",
                    label="Claim is high relative to premium",
                    explanation=f"Claim amount is {claim_premium_ratio:.1f} times the recorded premium, above the configured {self.settings.risk_claim_premium_ratio_high:g}x review threshold.",
                    points=self.weights.elevated_claim_premium_ratio,
                )
            )
        elif claim_premium_ratio >= self.settings.risk_claim_premium_ratio_medium:
            indicators.append(
                RiskIndicator(
                    code="claim_premium_ratio_elevated",
                    label="Claim is elevated relative to premium",
                    explanation=f"Claim amount is {claim_premium_ratio:.1f} times the recorded premium, above the configured {self.settings.risk_claim_premium_ratio_medium:g}x review threshold.",
                    points=self.weights.elevated_claim_premium_ratio // 2,
                )
            )
        if claim.supporting_documents_count is None or claim.supporting_documents_count == 0:
            indicators.append(
                RiskIndicator(
                    code="documents_missing",
                    label="Supporting documents missing",
                    explanation="No supporting documents are recorded for this claim.",
                    points=self.weights.missing_documents,
                )
            )
        elif claim.supporting_documents_count == 1:
            indicators.append(
                RiskIndicator(
                    code="documents_limited",
                    label="Limited supporting documents",
                    explanation="Only 1 supporting document is recorded.",
                    points=self.weights.limited_documents,
                )
            )
        if claim.incident_hour <= 4:
            indicators.append(
                RiskIndicator(
                    code="overnight_incident",
                    label="Overnight incident time",
                    explanation=f"Incident was recorded at {claim.incident_hour:02d}:00, within the configured 00:00-04:00 review window.",
                    points=self.weights.overnight_incident,
                )
            )
        return indicators

    def _is_statistical_anomaly(self, claim: ClaimLike, history: Sequence[ClaimLike]) -> bool:
        if len(history) < 50:
            return False
        training_values = pd.DataFrame([self._features(item) for item in history])
        model = make_pipeline(
            StandardScaler(),
            IsolationForest(n_estimators=150, contamination="auto", random_state=42),
        )
        model.fit(training_values)
        return bool(model.predict(pd.DataFrame([self._features(claim)]))[0] == -1)

    def _batch_anomalies(self, claims: Sequence[ClaimLike]) -> list[bool]:
        if len(claims) < 50:
            return [False] * len(claims)
        training_values = pd.DataFrame([self._features(item) for item in claims])
        model = make_pipeline(
            StandardScaler(),
            IsolationForest(n_estimators=150, contamination="auto", random_state=42),
        )
        model.fit(training_values)
        return [bool(value == -1) for value in model.predict(training_values)]

    @staticmethod
    def _features(claim: ClaimLike) -> dict[str, float]:
        return {
            "claim_vehicle_ratio": claim.claim_amount / claim.vehicle_value,
            "claim_premium_ratio": claim.claim_amount / claim.premium_amount,
            "previous_claim_count": float(claim.previous_claim_count),
            "policy_tenure_ratio": claim.days_since_policy_start / claim.policy_age_days,
            "incident_hour": float(claim.incident_hour),
            "supporting_documents_count": float(claim.supporting_documents_count or 0),
            "repair_claim_ratio": claim.repair_cost / claim.claim_amount,
        }
