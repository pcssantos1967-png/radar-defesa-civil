"""
Radar Processor API

FastAPI application for radar data processing and serving.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import structlog

from ..config.settings import get_settings

logger = structlog.get_logger()
settings = get_settings()

app = FastAPI(
    title="Radar Processor API",
    description="API for radar data processing and tile serving",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ProcessingStatus(BaseModel):
    """Status of radar processing."""

    radar_id: str
    last_processed: Optional[datetime]
    status: str
    scan_count_today: int
    error_count: int


class ProcessingRequest(BaseModel):
    """Request to process a radar file."""

    radar_id: str
    file_path: str
    force_reprocess: bool = False


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
    }


@app.get("/status")
async def get_processing_status() -> dict:
    """Get overall processing status."""
    return {
        "status": "operational",
        "radars_active": 1,
        "last_scan": datetime.now().isoformat(),
        "tiles_generated": 0,
        "queue_size": 0,
    }


@app.get("/status/{radar_id}")
async def get_radar_status(radar_id: str) -> ProcessingStatus:
    """Get status for a specific radar."""
    return ProcessingStatus(
        radar_id=radar_id,
        last_processed=datetime.now(),
        status="operational",
        scan_count_today=0,
        error_count=0,
    )


@app.post("/process")
async def process_file(
    request: ProcessingRequest,
    background_tasks: BackgroundTasks,
):
    """
    Queue a radar file for processing.

    This endpoint queues the file for background processing
    and returns immediately.
    """
    logger.info(
        "Processing request received",
        radar_id=request.radar_id,
        file_path=request.file_path,
    )

    # TODO: Add to processing queue
    # background_tasks.add_task(process_radar_file, request.file_path)

    return {
        "status": "queued",
        "radar_id": request.radar_id,
        "file_path": request.file_path,
        "message": "File queued for processing",
    }


@app.get("/tiles/{timestamp}/{z}/{x}/{y}.{ext}")
async def get_tile(timestamp: str, z: int, x: int, y: int, ext: str):
    """
    Get a radar tile.

    Args:
        timestamp: Scan timestamp (YYYYMMDDHHMMSS)
        z: Zoom level
        x: Tile X coordinate
        y: Tile Y coordinate
        ext: File extension (png or webp)
    """
    if ext not in ["png", "webp"]:
        raise HTTPException(status_code=400, detail="Invalid format. Use png or webp")

    # TODO: Fetch tile from storage
    # For now, return empty transparent tile
    from PIL import Image
    from io import BytesIO

    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    buffer = BytesIO()

    if ext == "webp":
        img.save(buffer, "WEBP", quality=80)
        media_type = "image/webp"
    else:
        img.save(buffer, "PNG")
        media_type = "image/png"

    return Response(
        content=buffer.getvalue(),
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=60",
        },
    )


@app.get("/products")
async def list_products():
    """List available radar products."""
    return {
        "products": [
            {
                "code": "PPI",
                "name": "Plan Position Indicator",
                "description": "Reflectivity at fixed elevation",
            },
            {
                "code": "CAPPI",
                "name": "Constant Altitude PPI",
                "description": "Reflectivity at constant altitude",
            },
            {
                "code": "MAX-Z",
                "name": "Maximum Reflectivity",
                "description": "Column maximum reflectivity",
            },
            {
                "code": "QPE",
                "name": "Precipitation Estimation",
                "description": "Estimated precipitation rate",
            },
        ]
    }


@app.get("/latest/{radar_id}/{product}")
async def get_latest_scan(radar_id: str, product: str):
    """Get information about the latest scan for a radar and product."""
    return {
        "radar_id": radar_id,
        "product": product,
        "scan_time": datetime.now().isoformat(),
        "tile_path": f"/tiles/{datetime.now().strftime('%Y%m%d%H%M%S')}/{{z}}/{{x}}/{{y}}.webp",
        "metadata": {
            "elevation_angle": 0.5,
            "quality_score": 0.95,
        },
    }


def start_api():
    """Start the API server."""
    import uvicorn

    uvicorn.run(
        "radar_processor.api.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
    )


if __name__ == "__main__":
    start_api()
