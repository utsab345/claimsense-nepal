from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./claimsense.db"
    dataset_path: str = "data/generated/claims.csv"
    risk_anomaly_weight: int = Field(default=20, ge=0, le=50)
    risk_high_threshold: int = Field(default=70, ge=1, le=100)
    risk_medium_threshold: int = Field(default=40, ge=0, le=99)

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("risk_medium_threshold")
    @classmethod
    def medium_below_high(cls, value: int, info):
        high_threshold = info.data.get("risk_high_threshold")
        if high_threshold is not None and value >= high_threshold:
            raise ValueError("risk_medium_threshold must be lower than risk_high_threshold")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
