"""
Radar Processing Pipeline

Main processing pipeline that orchestrates:
1. File ingestion
2. Quality control
3. Product generation
4. Tile creation
5. Database updates
6. Redis publishing
"""

import asyncio
import json
from pathlib import Path
from datetime import datetime
from typing import Optional
import numpy as np
import redis
import structlog
from dataclasses import dataclass, asdict

from ..config.settings import get_settings
from ..ingest import read_odim_hdf5
from ..processors import QualityControl, PrecipitationEstimator
from ..algorithms import CellTracker, compute_nowcast
from ..output import TileGenerator
from ..alerts import get_alert_publisher

logger = structlog.get_logger()
settings = get_settings()


@dataclass
class ProcessingResult:
    """Result of processing a radar scan."""

    radar_id: str
    scan_time: datetime
    file_path: str
    products: list[str]
    tile_paths: dict[str, str]
    cells_detected: int
    quality_score: float
    processing_time_ms: float
    success: bool
    error: Optional[str] = None


class RadarPipeline:
    """
    Main radar processing pipeline.

    Processes radar files through all stages and publishes results.
    """

    def __init__(self):
        self.redis = redis.Redis.from_url(settings.redis_url)
        self.qc = QualityControl()
        self.qpe = PrecipitationEstimator()
        self.cell_tracker = CellTracker()
        self.tile_generator = TileGenerator(
            tile_size=settings.tile_size,
            output_format=settings.tile_format,
            quality=settings.tile_quality,
        )
        self.alert_publisher = get_alert_publisher()

        # Cache for recent scans (for nowcasting)
        self.recent_scans: list[tuple[datetime, np.ndarray]] = []
        self.max_recent_scans = 6  # Keep last 6 scans for nowcasting

    async def process_file(
        self,
        file_path: str,
        radar_id: str,
    ) -> ProcessingResult:
        """
        Process a single radar file through the complete pipeline.

        Args:
            file_path: Path to the radar file
            radar_id: Radar identifier

        Returns:
            ProcessingResult with details of processing
        """
        start_time = datetime.now()
        logger.info("Starting processing", file_path=file_path, radar_id=radar_id)

        try:
            # 1. Ingest file
            volume = read_odim_hdf5(file_path)
            scan_time = datetime.fromisoformat(volume.attrs.get("scan_time", datetime.now().isoformat()))

            # 2. Quality control
            qc_data = self.qc.process(volume)
            quality_score = float(np.nanmean(qc_data.get("quality_score", 0.95)))

            # 3. Generate products
            products = []
            tile_paths = {}

            # Max reflectivity (MAX-Z)
            if "reflectivity" in qc_data:
                max_z = qc_data["reflectivity"].max(dim="elevation")
                products.append("MAX-Z")

                # Generate tiles
                bounds = self._get_radar_bounds(volume)
                tiles = await self._generate_tiles(
                    max_z.values,
                    bounds,
                    scan_time,
                    radar_id,
                    "MAX-Z",
                )
                tile_paths["MAX-Z"] = tiles

            # QPE
            qpe_data = self.qpe.estimate(qc_data)
            if "precipitation_rate" in qpe_data:
                products.append("QPE")

                # Publish precipitation to alert system
                await self._publish_precipitation_alerts(
                    qpe_data,
                    qc_data,
                    radar_id,
                    scan_time,
                )

            # 4. Cell tracking
            if "reflectivity" in qc_data:
                cells = self.cell_tracker.detect_cells(
                    max_z.values if 'max_z' in dir() else qc_data["reflectivity"].values[0],
                    scan_time,
                )
                cells = self.cell_tracker.track_cells(cells, scan_time)
                cells_detected = len(cells)

                # Publish cell approach alerts for severe cells
                if cells_detected > 0:
                    await self._publish_cell_approach_alerts(cells, radar_id, scan_time)

                # Store for nowcasting
                self._update_recent_scans(scan_time, max_z.values if 'max_z' in dir() else qc_data["reflectivity"].values[0])
            else:
                cells_detected = 0

            # 5. Nowcasting (if enough history)
            if len(self.recent_scans) >= 2:
                await self._run_nowcast(radar_id, scan_time)

            # 6. Publish to Redis
            await self._publish_update(radar_id, scan_time, products, tile_paths, cells_detected)

            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            result = ProcessingResult(
                radar_id=radar_id,
                scan_time=scan_time,
                file_path=file_path,
                products=products,
                tile_paths={k: v[0] if v else "" for k, v in tile_paths.items()},
                cells_detected=cells_detected,
                quality_score=quality_score,
                processing_time_ms=processing_time,
                success=True,
            )

            logger.info(
                "Processing complete",
                radar_id=radar_id,
                products=products,
                cells=cells_detected,
                time_ms=processing_time,
            )

            return result

        except Exception as e:
            logger.error("Processing failed", error=str(e), file_path=file_path)
            processing_time = (datetime.now() - start_time).total_seconds() * 1000

            return ProcessingResult(
                radar_id=radar_id,
                scan_time=datetime.now(),
                file_path=file_path,
                products=[],
                tile_paths={},
                cells_detected=0,
                quality_score=0.0,
                processing_time_ms=processing_time,
                success=False,
                error=str(e),
            )

    async def _generate_tiles(
        self,
        data: np.ndarray,
        bounds: tuple[float, float, float, float],
        scan_time: datetime,
        radar_id: str,
        product: str,
    ) -> list[str]:
        """Generate map tiles for a radar product."""
        timestamp = scan_time.strftime("%Y%m%d%H%M%S")
        output_dir = Path(settings.radar_tiles_path) / radar_id / product

        return self.tile_generator.generate_tiles(
            data,
            bounds,
            settings.tile_zoom_levels,
            output_dir,
            timestamp,
        )

    def _get_radar_bounds(self, volume) -> tuple[float, float, float, float]:
        """Calculate geographic bounds of radar coverage."""
        lat = float(volume.attrs.get("latitude", -23.19))
        lon = float(volume.attrs.get("longitude", -45.89))
        range_km = 250  # Default range

        # Approximate bounds (simplified)
        lat_offset = range_km / 111.0
        lon_offset = range_km / (111.0 * np.cos(np.radians(lat)))

        return (
            lon - lon_offset,
            lat - lat_offset,
            lon + lon_offset,
            lat + lat_offset,
        )

    def _update_recent_scans(self, scan_time: datetime, data: np.ndarray):
        """Update cache of recent scans for nowcasting."""
        self.recent_scans.append((scan_time, data.copy()))

        # Keep only recent scans
        if len(self.recent_scans) > self.max_recent_scans:
            self.recent_scans.pop(0)

    async def _publish_precipitation_alerts(
        self,
        qpe_data: dict,
        qc_data: dict,
        radar_id: str,
        scan_time: datetime,
    ):
        """
        Calculate municipality-level precipitation and publish to alert system.

        This extracts mean precipitation for each municipality within radar
        coverage and publishes to Redis for alert rule evaluation.
        """
        try:
            # Get municipality precipitation estimates
            # In production, this would use spatial queries against municipality polygons
            # For now, we publish aggregated data per grid cell region

            precipitation_rate = qpe_data.get("precipitation_rate")
            reflectivity = qc_data.get("reflectivity")

            if precipitation_rate is None:
                return

            # Convert rate (mm/h) to accumulation for scan interval
            interval_hours = settings.radar_scan_interval / 60
            precipitation_mm = float(np.nanmean(precipitation_rate) * interval_hours)

            # Get mean reflectivity
            mean_reflectivity = None
            if reflectivity is not None:
                mean_reflectivity = float(np.nanmean(reflectivity))

            # Load municipality mappings from cache or database
            # This is a simplified version - in production use spatial lookups
            municipality_ids = await self._get_affected_municipalities(radar_id)

            # Prepare batch observations
            observations = []
            for municipality_id in municipality_ids:
                observations.append({
                    'municipality_id': municipality_id,
                    'precipitation_mm': precipitation_mm,
                    'reflectivity_dbz': mean_reflectivity,
                    'confidence': 0.85,
                })

            # Publish batch to alert system
            if observations:
                self.alert_publisher.publish_batch_precipitation(
                    observations,
                    radar_id,
                    scan_time,
                )

                # Store in time-series cache
                for obs in observations:
                    self.alert_publisher.store_municipality_precipitation(
                        obs['municipality_id'],
                        obs['precipitation_mm'],
                        obs.get('reflectivity_dbz'),
                        scan_time,
                        radar_id,
                    )

            logger.debug(
                "Published precipitation alerts",
                radar_id=radar_id,
                municipality_count=len(observations),
                mean_precipitation_mm=precipitation_mm,
            )

        except Exception as e:
            logger.error("Failed to publish precipitation alerts", error=str(e))

    async def _get_affected_municipalities(self, radar_id: str) -> list[str]:
        """
        Get list of municipality IDs within radar coverage area.

        In production, this should query the database for municipalities
        whose boundaries intersect with the radar's coverage area.
        For now, returns cached municipality list.
        """
        cache_key = f'radar:{radar_id}:municipalities'
        cached = self.redis.get(cache_key)

        if cached:
            return json.loads(cached)

        # Default: return empty list (municipalities should be configured)
        # In production, query database with spatial intersection
        return []

    async def _publish_cell_approach_alerts(
        self,
        cells: list,
        radar_id: str,
        scan_time: datetime,
    ):
        """
        Check if convective cells are approaching municipalities
        and publish approach alerts.
        """
        try:
            for cell in cells:
                if cell.severity not in ('strong', 'severe'):
                    continue

                # Get municipalities in cell's projected path
                # This requires spatial prediction based on velocity/direction
                affected = await self._get_municipalities_in_path(
                    cell.centroid_lat,
                    cell.centroid_lng,
                    cell.velocity_ms,
                    cell.direction_deg,
                    lead_time_minutes=60,
                )

                for municipality_id, arrival_minutes in affected:
                    self.alert_publisher.publish_cell_approach(
                        municipality_id=municipality_id,
                        cell_track_id=cell.track_id,
                        arrival_minutes=arrival_minutes,
                        severity=cell.severity,
                        max_dbz=cell.max_reflectivity,
                        velocity=cell.velocity_ms,
                        direction=cell.direction_deg,
                    )

        except Exception as e:
            logger.error("Failed to publish cell approach alerts", error=str(e))

    async def _get_municipalities_in_path(
        self,
        lat: float,
        lng: float,
        velocity_ms: float,
        direction_deg: int,
        lead_time_minutes: int,
    ) -> list[tuple[str, int]]:
        """
        Calculate which municipalities are in the projected path
        of a convective cell.

        Returns list of (municipality_id, estimated_arrival_minutes) tuples.
        """
        # This is a placeholder - in production, use spatial queries
        # to find municipalities along the projected trajectory
        return []

    async def _run_nowcast(self, radar_id: str, current_time: datetime):
        """Generate nowcast products."""
        try:
            images = [scan[1] for scan in self.recent_scans]
            time_step = settings.radar_scan_interval / 60  # minutes

            forecasts = compute_nowcast(
                images,
                time_step,
                settings.nowcast_lead_times,
            )

            # Generate tiles for each lead time
            bounds = (-46.89, -24.19, -44.89, -22.19)  # Default bounds

            for lead_time, forecast in forecasts.items():
                output_dir = Path(settings.radar_tiles_path) / radar_id / f"NOWCAST-{lead_time}"
                timestamp = current_time.strftime("%Y%m%d%H%M%S")

                self.tile_generator.generate_tiles(
                    forecast,
                    bounds,
                    settings.tile_zoom_levels,
                    output_dir,
                    timestamp,
                )

            # Publish nowcast update
            self.redis.publish(
                "nowcast:update",
                json.dumps({
                    "radar_id": radar_id,
                    "issue_time": current_time.isoformat(),
                    "lead_times": list(forecasts.keys()),
                }),
            )

            logger.info("Nowcast generated", lead_times=list(forecasts.keys()))

        except Exception as e:
            logger.error("Nowcast failed", error=str(e))

    async def _publish_update(
        self,
        radar_id: str,
        scan_time: datetime,
        products: list[str],
        tile_paths: dict,
        cells_detected: int,
    ):
        """Publish processing results to Redis for real-time distribution."""
        # Radar update event
        update = {
            "radar_id": radar_id,
            "scan_time": scan_time.isoformat(),
            "products": products,
            "tile_path": f"/tiles/{radar_id}/MAX-Z/{scan_time.strftime('%Y%m%d%H%M%S')}/{{z}}/{{x}}/{{y}}.webp",
            "cells_detected": cells_detected,
        }

        self.redis.publish("radar:update", json.dumps(update))

        # Update last scan time
        self.redis.hset(
            f"radar:{radar_id}",
            mapping={
                "last_scan": scan_time.isoformat(),
                "status": "operational",
            },
        )

        # Publish cell tracking data
        if cells_detected > 0:
            cells = self.cell_tracker.get_active_cells()
            cell_data = {
                "radar_id": radar_id,
                "detection_time": scan_time.isoformat(),
                "cells": [
                    {
                        "track_id": c.track_id,
                        "lat": c.centroid_lat,
                        "lng": c.centroid_lng,
                        "max_reflectivity": c.max_reflectivity,
                        "severity": c.severity,
                        "velocity_ms": c.velocity_ms,
                        "direction": c.direction_deg,
                    }
                    for c in cells
                ],
            }
            self.redis.publish("cells:update", json.dumps(cell_data))


