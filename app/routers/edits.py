import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.database import get_db
from app.models.user import User
from app.repositories.edit_batch_repo import EditBatchRepository
from app.repositories.edit_job_repo import EditJobRepository
from app.repositories.usage_log_repo import UsageLogRepository
from app.schemas.edit_job import EditJobOut
from app.services.ai.openrouter import OpenRouterImageEditor
from app.services.batch_service import BatchService
from app.services.edit_service import EditService

router = APIRouter(prefix="/edits", tags=["edits"])

_batch_repo = EditBatchRepository()
_job_repo = EditJobRepository()
_usage_repo = UsageLogRepository()
_ai = OpenRouterImageEditor()
_edit_service = EditService(_job_repo, _usage_repo, _ai)
_batch_service = BatchService(_batch_repo, _job_repo, _edit_service)


def _resolve_safe(stored_path: str, allowed_dir: Path) -> Path:
    """Resuelve el path y verifica que esté dentro de allowed_dir (anti path traversal)."""
    resolved = Path(stored_path).resolve()
    if not str(resolved).startswith(str(allowed_dir)):
        raise HTTPException(400, "Ruta de archivo inválida")
    return resolved


@router.get("/{job_id}", response_model=EditJobOut)
async def get_job(
    job_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EditJobOut:
    job = await _job_repo.get_by_id(db, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404)
    return EditJobOut.model_validate(job)


@router.get("/{job_id}/original")
async def get_original(
    job_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    job = await _job_repo.get_by_id(db, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404)
    path = _resolve_safe(job.original_path, settings.upload_originals_dir)
    if not path.exists():
        raise HTTPException(404, "Archivo original no encontrado")
    return FileResponse(path, filename=job.original_filename)


@router.get("/{job_id}/result")
async def get_result(
    job_id: uuid.UUID,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    job = await _job_repo.get_by_id(db, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404)
    if job.status != "completed" or not job.result_path:
        raise HTTPException(404, "Resultado aún no disponible")
    path = _resolve_safe(job.result_path, settings.upload_results_dir)
    if not path.exists():
        raise HTTPException(404, "Archivo de resultado no encontrado en disco")
    return FileResponse(path, filename=f"result_{job.original_filename}")


@router.post("/{job_id}/retry", response_model=EditJobOut, status_code=202)
async def retry_job(
    job_id: uuid.UUID,
    background: BackgroundTasks,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EditJobOut:
    job = await _job_repo.get_by_id(db, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404)
    if job.status != "failed":
        raise HTTPException(400, "Solo se pueden reintentar jobs fallidos")

    await _job_repo.update_status(db, job_id, "pending", error_message=None)
    background.add_task(_batch_service.retry_job_task, job_id)

    # Refresh para reflejar el nuevo status en la respuesta
    updated = await _job_repo.get_by_id(db, job_id)
    return EditJobOut.model_validate(updated)
