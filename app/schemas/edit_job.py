import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class EditJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    batch_id: uuid.UUID
    user_id: uuid.UUID
    position: int
    status: str
    ai_model: str
    original_filename: str
    error_message: str | None
    duration_ms: int | None
    cost_usd: Decimal | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime

    # Leído del ORM pero nunca enviado al cliente
    result_path: str | None = Field(default=None, exclude=True)

    @computed_field
    @property
    def has_result(self) -> bool:
        return self.result_path is not None
