import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.api_usage_log import ApiUsageLog


class UsageLogRepository:
    async def create(
        self,
        db: AsyncSession,
        edit_job_id: uuid.UUID,
        ai_model: str,
        request_at: datetime,
        response_at: datetime,
        http_status: int,
        response_size: int,
        error_detail: str | None = None,
    ) -> ApiUsageLog:
        log = ApiUsageLog(
            edit_job_id=edit_job_id,
            ai_model=ai_model,
            request_at=request_at,
            response_at=response_at,
            http_status=http_status,
            response_size=response_size,
            error_detail=error_detail,
        )
        db.add(log)
        await db.commit()
        await db.refresh(log)
        return log
