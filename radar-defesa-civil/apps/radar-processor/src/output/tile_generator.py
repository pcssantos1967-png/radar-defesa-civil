"""
Radar Tile Generator

Generates map tiles from radar data for web visualization.
"""

import numpy as np
from PIL import Image
from pathlib import Path
from typing import Optional
import structlog
from io import BytesIO

logger = structlog.get_logger()

# Radar color scale (dBZ to RGB)
RADAR_COLORMAP = [
    (-999, 5, (0, 0, 0, 0)),  # Transparent below 5 dBZ
    (5, 10, (0, 255, 255, 180)),  # Cyan
    (10, 15, (0, 200, 255, 180)),
    (15, 20, (0, 150, 255, 180)),
    (20, 25, (0, 255, 0, 200)),  # Green
    (25, 30, (0, 200, 0, 200)),
    (30, 35, (0, 150, 0, 200)),
    (35, 40, (255, 255, 0, 220)),  # Yellow
    (40, 45, (255, 200, 0, 220)),
    (45, 50, (255, 150, 0, 220)),  # Orange
    (50, 55, (255, 0, 0, 240)),  # Red
    (55, 60, (200, 0, 0, 240)),
    (60, 65, (255, 0, 255, 255)),  # Magenta
    (65, 999, (255, 255, 255, 255)),  # White
]


