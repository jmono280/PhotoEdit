import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database import AsyncSessionLocal
from app.models.edit_batch import EditBatch
from app.models.user import User
from app.repositories.edit_batch_repo import EditBatchRepository
from app.repositories.edit_job_repo import EditJobRepository
from app.services.edit_service import EditService

logger = logging.getLogger(__name__)


class BatchService:
    def __init__(
        self,
        batch_repo: EditBatchRepository,
        job_repo: EditJobRepository,
        edit_service: EditService,
    ) -> None:
        self.batch_repo = batch_repo
        self.job_repo = job_repo
        self.edit_service = edit_service

    async def create_batch(
        self,
        db: AsyncSession,
        user: User,
        files: list[UploadFile],
        prompt: str,
    ) -> EditBatch:
        # 1. Validaciones rápidas (sin tocar disco ni BD)
        if not files:
            raise HTTPException(400, "Sube al menos una imagen")
        if len(files) > settings.MAX_IMAGES_PER_BATCH:
            raise HTTPException(
                400, f"Máximo {settings.MAX_IMAGES_PER_BATCH} imágenes por lote"
            )
        if not prompt.strip():
            raise HTTPException(400, "El prompt no puede estar vacío")

        # 2. Leer y validar todo el contenido ANTES de crear nada en BD,
        #    para evitar dejar batches huérfanos si algún archivo falla.
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        validated: list[tuple[UploadFile, bytes]] = []
        for f in files:
            ext = (f.filename or "").rsplit(".", 1)[-1].lower()
            if ext not in settings.allowed_extensions_set:
                raise HTTPException(400, f"Extensión no permitida: {f.filename}")
            content = await f.read()
            if len(content) > max_bytes:
                raise HTTPException(
                    400,
                    f"{f.filename} excede el tamaño máximo de {settings.MAX_UPLOAD_SIZE_MB} MB",
                )
            validated.append((f, content))

        # 3. Crear batch en BD
        batch = await self.batch_repo.create(
            db,
            user_id=user.id,
            prompt=prompt,
            ai_model=settings.OPENROUTER_MODEL,
            total_images=len(validated),
        )

        # 4. Guardar originales en disco y preparar datos de jobs
        jobs_data: list[dict] = []
        for i, (f, content) in enumerate(validated):
            job_id = uuid.uuid4()
            ext = (f.filename or "file.jpg").rsplit(".", 1)[-1].lower()
            original_path = settings.upload_originals_dir / f"{job_id}.{ext}"
            original_path.parent.mkdir(parents=True, exist_ok=True)
            original_path.write_bytes(content)

            jobs_data.append(
                {
                    "id": job_id,
                    "batch_id": batch.id,
                    "user_id": user.id,
                    "position": i,
                    "status": "pending",
                    "ai_model": settings.OPENROUTER_MODEL,
                    "original_filename": f.filename or f"image_{i}",
                    "original_path": str(original_path),
                    "original_size_bytes": len(content),
                }
            )

        # 5. Crear jobs en BD
        await self.job_repo.create_many(db, jobs_data)
        return batch

    async def process_batch(self, batch_id: uuid.UUID) -> None:
        # Fase 1: obtener batch + jobs y marcar processing.
        # Sesión corta — se cierra antes del gather.
        async with AsyncSessionLocal() as db:
            batch = await self.batch_repo.get_by_id(db, batch_id)
            if batch is None:
                logger.error("process_batch: batch %s not found", batch_id)
                return
            jobs = await self.job_repo.list_by_batch(db, batch_id)
            await self.batch_repo.mark_processing(db, batch)
            prompt = batch.prompt
        # 'batch' y 'jobs' quedan detached pero sus columnas están en memoria.

        # Fase 2: procesar jobs en paralelo con concurrencia controlada.
        # Cada job usa su propia sesión para evitar contención.
        semaphore = asyncio.Semaphore(settings.BATCH_CONCURRENCY)

        async def run_with_limit(job) -> None:
            async with semaphore:
                async with AsyncSessionLocal() as job_db:
                    await self.edit_service.process_single_job(job_db, job, prompt)

                    # Re-fetch para conocer el status real persistido por edit_service.
                    # No confiamos en job.status (objeto detached, valor stale).
                    updated = await self.job_repo.get_by_id(job_db, job.id)
                    if updated and updated.status == "completed":
                        await self.batch_repo.increment_completed(job_db, batch_id)
                    else:
                        await self.batch_repo.increment_failed(job_db, batch_id)

        await asyncio.gather(
            *[run_with_limit(j) for j in jobs],
            return_exceptions=True,
        )

        # Fase 3: finalizar batch (calcula status + total_cost_usd).
        # Nueva sesión corta — no es la misma que la fase 1.
        async with AsyncSessionLocal() as db:
            await self.batch_repo.finalize(db, batch_id)

    async def create_compose_batch(
        self,
        db: AsyncSession,
        user: User,
        overlay_file: UploadFile,
        base_files: list[UploadFile],
        prompt: str,
    ) -> EditBatch:
        if not base_files:
            raise HTTPException(400, "Sube al menos una imagen base")
        if len(base_files) > settings.MAX_IMAGES_PER_BATCH:
            raise HTTPException(400, f"Máximo {settings.MAX_IMAGES_PER_BATCH} imágenes por lote")
        if not prompt.strip():
            raise HTTPException(400, "El prompt no puede estar vacío")

        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

        overlay_ext = (overlay_file.filename or "overlay.png").rsplit(".", 1)[-1].lower()
        if overlay_ext not in settings.allowed_extensions_set:
            raise HTTPException(400, f"Extensión no permitida para el elemento: {overlay_file.filename}")
        overlay_content = await overlay_file.read()
        if len(overlay_content) > max_bytes:
            raise HTTPException(400, f"El elemento excede el tamaño máximo de {settings.MAX_UPLOAD_SIZE_MB} MB")

        validated: list[tuple[UploadFile, bytes]] = []
        for f in base_files:
            ext = (f.filename or "").rsplit(".", 1)[-1].lower()
            if ext not in settings.allowed_extensions_set:
                raise HTTPException(400, f"Extensión no permitida: {f.filename}")
            content = await f.read()
            if len(content) > max_bytes:
                raise HTTPException(400, f"{f.filename} excede el tamaño máximo de {settings.MAX_UPLOAD_SIZE_MB} MB")
            validated.append((f, content))

        batch = await self.batch_repo.create(
            db,
            user_id=user.id,
            prompt=prompt,
            ai_model=settings.OPENROUTER_MODEL,
            total_images=len(validated),
        )

        overlay_dir = Path(settings.UPLOAD_DIR).resolve() / "overlays"
        overlay_dir.mkdir(parents=True, exist_ok=True)
        overlay_path = overlay_dir / f"{batch.id}.{overlay_ext}"
        overlay_path.write_bytes(overlay_content)

        await self.batch_repo.update_overlay_path(db, batch.id, str(overlay_path))

        jobs_data: list[dict] = []
        for i, (f, content) in enumerate(validated):
            job_id = uuid.uuid4()
            ext = (f.filename or "file.jpg").rsplit(".", 1)[-1].lower()
            original_path = settings.upload_originals_dir / f"{job_id}.{ext}"
            original_path.parent.mkdir(parents=True, exist_ok=True)
            original_path.write_bytes(content)
            jobs_data.append({
                "id": job_id,
                "batch_id": batch.id,
                "user_id": user.id,
                "position": i,
                "status": "pending",
                "ai_model": settings.OPENROUTER_MODEL,
                "original_filename": f.filename or f"image_{i}",
                "original_path": str(original_path),
                "original_size_bytes": len(content),
            })

        await self.job_repo.create_many(db, jobs_data)
        return batch

    async def process_compose_batch(self, batch_id: uuid.UUID) -> None:
        async with AsyncSessionLocal() as db:
            batch = await self.batch_repo.get_by_id(db, batch_id)
            if batch is None or not batch.overlay_path:
                logger.error("process_compose_batch: batch %s not found or missing overlay", batch_id)
                return
            jobs = await self.job_repo.list_by_batch(db, batch_id)
            await self.batch_repo.mark_processing(db, batch)
            prompt = batch.prompt
            overlay_path = batch.overlay_path

        import mimetypes
        overlay_bytes = Path(overlay_path).read_bytes()
        overlay_mime, _ = mimetypes.guess_type(overlay_path)
        if overlay_mime is None:
            overlay_mime = "image/png"

        semaphore = asyncio.Semaphore(settings.BATCH_CONCURRENCY)

        async def run_with_limit(job) -> None:
            async with semaphore:
                async with AsyncSessionLocal() as job_db:
                    await self.edit_service.process_single_compose_job(
                        job_db, job, prompt, overlay_bytes, overlay_mime
                    )
                    updated = await self.job_repo.get_by_id(job_db, job.id)
                    if updated and updated.status == "completed":
                        await self.batch_repo.increment_completed(job_db, batch_id)
                    else:
                        await self.batch_repo.increment_failed(job_db, batch_id)

        await asyncio.gather(*[run_with_limit(j) for j in jobs], return_exceptions=True)

        async with AsyncSessionLocal() as db:
            await self.batch_repo.finalize(db, batch_id)

    async def retry_job_task(self, job_id: uuid.UUID) -> None:
        """Background task: re-procesa un job individual y actualiza contadores."""
        async with AsyncSessionLocal() as db:
            job = await self.job_repo.get_by_id(db, job_id)
            if job is None:
                logger.error("retry_job_task: job %s not found", job_id)
                return
            batch = await self.batch_repo.get_by_id(db, job.batch_id)
            if batch is None:
                logger.error("retry_job_task: batch %s not found", job.batch_id)
                return
            prompt = batch.prompt
            batch_id = job.batch_id

        async with AsyncSessionLocal() as job_db:
            await self.edit_service.process_single_job(job_db, job, prompt)
            updated = await self.job_repo.get_by_id(job_db, job_id)
            if updated and updated.status == "completed":
                await self.batch_repo.increment_completed(job_db, batch_id)
            else:
                await self.batch_repo.increment_failed(job_db, batch_id)

        async with AsyncSessionLocal() as db:
            await self.batch_repo.finalize(db, batch_id)
