# Photo Edit AI — Backend

API REST para retocar fotografías en lote usando IA. El usuario sube N imágenes con un único prompt de texto; el backend procesa cada imagen contra OpenRouter en paralelo controlado y devuelve los resultados editados.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 async |
| Validación | Pydantic v2 + pydantic-settings |
| Driver BD | asyncpg |
| Migraciones | Alembic |
| Auth | python-jose (JWT) + bcrypt |
| HTTP client | httpx async |
| Imágenes | Pillow |
| Templates | Jinja2 |
| Base de datos | PostgreSQL 15+ |
| IA | OpenRouter (modelo configurable vía `.env`) |
| Python | 3.13.3 (ver `.python-version`) |

---

## Puesta a punto

### 1. Requisitos previos

- Python 3.13 (`pyenv install 3.13.3` si no lo tienes)
- PostgreSQL 15+ corriendo (o Docker)
- Cuenta en [openrouter.ai](https://openrouter.ai) con API key

### 2. Clonar y crear entorno virtual

```bash
git clone <repo>
cd photo-edit-ai

python3.13 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores reales:

```env
# Base de datos
DATABASE_URL=postgresql+asyncpg://usuario:password@localhost:5432/photo_edit_db

# JWT — genera un secreto seguro:
# python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=cambia-esto-por-un-secreto-de-al-menos-32-chars

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.5-flash-image
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_HTTP_REFERER=http://localhost:8001
OPENROUTER_X_TITLE=Photo Edit AI

# Procesamiento
BATCH_CONCURRENCY=3
MAX_IMAGES_PER_BATCH=20
```

### 4. Base de datos

**Con Docker (opción rápida):**

```bash
docker run -d \
  --name photo-edit-pg \
  -e POSTGRES_USER=photo_edit \
  -e POSTGRES_PASSWORD=photo_edit_pass \
  -e POSTGRES_DB=photo_edit_db \
  -p 5433:5432 \
  postgres:15
```

Actualiza `DATABASE_URL` en `.env`:
```
DATABASE_URL=postgresql+asyncpg://photo_edit:photo_edit_pass@localhost:5433/photo_edit_db
```

**Con PostgreSQL local:**

```bash
createdb photo_edit_db
```

### 5. Migraciones

```bash
alembic upgrade head
```

Esto crea las 4 tablas: `users`, `edit_batches`, `edit_jobs`, `api_usage_log`.

### 6. Crear usuario administrador

```bash
ADMIN_EMAIL=tu@email.com \
ADMIN_FULL_NAME="Admin" \
python -m app.scripts.seed_admin
```

> Si no se pasa `ADMIN_PASSWORD`, el script genera una contraseña aleatoria segura y la imprime en consola.

### 7. Arrancar el servidor

```bash
uvicorn app.main:app --reload --port 8001
```

La API y el frontend se sirven desde el mismo proceso en `http://localhost:8001`.

---

## Verificar integración con OpenRouter (standalone)

Antes de arrancar el backend completo, puedes probar que la API de IA funciona con una imagen cualquiera:

```bash
python -m app.scripts.test_ai foto.jpg "convert to black and white"
# Genera test_result.png en el directorio actual
```

---

## Pruebas con curl

### Registro y autenticación

```bash
# Registrar usuario
curl -X POST http://localhost:8001/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"<tu-email>","password":"<contraseña>","full_name":"<nombre>"}'

# Login — guardar token
TOKEN=$(curl -s -X POST http://localhost:8001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<tu-email>","password":"<contraseña>"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Verificar identidad
curl http://localhost:8001/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Respuesta esperada de `/auth/me`:
```json
{
  "id": "fef11574-2fb5-4a44-9210-b02ec52b741a",
  "email": "test@example.com",
  "full_name": "Test User",
  "is_active": true,
  "created_at": "2026-05-04T20:49:50.480489Z"
}
```

---

### Subir un lote de imágenes

```bash
# Subir 3 imágenes con un mismo prompt
curl -s -X POST http://localhost:8001/batches/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "files=@foto1.jpg" \
  -F "files=@foto2.jpg" \
  -F "files=@foto3.jpg" \
  -F "prompt=convert to vintage sepia tone"
```

La respuesta llega en **menos de 200 ms** — el procesamiento ocurre en background:

```json
{
  "id": "26374e84-0421-4191-b843-c8510d0cdca3",
  "user_id": "fef11574-2fb5-4a44-9210-b02ec52b741a",
  "prompt": "convert to vintage sepia tone",
  "ai_model": "google/gemini-2.5-flash-image",
  "total_images": 3,
  "completed_count": 0,
  "failed_count": 0,
  "status": "pending",
  "started_at": null,
  "finished_at": null,
  "total_cost_usd": null,
  "created_at": "2026-05-04T20:55:43.442055Z"
}
```

---

### Polling del progreso

```bash
BATCH_ID="26374e84-0421-4191-b843-c8510d0cdca3"

curl http://localhost:8001/batches/$BATCH_ID/progress \
  -H "Authorization: Bearer $TOKEN"
```

Respuesta mientras procesa (el semáforo limita a `BATCH_CONCURRENCY` jobs en paralelo):

```json
{
  "batch_id": "26374e84-0421-4191-b843-c8510d0cdca3",
  "status": "processing",
  "total": 3,
  "completed": 2,
  "failed": 0,
  "processing": 1,
  "pending": 0,
  "jobs": [
    {"id": "5f1c0822-...", "position": 0, "status": "completed", "original_filename": "foto1.jpg"},
    {"id": "6dfeda5b-...", "position": 1, "status": "completed", "original_filename": "foto2.jpg"},
    {"id": "fac20081-...", "position": 2, "status": "processing", "original_filename": "foto3.jpg"}
  ]
}
```

Respuesta cuando termina:

```json
{
  "batch_id": "26374e84-0421-4191-b843-c8510d0cdca3",
  "status": "completed",
  "total": 3,
  "completed": 3,
  "failed": 0,
  "processing": 0,
  "pending": 0,
  "jobs": [...]
}
```

Detener el polling cuando `status` ∈ `{completed, partial, failed}`.

---

### Descargar resultados

```bash
JOB_ID="5f1c0822-f192-488e-ac06-32fcde0f1115"

# Imagen editada por la IA
curl http://localhost:8001/edits/$JOB_ID/result \
  -H "Authorization: Bearer $TOKEN" \
  -o resultado.png

# Imagen original
curl http://localhost:8001/edits/$JOB_ID/original \
  -H "Authorization: Bearer $TOKEN" \
  -o original.jpg

# Verificar que es un PNG válido
file resultado.png
# resultado.png: PNG image data, 1344 x 768, 8-bit/color RGB, non-interlaced
```

---

### Reintentar un job fallido

```bash
curl -X POST http://localhost:8001/edits/$JOB_ID/retry \
  -H "Authorization: Bearer $TOKEN"
# → HTTP 202, status: "pending"
```

---

### Listar historial de batches

```bash
# Todos los batches del usuario (paginado)
curl "http://localhost:8001/batches/?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# Solo batches completados
curl "http://localhost:8001/batches/?status=completed" \
  -H "Authorization: Bearer $TOKEN"
```

---

### Detalle completo de un batch

```bash
curl http://localhost:8001/batches/$BATCH_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

### Eliminar un batch (soft delete)

```bash
curl -X DELETE http://localhost:8001/batches/$BATCH_ID \
  -H "Authorization: Bearer $TOKEN"
# → HTTP 204 No Content
```

---

### Health check (sin autenticación)

```bash
curl http://localhost:8001/health
# {"status": "ok", "app": "Photo Edit AI"}
```

---

## Estructura del proyecto

```
app/
├── core/
│   ├── config.py          # Settings con pydantic-settings — única fuente de config
│   ├── security.py        # JWT + bcrypt
│   └── dependencies.py    # get_current_user (FastAPI Depends)
├── models/                # SQLAlchemy ORM (uno por entidad)
│   ├── user.py
│   ├── edit_batch.py
│   ├── edit_job.py
│   └── api_usage_log.py
├── schemas/               # Pydantic v2 DTOs (uno por entidad)
├── repositories/          # Queries SQL puras (sin lógica de negocio)
│   ├── user_repo.py
│   ├── edit_batch_repo.py
│   ├── edit_job_repo.py
│   └── usage_log_repo.py
├── services/
│   ├── ai/
│   │   ├── base.py        # Protocol AIImageProvider
│   │   └── openrouter.py  # Cliente httpx a OpenRouter
│   ├── auth_service.py
│   ├── edit_service.py    # Procesa un job individual (nunca propaga excepciones)
│   └── batch_service.py   # Orquesta N jobs con asyncio.Semaphore
├── routers/
│   ├── auth.py            # /auth/register  /auth/login  /auth/me
│   ├── batches.py         # /batches/  /batches/{id}  /batches/{id}/progress
│   ├── edits.py           # /edits/{id}  /edits/{id}/result  /edits/{id}/retry
│   └── pages.py           # Vistas HTML (Jinja2)
├── templates/             # HTML (Tailwind CDN, sin build step)
├── static/                # CSS y JS vanilla (arquitectura MVVM)
│   └── js/
│       ├── api.js         # Único lugar con fetch() + JWT headers
│       ├── models/        # *Api.js — wrappers de endpoints
│       ├── viewmodels/    # Estado de la UI (sin DOM)
│       └── views/         # Bootstrap de cada página
├── scripts/
│   ├── seed_admin.py      # Crea usuario admin inicial
│   └── test_ai.py         # Prueba la integración con OpenRouter de forma aislada
├── database.py            # Engine async + get_db
└── main.py                # FastAPI app, CORS, static, routers
alembic/
└── versions/
    └── bd6c39a6c722_initial_schema.py
```

---

## Endpoints disponibles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | No | Health check |
| POST | `/auth/register` | No | Registrar usuario |
| POST | `/auth/login` | No | Login → JWT |
| GET | `/auth/me` | Sí | Usuario autenticado |
| POST | `/batches/` | Sí | Crear lote (responde inmediato, procesa en background) |
| GET | `/batches/` | Sí | Historial de lotes (paginado, filtro por status) |
| GET | `/batches/{id}` | Sí | Detalle de lote con todos sus jobs |
| GET | `/batches/{id}/progress` | Sí | Progreso ligero para polling (solo agregados) |
| DELETE | `/batches/{id}` | Sí | Soft delete del lote y sus jobs |
| GET | `/edits/{id}` | Sí | Detalle de job individual |
| GET | `/edits/{id}/original` | Sí | Descargar imagen original |
| GET | `/edits/{id}/result` | Sí | Descargar imagen editada |
| POST | `/edits/{id}/retry` | Sí | Reintentar job fallido |

---

## Decisiones de diseño relevantes

**Respuesta inmediata en POST /batches/**: el endpoint devuelve HTTP 201 con el `batch_id` antes de que empiece el procesamiento. El procesamiento ocurre en `BackgroundTasks` de FastAPI.

**Concurrencia controlada**: `asyncio.Semaphore(BATCH_CONCURRENCY)` limita los jobs en vuelo simultáneos para no saturar OpenRouter ni el pool de conexiones.

**Sesiones cortas en el batch**: se usan 3 sesiones de BD separadas (fetch+mark / una por job / finalize) en lugar de una sola sesión larga que consumiría una conexión durante minutos.

**Un job que falla no cancela el lote**: `asyncio.gather(..., return_exceptions=True)` + cada job captura sus propias excepciones y las persiste como `status=failed` en BD.

**Soft delete en todos los modelos**: nunca se usa `db.delete()`. Todas las queries de listado filtran `deleted_at IS NULL`.

**Sin paths físicos expuestos**: `result_path` y `original_path` están marcados como `exclude=True` en los schemas Pydantic. Los archivos se sirven a través de endpoints autenticados con validación anti path-traversal.

**Proveedor de IA inyectable**: `EditService` recibe un `AIImageProvider` (Protocol), lo que permite cambiar de OpenRouter a otro proveedor sin modificar la lógica de negocio.

**Modelos disponibles imagen openrouter**
google/gemini-3.1-flash-image-preview (supports extended aspect ratios and 0.5K resolution)
google/gemini-2.5-flash-image
black-forest-labs/flux.2-pro
black-forest-labs/flux.2-flex
sourceful/riverflow-v2-standard-preview