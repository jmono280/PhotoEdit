from dataclasses import dataclass
from typing import Protocol


@dataclass
class AIEditResult:
    image_bytes: bytes
    model: str
    duration_ms: int
    http_status: int
    response_size: int
    cost_usd: float | None = None


class AIImageProvider(Protocol):
    async def edit_image(
        self, image_bytes: bytes, prompt: str, mime: str
    ) -> AIEditResult: ...

    async def compose_image(
        self,
        base_bytes: bytes,
        overlay_bytes: bytes,
        prompt: str,
        base_mime: str,
        overlay_mime: str,
    ) -> AIEditResult: ...
