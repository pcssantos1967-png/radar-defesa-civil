"""
Convective Cell Tracking

Implements TITAN-like algorithm for tracking convective cells.
Identifies, tracks, and predicts movement of storm cells.
"""

import numpy as np
from scipy import ndimage
from scipy.spatial.distance import cdist
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime
import uuid
import structlog

logger = structlog.get_logger()


@dataclass
class ConvectiveCell:
    """Represents a detected convective cell."""

    id: str
    track_id: str
    detection_time: datetime
    centroid_lat: float
    centroid_lng: float
    centroid_y: int  # pixel coordinates
    centroid_x: int
    max_reflectivity: float
    mean_reflectivity: float
    area_pixels: int
    area_km2: float
    vil: Optional[float] = None  # Vertically Integrated Liquid
    echo_top_km: Optional[float] = None
    velocity_x: float = 0.0  # pixels per time step
    velocity_y: float = 0.0
    velocity_ms: Optional[float] = None  # m/s
    direction_deg: Optional[int] = None
    severity: str = "weak"
    is_active: bool = True
    age_minutes: int = 0
    metadata: dict = field(default_factory=dict)


@dataclass
class CellTrack:
    """Represents a cell track over time."""

    track_id: str
    cells: list[ConvectiveCell] = field(default_factory=list)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    is_active: bool = True

    def add_cell(self, cell: ConvectiveCell):
        self.cells.append(cell)
        if self.start_time is None:
            self.start_time = cell.detection_time
        self.end_time = cell.detection_time

    @property
    def duration_minutes(self) -> float:
        if self.start_time and self.end_time:
            return (self.end_time - self.start_time).total_seconds() / 60
        return 0


