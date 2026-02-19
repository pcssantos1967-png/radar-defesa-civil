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
from pathlib import Path
import structlog
import asyncio
from dataclasses import dataclass, field
from collections import deque

from ..config.settings import get_settings
from ..pipeline.processor import RadarPipeline

logger = structlog.get_logger()
settings = get_settings()


@dataclass
class QueueStats:
    """Statistics for the processing queue."""
    queued: int = 0
    processed: int = 0
    errors: int = 0
    processing: int = 0
    recent_files: deque = field(default_factory=lambda: deque(maxlen=100))


# Global queue statistics
queue_stats = QueueStats()

# Shared pipeline instance
_pipeline: Optional[RadarPipeline] = None


def get_pipeline() -> RadarPipeline:
    """Get or create the shared RadarPipeline instance."""
    global _pipeline
    if _pipeline is None:
        _pipeline = RadarPipeline()
    return _pipeline


async def process_radar_file(file_path: str, radar_id: str, force_reprocess: bool = False):
    """
    Process a radar file in the background.

    Args:
        file_path: Path to the radar file
        radar_id: Radar identifier
        force_reprocess: Whether to force reprocessing
    """
    global queue_stats

    queue_stats.processing += 1

    try:
        logger.info(
            "Starting background processing",
            file_path=file_path,
            radar_id=radar_id,
        )

        pipeline = get_pipeline()
        result = await pipeline.process_file(file_path, radar_id)

        if result.success:
            queue_stats.processed += 1
            queue_stats.recent_files.append({
                "file_path": file_path,
                "radar_id": radar_id,
                "status": "success",
                "processed_at": datetime.now().isoformat(),
                "products": result.products,
                "processing_time_ms": result.processing_time_ms,
            })
            logger.info(
                "Background processing complete",
                file_path=file_path,
                radar_id=radar_id,
                products=result.products,
            )
        else:
            queue_stats.errors += 1
            queue_stats.recent_files.append({
                "file_path": file_path,
                "radar_id": radar_id,
                "status": "error",
                "processed_at": datetime.now().isoformat(),
                "error": result.error,
            })
            logger.error(
                "Background processing failed",
                file_path=file_path,
                radar_id=radar_id,
                error=result.error,
            )

    except Exception as e:
        queue_stats.errors += 1
        queue_stats.recent_files.append({
            "file_path": file_path,
            "radar_id": radar_id,
            "status": "error",
            "processed_at": datetime.now().isoformat(),
            "error": str(e),
        })
        logger.error(
            "Background processing exception",
            file_path=file_path,
            error=str(e),
        )
    finally:
        queue_stats.processing -= 1

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
async def queue_file_for_processing(
    request: ProcessingRequest,
    background_tasks: BackgroundTasks,
):
    """
    Queue a radar file for processing.

    This endpoint queues the file for background processing
    and returns immediately.
    """
    global queue_stats

    logger.info(
        "Processing request received",
        radar_id=request.radar_id,
        file_path=request.file_path,
    )

    # Validate file exists
    file_path = Path(request.file_path)
    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"File not found: {request.file_path}"
        )

    # Add to processing queue
    background_tasks.add_task(
        process_radar_file,
        request.file_path,
        request.radar_id,
        request.force_reprocess,
    )

    queue_stats.queued += 1

    return {
        "status": "queued",
        "radar_id": request.radar_id,
        "file_path": request.file_path,
        "message": "File queued for processing",
        "queue_position": queue_stats.queued - queue_stats.processed - queue_stats.errors,
    }


@app.get("/queue/stats")
async def get_queue_stats():
    """Get processing queue statistics."""
    return {
        "queued": queue_stats.queued,
        "processed": queue_stats.processed,
        "errors": queue_stats.errors,
        "processing": queue_stats.processing,
        "pending": queue_stats.queued - queue_stats.processed - queue_stats.errors,
        "success_rate": (
            queue_stats.processed / queue_stats.queued * 100
            if queue_stats.queued > 0 else 100
        ),
    }


@app.get("/queue/recent")
async def get_recent_processed():
    """Get recently processed files."""
    return {
        "files": list(queue_stats.recent_files),
        "count": len(queue_stats.recent_files),
    }


def _create_transparent_tile(ext: str) -> tuple[bytes, str]:
    """Create an empty transparent tile."""
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

    return buffer.getvalue(), media_type


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

    # Construct tile path
    tile_path = Path(settings.radar_tiles_path) / timestamp / str(z) / str(x) / f"{y}.{ext}"

    # Check if tile exists on disk
    if tile_path.exists():
        try:
            content = tile_path.read_bytes()
            media_type = "image/webp" if ext == "webp" else "image/png"

            return Response(
                content=content,
                media_type=media_type,
                headers={
                    "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                    "X-Tile-Source": "disk",
                },
            )
        except Exception as e:
            logger.error("Failed to read tile", path=str(tile_path), error=str(e))

    # Return transparent tile if not found
    content, media_type = _create_transparent_tile(ext)

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=60",
            "X-Tile-Source": "empty",
        },
    )


