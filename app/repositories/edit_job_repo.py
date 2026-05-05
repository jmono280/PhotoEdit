import uuid
from datetime import datetime, timezone

from sqlalchemy import case, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.edit_job import EditJob

_UPDATABLE_FIELDS = frozenset(
    {
        "result_path",
        "result_size_bytes",
        "error_message",
        "duration_ms",
        "cost_usd",
        "started_at",
        "finished_at",
    }
)


class EditJobRepository:
    async def create_many(
        self, db: AsyncSession, jobs_data: list[dict]
    ) -> list[EditJob]:
        jobs = [EditJob(**data) for data in jobs_data]
        db.add_all(jobs)
        await db.commit()
        for job in jobs:
            await db.refresh(job)
        return jobs

    async def get_by_id(
        self, db: AsyncSession, job_id: uuid.UUID
    ) -> EditJob | None:
        result = await db.execute(
            select(EditJob).where(
                EditJob.id == job_id, EditJob.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def list_by_batch(
        self,
        db: AsyncSession,
        batch_id: uuid.UUID,
        ordered_by_position: bool = True,
    ) -> list[EditJob]:
        stmt = select(EditJob).where(
            EditJob.batch_id == batch_id, EditJob.deleted_at.is_(None)
        )
        if ordered_by_position:
            stmt = stmt.order_by(EditJob.position)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def update_status(
        self,
        db: AsyncSession,
        job_id: uuid.UUID,
        status: str,
        **fields,
    ) -> None:
        unknown = set(fields) - _UPDATABLE_FIELDS
        if unknown:
            raise ValueError(f"Unknown job fields: {unknown}")

        await db.execute(
            update(EditJob)
            .where(EditJob.id == job_id)
            .values(status=status, **fields)
        )
        await db.commit()

    async def soft_delete_by_batch(
        self, db: AsyncSession, batch_id: uuid.UUID
    ) -> None:
        await db.execute(
            update(EditJob)
            .where(EditJob.batch_id == batch_id, EditJob.deleted_at.is_(None))
            .values(deleted_at=datetime.now(timezone.utc))
        )
        await db.commit()

    async def get_progress_summary(
        self, db: AsyncSession, batch_id: uuid.UUID
    ) -> dict:
        row = (
            await db.execute(
                select(
                    func.count().label("total"),
                    func.count(
                        case((EditJob.status == "completed", 1))
                    ).label("completed"),
                    func.count(
                        case((EditJob.status == "failed", 1))
                    ).label("failed"),
                    func.count(
                        case((EditJob.status == "processing", 1))
                    ).label("processing"),
                    func.count(
                        case((EditJob.status == "pending", 1))
                    ).label("pending"),
                ).where(
                    EditJob.batch_id == batch_id,
                    EditJob.deleted_at.is_(None),
                )
            )
        ).one()

        return {
            "total": row.total,
            "completed": row.completed,
            "failed": row.failed,
            "processing": row.processing,
            "pending": row.pending,
        }