class CellTracker:
    """
    TITAN-like cell tracking algorithm.

    Identifies convective cells using reflectivity thresholds,
    then tracks them across consecutive scans using overlap
    and centroid proximity.
    """

    def __init__(
        self,
        min_reflectivity: float = 35.0,  # dBZ threshold for cell detection
        min_area_km2: float = 10.0,  # Minimum cell area
        max_velocity_kmh: float = 100.0,  # Maximum cell velocity
        pixel_size_km: float = 1.0,  # Grid resolution
        time_step_minutes: float = 10.0,
    ):
        self.min_reflectivity = min_reflectivity
        self.min_area_km2 = min_area_km2
        self.max_velocity_kmh = max_velocity_kmh
        self.pixel_size_km = pixel_size_km
        self.time_step_minutes = time_step_minutes

        self.min_area_pixels = int(min_area_km2 / (pixel_size_km ** 2))
        self.max_displacement = int(
            max_velocity_kmh * (time_step_minutes / 60) / pixel_size_km
        )

        self.active_tracks: dict[str, CellTrack] = {}
        self.all_tracks: list[CellTrack] = []

    def detect_cells(
        self,
        reflectivity: np.ndarray,
        detection_time: datetime,
        lat_grid: Optional[np.ndarray] = None,
        lon_grid: Optional[np.ndarray] = None,
    ) -> list[ConvectiveCell]:
        """
        Detect convective cells in a reflectivity field.

        Args:
            reflectivity: 2D reflectivity array (dBZ)
            detection_time: Time of the scan
            lat_grid: Optional latitude grid
            lon_grid: Optional longitude grid

        Returns:
            List of detected ConvectiveCell objects
        """
        # Create binary mask
        mask = reflectivity >= self.min_reflectivity
        mask = np.nan_to_num(mask, nan=False).astype(bool)

        # Label connected regions
        labeled, n_labels = ndimage.label(mask)

        cells = []
        for label_id in range(1, n_labels + 1):
            cell_mask = labeled == label_id
            area_pixels = np.sum(cell_mask)

            # Filter by minimum area
            if area_pixels < self.min_area_pixels:
                continue

            # Extract cell properties
            cell_refl = reflectivity[cell_mask]
            max_refl = np.nanmax(cell_refl)
            mean_refl = np.nanmean(cell_refl)

            # Centroid (weighted by reflectivity)
            y_coords, x_coords = np.where(cell_mask)
            weights = cell_refl - self.min_reflectivity + 1
            centroid_y = int(np.average(y_coords, weights=weights))
            centroid_x = int(np.average(x_coords, weights=weights))

            # Convert to lat/lon if grids provided
            if lat_grid is not None and lon_grid is not None:
                centroid_lat = float(lat_grid[centroid_y, centroid_x])
                centroid_lng = float(lon_grid[centroid_y, centroid_x])
            else:
                centroid_lat = 0.0
                centroid_lng = 0.0

            # Calculate area in km2
            area_km2 = area_pixels * (self.pixel_size_km ** 2)

            # Determine severity
            severity = self._classify_severity(max_refl, area_km2)

            cell = ConvectiveCell(
                id=str(uuid.uuid4()),
                track_id="",  # Will be assigned during tracking
                detection_time=detection_time,
                centroid_lat=centroid_lat,
                centroid_lng=centroid_lng,
                centroid_y=centroid_y,
                centroid_x=centroid_x,
                max_reflectivity=float(max_refl),
                mean_reflectivity=float(mean_refl),
                area_pixels=int(area_pixels),
                area_km2=float(area_km2),
                severity=severity,
            )
            cells.append(cell)

        logger.info(f"Detected {len(cells)} cells")
        return cells

    def track_cells(
        self,
        current_cells: list[ConvectiveCell],
        detection_time: datetime,
    ) -> list[ConvectiveCell]:
        """
        Track cells by matching with active tracks.

        Args:
            current_cells: Cells detected in current scan
            detection_time: Time of current scan

        Returns:
            Updated cells with track assignments
        """
        if not current_cells:
            # Mark all active tracks as inactive
            for track in self.active_tracks.values():
                track.is_active = False
            self.active_tracks.clear()
            return []

        # Get previous cell positions from active tracks
        previous_cells = []
        for track_id, track in self.active_tracks.items():
            if track.cells:
                last_cell = track.cells[-1]
                previous_cells.append((track_id, last_cell))

        if not previous_cells:
            # All cells are new tracks
            for cell in current_cells:
                track_id = str(uuid.uuid4())[:8]
                cell.track_id = track_id
                track = CellTrack(track_id=track_id)
                track.add_cell(cell)
                self.active_tracks[track_id] = track
                self.all_tracks.append(track)
            return current_cells

        # Build cost matrix based on distance
        current_centroids = np.array([
            [c.centroid_x, c.centroid_y] for c in current_cells
        ])
        previous_centroids = np.array([
            [c.centroid_x, c.centroid_y] for _, c in previous_cells
        ])

        distances = cdist(current_centroids, previous_centroids)

        # Match cells using Hungarian algorithm (simplified greedy version)
        matched_current = set()
        matched_previous = set()

        while True:
            # Find minimum distance
            valid_mask = np.ones_like(distances, dtype=bool)
            for i in matched_current:
                valid_mask[i, :] = False
            for j in matched_previous:
                valid_mask[:, j] = False

            masked_distances = np.where(valid_mask, distances, np.inf)

            if np.all(np.isinf(masked_distances)):
                break

            min_idx = np.unravel_index(np.argmin(masked_distances), distances.shape)
            min_dist = distances[min_idx]

            if min_dist > self.max_displacement:
                break

            current_idx, prev_idx = min_idx
            matched_current.add(current_idx)
            matched_previous.add(prev_idx)

            # Assign to existing track
            track_id, prev_cell = previous_cells[prev_idx]
            cell = current_cells[current_idx]
            cell.track_id = track_id

            # Calculate velocity
            cell.velocity_x = cell.centroid_x - prev_cell.centroid_x
            cell.velocity_y = cell.centroid_y - prev_cell.centroid_y

            velocity_pixels = np.sqrt(cell.velocity_x**2 + cell.velocity_y**2)
            cell.velocity_ms = velocity_pixels * self.pixel_size_km * 1000 / (self.time_step_minutes * 60)

            if velocity_pixels > 0:
                cell.direction_deg = int(np.degrees(np.arctan2(cell.velocity_x, -cell.velocity_y)) % 360)

            # Update track
            track = self.active_tracks[track_id]
            cell.age_minutes = int(track.duration_minutes + self.time_step_minutes)
            track.add_cell(cell)

        # Create new tracks for unmatched current cells
        for i, cell in enumerate(current_cells):
            if i not in matched_current:
                track_id = str(uuid.uuid4())[:8]
                cell.track_id = track_id
                track = CellTrack(track_id=track_id)
                track.add_cell(cell)
                self.active_tracks[track_id] = track
                self.all_tracks.append(track)

        # Deactivate unmatched previous tracks
        for j, (track_id, _) in enumerate(previous_cells):
            if j not in matched_previous:
                track = self.active_tracks.pop(track_id, None)
                if track:
                    track.is_active = False

        return current_cells

    def predict_positions(
        self,
        lead_time_minutes: float,
    ) -> list[dict]:
        """
        Predict future cell positions based on current velocities.

        Args:
            lead_time_minutes: Forecast lead time

        Returns:
            List of predicted cell positions
        """
        predictions = []
        n_steps = lead_time_minutes / self.time_step_minutes

        for track_id, track in self.active_tracks.items():
            if not track.cells:
                continue

            last_cell = track.cells[-1]

            # Use average velocity from recent cells
            recent_cells = track.cells[-3:]  # Last 3 positions
            if len(recent_cells) >= 2:
                avg_vx = np.mean([c.velocity_x for c in recent_cells if c.velocity_x != 0])
                avg_vy = np.mean([c.velocity_y for c in recent_cells if c.velocity_y != 0])
            else:
                avg_vx = last_cell.velocity_x
                avg_vy = last_cell.velocity_y

            # Predict position
            pred_x = last_cell.centroid_x + avg_vx * n_steps
            pred_y = last_cell.centroid_y + avg_vy * n_steps

            predictions.append({
                "track_id": track_id,
                "current_x": last_cell.centroid_x,
                "current_y": last_cell.centroid_y,
                "predicted_x": pred_x,
                "predicted_y": pred_y,
                "lead_time_minutes": lead_time_minutes,
                "severity": last_cell.severity,
                "max_reflectivity": last_cell.max_reflectivity,
            })

        return predictions

    def _classify_severity(self, max_reflectivity: float, area_km2: float) -> str:
        """Classify cell severity based on properties."""
        if max_reflectivity >= 55 or area_km2 >= 100:
            return "severe"
        elif max_reflectivity >= 50 or area_km2 >= 50:
            return "strong"
        elif max_reflectivity >= 45 or area_km2 >= 25:
            return "moderate"
        else:
            return "weak"

    def get_active_cells(self) -> list[ConvectiveCell]:
        """Get all cells from currently active tracks."""
        cells = []
        for track in self.active_tracks.values():
            if track.cells:
                cells.append(track.cells[-1])
        return cells

    def get_statistics(self) -> dict:
        """Get tracking statistics."""
        return {
            "active_tracks": len(self.active_tracks),
            "total_tracks": len(self.all_tracks),
            "active_cells": len(self.get_active_cells()),
        }