class TileGenerator:
    """Generate map tiles from radar data."""

    def __init__(
        self,
        tile_size: int = 256,
        output_format: str = "webp",
        quality: int = 80,
    ):
        self.tile_size = tile_size
        self.output_format = output_format
        self.quality = quality

    def generate_tiles(
        self,
        data: np.ndarray,
        bounds: tuple[float, float, float, float],  # (min_lon, min_lat, max_lon, max_lat)
        zoom_levels: list[int],
        output_dir: Path,
        timestamp: str,
    ) -> list[str]:
        """
        Generate tiles for multiple zoom levels.

        Args:
            data: 2D numpy array with reflectivity values
            bounds: Geographic bounds (min_lon, min_lat, max_lon, max_lat)
            zoom_levels: List of zoom levels to generate
            output_dir: Output directory
            timestamp: Timestamp string for file naming

        Returns:
            List of generated tile paths
        """
        generated_tiles = []

        for zoom in zoom_levels:
            tiles = self._generate_zoom_level(data, bounds, zoom, output_dir, timestamp)
            generated_tiles.extend(tiles)

        logger.info(
            "Generated tiles",
            count=len(generated_tiles),
            zoom_levels=zoom_levels,
        )

        return generated_tiles

    def _generate_zoom_level(
        self,
        data: np.ndarray,
        bounds: tuple[float, float, float, float],
        zoom: int,
        output_dir: Path,
        timestamp: str,
    ) -> list[str]:
        """Generate all tiles for a single zoom level."""
        tiles = []

        # Calculate tile coordinates
        min_lon, min_lat, max_lon, max_lat = bounds
        x_min, y_max = self._lonlat_to_tile(min_lon, max_lat, zoom)
        x_max, y_min = self._lonlat_to_tile(max_lon, min_lat, zoom)

        for x in range(x_min, x_max + 1):
            for y in range(y_min, y_max + 1):
                tile_path = self._generate_tile(data, bounds, zoom, x, y, output_dir, timestamp)
                if tile_path:
                    tiles.append(tile_path)

        return tiles

    def _generate_tile(
        self,
        data: np.ndarray,
        bounds: tuple[float, float, float, float],
        zoom: int,
        x: int,
        y: int,
        output_dir: Path,
        timestamp: str,
    ) -> Optional[str]:
        """Generate a single tile."""
        # Calculate tile bounds
        tile_bounds = self._tile_bounds(x, y, zoom)

        # Extract data for this tile
        tile_data = self._extract_tile_data(data, bounds, tile_bounds)

        if tile_data is None or np.all(np.isnan(tile_data)):
            return None

        # Convert to RGBA image
        rgba = self._dbz_to_rgba(tile_data)

        # Create image
        img = Image.fromarray(rgba, mode="RGBA")
        img = img.resize((self.tile_size, self.tile_size), Image.Resampling.BILINEAR)

        # Save tile
        tile_dir = output_dir / timestamp / str(zoom) / str(x)
        tile_dir.mkdir(parents=True, exist_ok=True)

        tile_path = tile_dir / f"{y}.{self.output_format}"

        if self.output_format == "webp":
            img.save(tile_path, "WEBP", quality=self.quality)
        else:
            img.save(tile_path, "PNG")

        return str(tile_path)

    def _extract_tile_data(
        self,
        data: np.ndarray,
        data_bounds: tuple[float, float, float, float],
        tile_bounds: tuple[float, float, float, float],
    ) -> Optional[np.ndarray]:
        """Extract data for a tile from the full dataset."""
        min_lon, min_lat, max_lon, max_lat = data_bounds
        tile_min_lon, tile_min_lat, tile_max_lon, tile_max_lat = tile_bounds

        # Check if tile intersects data bounds
        if (
            tile_max_lon < min_lon
            or tile_min_lon > max_lon
            or tile_max_lat < min_lat
            or tile_min_lat > max_lat
        ):
            return None

        # Calculate pixel coordinates
        h, w = data.shape
        lon_scale = w / (max_lon - min_lon)
        lat_scale = h / (max_lat - min_lat)

        x1 = int((tile_min_lon - min_lon) * lon_scale)
        x2 = int((tile_max_lon - min_lon) * lon_scale)
        y1 = int((max_lat - tile_max_lat) * lat_scale)
        y2 = int((max_lat - tile_min_lat) * lat_scale)

        # Clamp to data bounds
        x1 = max(0, min(x1, w - 1))
        x2 = max(0, min(x2, w))
        y1 = max(0, min(y1, h - 1))
        y2 = max(0, min(y2, h))

        if x2 <= x1 or y2 <= y1:
            return None

        return data[y1:y2, x1:x2]

    def _dbz_to_rgba(self, data: np.ndarray) -> np.ndarray:
        """Convert reflectivity values to RGBA colors."""
        h, w = data.shape
        rgba = np.zeros((h, w, 4), dtype=np.uint8)

        for min_val, max_val, color in RADAR_COLORMAP:
            mask = (data >= min_val) & (data < max_val)
            rgba[mask] = color

        return rgba

    def _lonlat_to_tile(self, lon: float, lat: float, zoom: int) -> tuple[int, int]:
        """Convert longitude/latitude to tile coordinates."""
        n = 2**zoom
        x = int((lon + 180) / 360 * n)
        lat_rad = np.radians(lat)
        y = int((1 - np.log(np.tan(lat_rad) + 1 / np.cos(lat_rad)) / np.pi) / 2 * n)
        return x, y

    def _tile_bounds(
        self, x: int, y: int, zoom: int
    ) -> tuple[float, float, float, float]:
        """Get geographic bounds for a tile."""
        n = 2**zoom
        min_lon = x / n * 360 - 180
        max_lon = (x + 1) / n * 360 - 180

        def tile_lat(y: int) -> float:
            n_pi = np.pi * (1 - 2 * y / n)
            return np.degrees(np.arctan(np.sinh(n_pi)))

        max_lat = tile_lat(y)
        min_lat = tile_lat(y + 1)

        return min_lon, min_lat, max_lon, max_lat


def generate_tile_bytes(data: np.ndarray, output_format: str = "webp") -> bytes:
    """
    Generate a single tile as bytes (for streaming).

    Args:
        data: 2D numpy array with reflectivity values
        output_format: Image format (webp or png)

    Returns:
        Image bytes
    """
    generator = TileGenerator(output_format=output_format)
    rgba = generator._dbz_to_rgba(data)

    img = Image.fromarray(rgba, mode="RGBA")
    img = img.resize((256, 256), Image.Resampling.BILINEAR)

    buffer = BytesIO()
    if output_format == "webp":
        img.save(buffer, "WEBP", quality=80)
    else:
        img.save(buffer, "PNG")

    return buffer.getvalue()
