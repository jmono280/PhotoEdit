import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ApiUsageLog(TimestampMixin, Base):
    __tablename__ = "api_usage_log"

    edit_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("edit_jobs.id"), nullable=False
    )
    ai_model: Mapped[str] = mapped_column(String(100), nullable=False)
    request_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    response_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    http_status: Mapped[int] = mapped_column(Integer, nullable=False)
    response_size: Mapped[int] = mapped_column(Integer, nullable=False)
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
