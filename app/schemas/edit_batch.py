import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.schemas.edit_job import EditJobOut


class EditBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    prompt: str
    ai_model: str
    total_images: int
    completed_count: int
    failed_count: int
    status: str
    started_at: datetime | None
    finished_at: datetime | None
    total_cost_usd: Decimal | None
    created_at: datetime


class EditBatchDetailOut(EditBatchOut):
    jobs: list[EditJobOut]


class JobProgressItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    position: int
    status: str
    original_filename: str


class BatchProgressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    batch_id: uuid.UUID
    status: str
    total: int
    completed: int
    failed: int
    processing: int
    pending: int
    has_overlay: bool = False
    jobs: list[JobProgressItem]
