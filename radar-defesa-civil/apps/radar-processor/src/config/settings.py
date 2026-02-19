from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Environment
    env: str = "development"
    debug: bool = True

    # Database
    database_url: str = "postgresql://radar:radar123@localhost:5432/radar_defesa_civil"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # MinIO / S3
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "radar_admin"
    minio_secret_key: str = "radar_secret_123"
    minio_bucket_radar: str = "radar-data"
    minio_bucket_tiles: str = "radar-tiles"
    minio_secure: bool = False

    # Radar Processing
    radar_data_path: str = "/data/radar"
    radar_tiles_path: str = "/data/tiles"
    radar_scan_interval: int = 300  # seconds
    radar_history_hours: int = 24

    # Tile Generation
    tile_size: int = 256
    tile_format: str = "webp"  # png or webp
    tile_quality: int = 80
    tile_zoom_levels: list[int] = [6, 7, 8, 9, 10, 11]

    # Nowcasting
    nowcast_lead_times: list[int] = [10, 20, 30, 60, 90, 120]  # minutes
    optical_flow_method: str = "lucaskanade"

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