@app.get("/tiles/{radar_id}/{product}/{timestamp}/{z}/{x}/{y}.{ext}")
async def get_radar_product_tile(
    radar_id: str,
    product: str,
    timestamp: str,
    z: int,
    x: int,
    y: int,
    ext: str
):
    """
    Get a tile for a specific radar and product.

    Args:
        radar_id: Radar identifier
        product: Product type (MAX-Z, QPE, NOWCAST-10, etc.)
        timestamp: Scan timestamp (YYYYMMDDHHMMSS)
        z: Zoom level
        x: Tile X coordinate
        y: Tile Y coordinate
        ext: File extension (png or webp)
    """
    if ext not in ["png", "webp"]:
        raise HTTPException(status_code=400, detail="Invalid format. Use png or webp")

    # Construct tile path: {base}/{radar_id}/{product}/{timestamp}/{z}/{x}/{y}.{ext}
    tile_path = (
        Path(settings.radar_tiles_path) / radar_id / product / timestamp /
        str(z) / str(x) / f"{y}.{ext}"
    )

    if tile_path.exists():
        try:
            content = tile_path.read_bytes()
            media_type = "image/webp" if ext == "webp" else "image/png"

            return Response(
                content=content,
                media_type=media_type,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "X-Radar-Id": radar_id,
                    "X-Product": product,
                    "X-Tile-Source": "disk",
                },
            )
        except Exception as e:
            logger.error(
                "Failed to read tile",
                path=str(tile_path),
                radar_id=radar_id,
                product=product,
                error=str(e),
            )

    # Return transparent tile if not found
    content, media_type = _create_transparent_tile(ext)

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=60",
            "X-Tile-Source": "empty",
        },
    )


@app.get("/tiles/available")
async def list_available_tiles():
    """
    List available tile timestamps.

    Returns timestamps that have tiles generated.
    """
    tiles_path = Path(settings.radar_tiles_path)
    available = []

    if not tiles_path.exists():
        return {
            "timestamps": [],
            "count": 0,
            "tiles_path": str(tiles_path),
        }

    try:
        # Scan for timestamp directories
        for entry in tiles_path.iterdir():
            if entry.is_dir():
                # Check if it's a radar ID directory or a timestamp
                if len(entry.name) == 14 and entry.name.isdigit():
                    # Direct timestamp directory
                    available.append({
                        "timestamp": entry.name,
                        "path": f"/tiles/{entry.name}",
                    })
                else:
                    # Radar ID directory - scan for products and timestamps
                    radar_id = entry.name
                    for product_dir in entry.iterdir():
                        if product_dir.is_dir():
                            product = product_dir.name
                            for ts_dir in product_dir.iterdir():
                                if ts_dir.is_dir() and len(ts_dir.name) == 14:
                                    available.append({
                                        "radar_id": radar_id,
                                        "product": product,
                                        "timestamp": ts_dir.name,
                                        "path": f"/tiles/{radar_id}/{product}/{ts_dir.name}",
                                    })

        # Sort by timestamp descending (most recent first)
        available.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

        # Limit to most recent 100
        available = available[:100]

    except Exception as e:
        logger.error("Failed to list available tiles", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list tiles")

    return {
        "timestamps": available,
        "count": len(available),
        "tiles_path": str(tiles_path),
    }


@app.get("/tiles/available/{radar_id}")
async def list_radar_tiles(radar_id: str, product: Optional[str] = None):
    """
    List available tiles for a specific radar.

    Args:
        radar_id: Radar identifier
        product: Optional product filter
    """
    radar_path = Path(settings.radar_tiles_path) / radar_id
    available = []

    if not radar_path.exists():
        return {
            "radar_id": radar_id,
            "timestamps": [],
            "count": 0,
        }

    try:
        for product_dir in radar_path.iterdir():
            if not product_dir.is_dir():
                continue

            if product and product_dir.name != product:
                continue

            for ts_dir in product_dir.iterdir():
                if ts_dir.is_dir() and len(ts_dir.name) == 14:
                    available.append({
                        "product": product_dir.name,
                        "timestamp": ts_dir.name,
                        "path": f"/tiles/{radar_id}/{product_dir.name}/{ts_dir.name}",
                    })

        # Sort by timestamp descending
        available.sort(key=lambda x: x["timestamp"], reverse=True)
        available = available[:100]

    except Exception as e:
        logger.error("Failed to list radar tiles", radar_id=radar_id, error=str(e))
        raise HTTPException(status_code=500, detail="Failed to list tiles")

    return {
        "radar_id": radar_id,
        "timestamps": available,
        "count": len(available),
    }


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
