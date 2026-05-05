import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.edit_batch import EditBatch
from app.models.edit_job import EditJob


class EditBatchRepository:
    async def create(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        prompt: str,
        ai_model: str,
        total_images: int,
    ) -> EditBatch:
        batch = EditBatch(
            user_id=user_id,
            prompt=prompt,
            ai_model=ai_model,
            total_images=total_images,
        )
        db.add(batch)
        await db.commit()
        await db.refresh(batch)
        return batch

    async def soft_delete(self, db: AsyncSession, batch: EditBatch) -> None:
        batch.deleted_at = datetime.now(timezone.utc)
        await db.commit()

    async def get_by_id(
        self, db: AsyncSession, batch_id: uuid.UUID
    ) -> EditBatch | None:
        result = await db.execute(
            select(EditBatch).where(EditBatch.id == batch_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_for_user(
        self,
        db: AsyncSession,
        batch_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> EditBatch | None:
        result = await db.execute(
            select(EditBatch).where(
                EditBatch.id == batch_id,
                EditBatch.user_id == user_id,
                EditBatch.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        status: str | None,
        page: int,
        limit: int,
    ) -> tuple[list[EditBatch], int]:
        filters = [EditBatch.user_id == user_id, EditBatch.deleted_at.is_(None)]
        if status:
            filters.append(EditBatch.status == status)

        total: int = await db.scalar(
            select(func.count()).select_from(EditBatch).where(*filters)
        ) or 0

        result = await db.execute(
            select(EditBatch)
            .where(*filters)
            .order_by(EditBatch.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        return list(result.scalars().all()), total

    async def mark_processing(self, db: AsyncSession, batch: EditBatch) -> None:
        batch.status = "processing"
        batch.started_at = datetime.now(timezone.utc)
        await db.commit()

    async def increment_completed(
        self, db: AsyncSession, batch_id: uuid.UUID
    ) -> None:
        await db.execute(
            update(EditBatch)
            .where(EditBatch.id == batch_id)
            .values(completed_count=EditBatch.completed_count + 1)
        )
        await db.commit()

    async def increment_failed(
        self, db: AsyncSession, batch_id: uuid.UUID
    ) -> None:
        await db.execute(
            update(EditBatch)
            .where(EditBatch.id == batch_id)
            .values(failed_count=EditBatch.failed_count + 1)
        )
        await db.commit()

    async def finalize(self, db: AsyncSession, batch_id: uuid.UUID) -> EditBatch:
        result = await db.execute(
            select(EditBatch).where(EditBatch.id == batch_id)
        )
        batch = result.scalar_one()

        if batch.failed_count == 0:
            batch.status = "completed"
        elif batch.completed_count == 0:
            batch.status = "failed"
        else:
            batch.status = "partial"

        batch.finished_at = datetime.now(timezone.utc)
        batch.total_cost_usd = await db.scalar(
            select(func.sum(EditJob.cost_usd)).where(
                EditJob.batch_id == batch_id,
                EditJob.deleted_at.is_(None),
            )
        )

        await db.commit()
        await db.refresh(batch)
        return batch
