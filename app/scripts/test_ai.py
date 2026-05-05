import asyncio
import mimetypes
import sys
from pathlib import Path

from app.services.ai.openrouter import OpenRouterImageEditor


async def main(image_path: str, prompt: str) -> None:
    p = Path(image_path)
    if not p.exists():
        print(f"No existe el archivo: {p}")
        sys.exit(1)

    mime, _ = mimetypes.guess_type(p)
    if mime is None or not mime.startswith("image/"):
        print(f"Mime inválido: {mime}")
        sys.exit(1)

    image_bytes = p.read_bytes()
    print(f"Leyendo {p.name} ({len(image_bytes)} bytes), mime={mime}")
    print(f"Prompt: {prompt}")

    provider = OpenRouterImageEditor()
    print(f"Modelo configurado: {provider.model}")
    print("Llamando a OpenRouter...")

    result = await provider.edit_image(image_bytes, prompt, mime)
    print(f"OK en {result.duration_ms}ms, response_size={result.response_size}")

    out = Path("test_result.png")
    out.write_bytes(result.image_bytes)
    print(f"Resultado guardado en {out.resolve()}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python -m app.scripts.test_ai <imagen> <prompt>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2]))
