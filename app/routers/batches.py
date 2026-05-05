import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user
from app.database import get_db
from app.models.edit_batch import EditBatch
from app.models.edit_job import EditJob
from app.models.user import User
from app.repositories.edit_batch_repo import EditBatchRepository
from app.repositories.edit_job_repo import EditJobRepository
from app.repositories.usage_log_repo import UsageLogRepository
from app.schemas.common import Page
from app.schemas.edit_batch import (
    BatchProgressOut,
    EditBatchDetailOut,
    EditBatchOut,
    JobProgressItem,
)
from app.services.ai.openrouter import OpenRouterImageEditor
from app.services.batch_service import BatchService
from app.services.edit_service import EditService

router = APIRouter(prefix="/batches", tags=["batches"])

_batch_repo = EditBatchRepository()
_job_repo = EditJobRepository()
_usage_repo = UsageLogRepository()
_ai = OpenRouterImageEditor()
_edit_service = EditService(_job_repo, _usage_repo, _ai)
_service = BatchService(_batch_repo, _job_repo, _edit_service)


@router.post("/", response_model=EditBatchOut, status_code=201)
async def create_batch(
    background: BackgroundTasks,
    files: list[UploadFile] = File(...),
    prompt: str = Form(...),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EditBatchOut:
    batch = await _service.create_batch(db, user, files, prompt)
    background.add_task(_service.process_batch, batch.id)
    return EditBatchOut.model_validate(batch)


@router.get("/", response_model=Page[EditBatchOut])
async def list_batches(
    page: int = 1,
    limit: int = 20,
    status: str | None = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> Page[EditBatchOut]:
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 20
    items, total = await _batch_repo.list_for_user(db, user.id, status, page, limit)
    return Page[EditBatchOut](
        items=[EditBatchOut.model_validate(b) for b in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{batch_id}/progress", response_model=BatchProgressOut)
async def batch_progress(
    batch_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> BatchProgressOut:
    batch = await _batch_repo.get_by_id_for_user(db, batch_id, user.id)
    if not batch:
        raise HTTPException(404)
    summary = await _job_repo.get_progress_summary(db, batch_id)
    jobs = await _job_repo.list_by_batch(db, batch_id)
    return BatchProgressOut(
        batch_id=batch.id,
        status=batch.status,
        total=summary["total"],
        completed=summary["completed"],
        failed=summary["failed"],
        processing=summary["processing"],
        pending=summary["pending"],
        jobs=[JobProgressItem.model_validate(j) for j in jobs],
    )


@router.get("/{batch_id}", response_model=EditBatchDetailOut)
async def get_batch(
    batch_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EditBatchDetailOut:
    batch = await _batch_repo.get_by_id_for_user(db, batch_id, user.id)
    if not batch:
        raise HTTPException(404)
    return EditBatchDetailOut.model_validate(batch)


@router.delete("/{batch_id}", status_code=204)
async def delete_batch(
    batch_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    batch = await _batch_repo.get_by_id_for_user(db, batch_id, user.id)
    if not batch:
        raise HTTPException(404)
    await _job_repo.soft_delete_by_batch(db, batch_id)
    await _batch_repo.soft_delete(db, batch)
