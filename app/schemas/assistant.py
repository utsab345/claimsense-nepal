from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssistantQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=3, max_length=500)

    @field_validator("question")
    @classmethod
    def normalize_question(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 3:
            raise ValueError("question must contain at least 3 non-whitespace characters")
        return normalized


class AssistantAnswer(BaseModel):
    answer: str
    citations: list[str]
    supported: bool = True
    claim_ids: list[str] = Field(default_factory=list)
    calculation: str | None = None
    tool: str = "unsupported"
    follow_ups: list[str] = Field(default_factory=list)
