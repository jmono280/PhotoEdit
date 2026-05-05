import base64
import time

import httpx

from app.core.config import settings
from app.services.ai.base import AIEditResult


class OpenRouterImageEditor:
    def __init__(self) -> None:
        self._api_key = settings.OPENROUTER_API_KEY
        self._base_url = settings.OPENROUTER_BASE_URL
        self._model = settings.OPENROUTER_MODEL
        self._timeout = settings.OPENROUTER_TIMEOUT_SECONDS
        self._http_referer = settings.OPENROUTER_HTTP_REFERER
        self._x_title = settings.OPENROUTER_X_TITLE

    @property
    def model(self) -> str:
        return self._model

    async def edit_image(
        self, image_bytes: bytes, prompt: str, mime: str
    ) -> AIEditResult:
        b64 = base64.b64encode(image_bytes).decode()
        data_url = f"data:{mime};base64,{b64}"

        payload = {
            "model": self._model,
            "modalities": ["image"],
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "HTTP-Referer": self._http_referer,
            "X-Title": self._x_title,
            "Content-Type": "application/json",
        }

        start = time.perf_counter()
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
            )
        duration_ms = int((time.perf_counter() - start) * 1000)

        response.raise_for_status()

        response_size = len(response.content)
        data = response.json()

        images = data["choices"][0]["message"].get("images") or []
        if not images:
            raise RuntimeError("OpenRouter did not return an image")

        result_data_url: str = images[0]["image_url"]["url"]
        _, b64_part = result_data_url.split(",", 1)
        result_bytes = base64.b64decode(b64_part)

        cost_usd: float | None = None
        usage = data.get("usage") or {}
        if "cost" in usage:
            cost_usd = float(usage["cost"])

        return AIEditResult(
            image_bytes=result_bytes,
            model=self._model,
            duration_ms=duration_ms,
            http_status=response.status_code,
            response_size=response_size,
            cost_usd=cost_usd,
        )
