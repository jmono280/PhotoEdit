from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_active_user
from app.database import get_db
from app.models.user import User
from app.repositories.edit_batch_repo import EditBatchRepository
from app.repositories.edit_job_repo import EditJobRepository
from app.repositories.usage_log_repo import UsageLogRepository
from app.schemas.edit_batch import EditBatchOut
from app.services.ai.openrouter import OpenRouterImageEditor
from app.services.batch_service import BatchService
from app.services.edit_service import EditService

router = APIRouter(prefix="/compose", tags=["compose"])

_batch_repo = EditBatchRepository()
_job_repo = EditJobRepository()
_usage_repo = UsageLogRepository()
_ai = OpenRouterImageEditor()
_edit_service = EditService(_job_repo, _usage_repo, _ai)
_service = BatchService(_batch_repo, _job_repo, _edit_service)


@router.post("/", response_model=EditBatchOut, status_code=201)
async def create_compose(
    background: BackgroundTasks,
    overlay: UploadFile = File(...),
    files: list[UploadFile] = File(...),
    prompt: str = Form(...),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> EditBatchOut:
    batch = await _service.create_compose_batch(db, user, overlay, files, prompt)
    background.add_task(_service.process_compose_batch, batch.id)
    return EditBatchOut.model_validate(batch)