class FileWatcher:
    """
    Watches a directory for new radar files and triggers processing.
    """

    def __init__(
        self,
        watch_path: str,
        radar_id: str,
        pipeline: RadarPipeline,
    ):
        self.watch_path = Path(watch_path)
        self.radar_id = radar_id
        self.pipeline = pipeline
        self.processed_files: set[str] = set()

    async def watch(self):
        """Start watching for new files."""
        logger.info("Starting file watcher", path=str(self.watch_path))

        while True:
            try:
                await self._check_for_new_files()
            except Exception as e:
                logger.error("Watcher error", error=str(e))

            await asyncio.sleep(10)  # Check every 10 seconds

    async def _check_for_new_files(self):
        """Check for new files and process them."""
        if not self.watch_path.exists():
            return

        # Find HDF5 files
        for file_path in self.watch_path.glob("*.h5"):
            if str(file_path) not in self.processed_files:
                logger.info("New file detected", file=str(file_path))

                result = await self.pipeline.process_file(
                    str(file_path),
                    self.radar_id,
                )

                if result.success:
                    self.processed_files.add(str(file_path))

        # Also check for .hdf5 extension
        for file_path in self.watch_path.glob("*.hdf5"):
            if str(file_path) not in self.processed_files:
                result = await self.pipeline.process_file(
                    str(file_path),
                    self.radar_id,
                )

                if result.success:
                    self.processed_files.add(str(file_path))
