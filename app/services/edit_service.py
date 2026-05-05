import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.edit_job import EditJob
from app.repositories.edit_job_repo import EditJobRepository
from app.repositories.usage_log_repo import UsageLogRepository
from app.services.ai.base import AIImageProvider

logger = logging.getLogger(__name__)


class EditService:
    def __init__(
        self,
        job_repo: EditJobRepository,
        usage_repo: UsageLogRepository,
        ai: AIImageProvider,
    ) -> None:
        self.job_repo = job_repo
        self.usage_repo = usage_repo
        self.ai = ai

    async def process_single_job(
        self, db: AsyncSession, job: EditJob, prompt: str
    ) -> None:
        # Inicializado aquí para que siempre esté definido en el bloque except,
        # incluso si el error ocurre antes de la llamada a la API.
        request_at = datetime.now(timezone.utc)

        try:
            # 1. Marcar processing
            await self.job_repo.update_status(
                db, job.id, "processing", started_at=request_at
            )

            # 2. Leer archivo original desde disco
            original_bytes = Path(job.original_path).read_bytes()
            mime, _ = mimetypes.guess_type(job.original_filename)
            if mime is None:
                mime = "image/jpeg"

            # 3. Llamar al proveedor de IA
            request_at = datetime.now(timezone.utc)
            result = await self.ai.edit_image(original_bytes, prompt, mime)
            response_at = datetime.now(timezone.utc)

            # 4. Guardar resultado en disco
            result_path = settings.upload_results_dir / f"{job.id}.png"
            result_path.parent.mkdir(parents=True, exist_ok=True)
            result_path.write_bytes(result.image_bytes)

            # 5. Marcar completed
            await self.job_repo.update_status(
                db,
                job.id,
                "completed",
                result_path=str(result_path),
                result_size_bytes=len(result.image_bytes),
                duration_ms=result.duration_ms,
                cost_usd=result.cost_usd,
                finished_at=response_at,
            )

            # 6. Registrar en api_usage_log
            await self.usage_repo.create(
                db,
                edit_job_id=job.id,
                ai_model=result.model,
                request_at=request_at,
                response_at=response_at,
                http_status=result.http_status,
                response_size=result.response_size,
            )

        except Exception as exc:
            now = datetime.now(timezone.utc)
            error_msg = str(exc)[:500]
            logger.exception("Job %s failed: %s", job.id, error_msg)

            # El bloque de limpieza también puede fallar (BD caída, etc.).
            # Un segundo try/except garantiza que este método NUNCA propague.
            try:
                await self.job_repo.update_status(
                    db,
                    job.id,
                    "failed",
                    error_message=error_msg,
                    finished_at=now,
                )
                await self.usage_repo.create(
                    db,
                    edit_job_id=job.id,
                    ai_model=settings.OPENROUTER_MODEL,
                    request_at=request_at,
                    response_at=now,
                    http_status=0,
                    response_size=0,
                    error_detail=str(exc)[:1000],
                )
            except Exception:
                logger.exception(
                    "Failed to persist error state for job %s — job may be stuck in 'processing'",
                    job.id,
                )
