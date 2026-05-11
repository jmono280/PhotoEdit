import time

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from app.core.config import settings

router = APIRouter(tags=["pages"])

_STATIC_VER = str(int(time.time()))

_ctx = {
    "app_name": settings.APP_NAME,
    "max_images": settings.MAX_IMAGES_PER_BATCH,
    "static_ver": _STATIC_VER,
}


def _render(request: Request, template: str, extra: dict | None = None) -> HTMLResponse:
    ctx = {**_ctx, **(extra or {})}
    return request.app.state.templates.TemplateResponse(request, template, ctx)


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> HTMLResponse:
    return _render(request, "login.html")


@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request) -> HTMLResponse:
    return _render(request, "register.html")


@router.get("/history", response_class=HTMLResponse)
async def history_page(request: Request) -> HTMLResponse:
    return _render(request, "history.html")


@router.get("/batch/{batch_id}", response_class=HTMLResponse)
async def batch_detail_page(batch_id: str, request: Request) -> HTMLResponse:
    return _render(request, "batch_detail.html", {"batch_id": batch_id})


@router.get("/compose", response_class=HTMLResponse)
async def compose_page(request: Request) -> HTMLResponse:
    return _render(request, "compose.html")


@router.get("/", response_class=HTMLResponse)
async def editor_page(request: Request) -> HTMLResponse:
    return _render(request, "editor.html")
