from pydantic import BaseModel, ConfigDict, Field


class AssistantQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=3, max_length=500)


class AssistantAnswer(BaseModel):
    answer: str
    citations: list[str]
    supported: bool = True
    claim_ids: list[str] = Field(default_factory=list)
    calculation: str | None = None
