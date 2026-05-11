from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    OPENROUTER_API_KEY: str
    OPENROUTER_BASE_URL: str
    OPENROUTER_MODEL: str
    OPENROUTER_TIMEOUT_SECONDS: int = 120
    OPENROUTER_HTTP_REFERER: str
    OPENROUTER_X_TITLE: str

    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_IMAGE_EXTENSIONS: str = "jpg,jpeg,png,webp"

    MAX_IMAGES_PER_BATCH: int = 20
    BATCH_CONCURRENCY: int = 3

    CORS_ORIGINS: str = "http://localhost:8002"
    APP_NAME: str = "Photo Edit AI"
    DEBUG: bool = False

    META_BUSINESS_NAME: str = ""
    META_WEBSITE:       str = ""
    META_GPS_LAT:       str = ""
    META_GPS_LON:       str = ""
    META_COPYRIGHT:     str = ""
    META_DESCRIPTION:   str = ""
    META_OUTPUT_WIDTH:  int = 0
    META_OUTPUT_HEIGHT: int = 0

    OVERLAYS_DIR: str = "app/static/overlays"

    @property
    def allowed_extensions_set(self) -> set[str]:
        return {e.strip().lower() for e in self.ALLOWED_IMAGE_EXTENSIONS.split(",")}

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    @property
    def upload_originals_dir(self) -> Path:
        return Path(self.UPLOAD_DIR).resolve() / "originals"

    @property
    def upload_results_dir(self) -> Path:
        return Path(self.UPLOAD_DIR).resolve() / "results"


settings = Settings()
