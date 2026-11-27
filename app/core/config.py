from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./claimsense.db"
    dataset_path: str = "data/generated/claims.csv"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    api_version: str = "2.0.0"
    risk_anomaly_weight: int = Field(default=20, ge=0, le=50)
    risk_high_threshold: int = Field(default=70, ge=1, le=100)
    risk_medium_threshold: int = Field(default=40, ge=0, le=99)
    risk_claim_vehicle_ratio_high: float = Field(default=0.75, gt=0)
    risk_claim_vehicle_ratio_medium: float = Field(default=0.4, gt=0)
    risk_repeated_claim_count: int = Field(default=3, ge=1)
    risk_early_claim_days_high: int = Field(default=14, ge=0)
    risk_early_claim_days_medium: int = Field(default=60, ge=1)
    risk_claim_premium_ratio_high: float = Field(default=15, gt=0)
    risk_claim_premium_ratio_medium: float = Field(default=8, gt=0)
    risk_points_claim_vehicle_high: int = Field(default=25, ge=0, le=100)
    risk_points_claim_vehicle_medium: int = Field(default=15, ge=0, le=100)
    risk_points_repeated_claims: int = Field(default=15, ge=0, le=100)
    risk_points_early_claim: int = Field(default=20, ge=0, le=100)
    risk_points_claim_premium: int = Field(default=15, ge=0, le=100)
    risk_points_missing_documents: int = Field(default=10, ge=0, le=100)
    risk_points_limited_documents: int = Field(default=5, ge=0, le=100)
    risk_points_overnight_incident: int = Field(default=5, ge=0, le=100)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_risk_thresholds(self):
        if self.risk_medium_threshold >= self.risk_high_threshold:
            raise ValueError("risk_medium_threshold must be lower than risk_high_threshold")
        if self.risk_claim_vehicle_ratio_medium >= self.risk_claim_vehicle_ratio_high:
            raise ValueError("risk_claim_vehicle_ratio_medium must be lower than risk_claim_vehicle_ratio_high")
        if self.risk_claim_premium_ratio_medium >= self.risk_claim_premium_ratio_high:
            raise ValueError("risk_claim_premium_ratio_medium must be lower than risk_claim_premium_ratio_high")
        if self.risk_early_claim_days_medium <= self.risk_early_claim_days_high:
            raise ValueError("risk_early_claim_days_medium must exceed risk_early_claim_days_high")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
