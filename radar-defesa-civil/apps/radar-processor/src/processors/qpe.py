"""
Quantitative Precipitation Estimation (QPE)

Converts radar reflectivity to precipitation rates using Z-R relationships.
"""

import numpy as np
import xarray as xr
from typing import Optional, Tuple
from scipy.interpolate import griddata
import structlog

logger = structlog.get_logger()


def polar_to_cartesian_grid(
    data: np.ndarray,
    radar_lat: float,
    radar_lon: float,
    azimuths: np.ndarray,
    ranges: np.ndarray,
    grid_resolution_km: float = 1.0,
    grid_size: int = 500,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Convert polar radar data to a Cartesian lat/lon grid.

    Args:
        data: 2D array of radar data in polar coordinates (azimuth x range)
        radar_lat: Radar latitude in degrees
        radar_lon: Radar longitude in degrees
        azimuths: Array of azimuth angles in degrees (0-360)
        ranges: Array of range values in km
        grid_resolution_km: Output grid resolution in km
        grid_size: Number of grid points in each dimension

    Returns:
        Tuple of (gridded_data, lat_grid, lon_grid)
    """
    # Convert degrees to radians
    az_rad = np.radians(azimuths)

    # Create meshgrid of polar coordinates
    az_mesh, range_mesh = np.meshgrid(az_rad, ranges, indexing='ij')

    # Convert polar to local Cartesian (km)
    # Azimuth 0 = North, increases clockwise
    x_km = range_mesh * np.sin(az_mesh)
    y_km = range_mesh * np.cos(az_mesh)

    # Convert km offset to lat/lon offset
    # 1 degree latitude ≈ 111 km
    # 1 degree longitude ≈ 111 * cos(lat) km
    lat_offset = y_km / 111.0
    lon_offset = x_km / (111.0 * np.cos(np.radians(radar_lat)))

    # Calculate actual lat/lon for each polar point
    polar_lats = radar_lat + lat_offset
    polar_lons = radar_lon + lon_offset

    # Create output Cartesian grid
    grid_extent_km = grid_size * grid_resolution_km / 2
    lat_extent = grid_extent_km / 111.0
    lon_extent = grid_extent_km / (111.0 * np.cos(np.radians(radar_lat)))

    lat_grid = np.linspace(
        radar_lat - lat_extent,
        radar_lat + lat_extent,
        grid_size
    )
    lon_grid = np.linspace(
        radar_lon - lon_extent,
        radar_lon + lon_extent,
        grid_size
    )

    # Create meshgrid for output
    lon_mesh, lat_mesh = np.meshgrid(lon_grid, lat_grid)

    # Flatten polar coordinates and data for interpolation
    polar_points = np.column_stack([
        polar_lons.flatten(),
        polar_lats.flatten()
    ])
    polar_values = data.flatten()

    # Remove NaN values for interpolation
    valid_mask = ~np.isnan(polar_values)
    if np.sum(valid_mask) < 10:
        logger.warning("Insufficient valid data points for interpolation")
        return np.full((grid_size, grid_size), np.nan), lat_grid, lon_grid

    polar_points_valid = polar_points[valid_mask]
    polar_values_valid = polar_values[valid_mask]

    # Interpolate to Cartesian grid
    grid_points = np.column_stack([
        lon_mesh.flatten(),
        lat_mesh.flatten()
    ])

    try:
        gridded_values = griddata(
            polar_points_valid,
            polar_values_valid,
            grid_points,
            method='linear',
            fill_value=np.nan
        )
        gridded_data = gridded_values.reshape(grid_size, grid_size)
    except Exception as e:
        logger.error("Interpolation failed", error=str(e))
        gridded_data = np.full((grid_size, grid_size), np.nan)

    logger.info(
        "Polar to Cartesian conversion complete",
        input_shape=data.shape,
        output_shape=gridded_data.shape,
        valid_points=np.sum(~np.isnan(gridded_data)),
    )

    return gridded_data, lat_grid, lon_grid


class PrecipitationEstimator:
    """Estimate precipitation from radar reflectivity."""

    # Common Z-R relationships
    ZR_RELATIONSHIPS = {
        "marshall_palmer": {"a": 200, "b": 1.6},  # Standard stratiform
        "convective": {"a": 300, "b": 1.4},  # Convective rain
        "tropical": {"a": 250, "b": 1.2},  # Tropical climate
        "winter": {"a": 75, "b": 2.0},  # Winter/snow
    }

    def __init__(
        self,
        zr_relationship: str = "marshall_palmer",
        a: Optional[float] = None,
        b: Optional[float] = None,
        min_reflectivity: float = 5.0,
        max_rain_rate: float = 300.0,  # mm/h
    ):
        """
        Initialize precipitation estimator.

        Args:
            zr_relationship: Name of predefined Z-R relationship
            a: Custom 'a' coefficient (Z = a * R^b)
            b: Custom 'b' coefficient
            min_reflectivity: Minimum reflectivity to consider (dBZ)
            max_rain_rate: Maximum allowed rain rate (mm/h)
        """
        if a is not None and b is not None:
            self.a = a
            self.b = b
        else:
            zr = self.ZR_RELATIONSHIPS.get(zr_relationship, self.ZR_RELATIONSHIPS["marshall_palmer"])
            self.a = zr["a"]
            self.b = zr["b"]

        self.min_reflectivity = min_reflectivity
        self.max_rain_rate = max_rain_rate

    def estimate(self, data: xr.Dataset) -> xr.Dataset:
        """
        Estimate precipitation rate from reflectivity.

        Args:
            data: xarray Dataset with reflectivity (dBZ)

        Returns:
            Dataset with added precipitation_rate variable (mm/h)
        """
        if "reflectivity" not in data:
            raise ValueError("Dataset must contain 'reflectivity' variable")

        result = data.copy(deep=True)
        refl_dbz = result["reflectivity"].values.copy()

        # Mask low reflectivity
        refl_dbz[refl_dbz < self.min_reflectivity] = np.nan

        # Convert dBZ to linear Z
        z_linear = 10 ** (refl_dbz / 10)

        # Apply Z-R relationship: Z = a * R^b => R = (Z/a)^(1/b)
        rain_rate = (z_linear / self.a) ** (1 / self.b)

        # Apply maximum limit
        rain_rate = np.clip(rain_rate, 0, self.max_rain_rate)

        # Add to dataset
        result["precipitation_rate"] = (result["reflectivity"].dims, rain_rate)
        result["precipitation_rate"].attrs = {
            "units": "mm/h",
            "long_name": "Precipitation Rate",
            "zr_a": self.a,
            "zr_b": self.b,
        }

        logger.info(
            "Precipitation estimated",
            max_rate=float(np.nanmax(rain_rate)),
            mean_rate=float(np.nanmean(rain_rate)),
        )

        return result


def accumulate_precipitation(
    rain_rates: list[xr.Dataset],
    time_interval_minutes: float = 10.0,
) -> np.ndarray:
    """
    Accumulate precipitation over multiple time steps.

    Args:
        rain_rates: List of Datasets with precipitation_rate
        time_interval_minutes: Time between scans in minutes

    Returns:
        Accumulated precipitation in mm
    """
    if not rain_rates:
        return np.array([])

    accumulated = np.zeros_like(rain_rates[0]["precipitation_rate"].values)

    for ds in rain_rates:
        rate = ds["precipitation_rate"].values
        # Convert mm/h to mm for the time interval
        contribution = np.nan_to_num(rate, nan=0.0) * (time_interval_minutes / 60.0)
        accumulated += contribution

    return accumulated


def create_qpe_product(
    data: xr.Dataset,
    estimator: Optional[PrecipitationEstimator] = None,
    radar_lat: Optional[float] = None,
    radar_lon: Optional[float] = None,
    grid_resolution_km: float = 1.0,
    grid_size: int = 500,
) -> xr.Dataset:
    """
    Create a QPE product from radar data.

    This creates a Cartesian grid of precipitation estimates
    suitable for display and further analysis.

    Args:
        data: xarray Dataset with reflectivity
        estimator: PrecipitationEstimator instance
        radar_lat: Radar latitude (extracted from data if not provided)
        radar_lon: Radar longitude (extracted from data if not provided)
        grid_resolution_km: Output grid resolution in km
        grid_size: Number of grid points in each dimension

    Returns:
        QPE Dataset on Cartesian grid
    """
    if estimator is None:
        estimator = PrecipitationEstimator()

    # Estimate precipitation
    result = estimator.estimate(data)

    # Extract radar location from dataset attributes if not provided
    if radar_lat is None:
        radar_lat = float(data.attrs.get("latitude", data.attrs.get("radar_lat", -23.19)))
    if radar_lon is None:
        radar_lon = float(data.attrs.get("longitude", data.attrs.get("radar_lon", -45.89)))

    # Check if data is in polar coordinates
    if "azimuth" in result.dims and "range" in result.dims:
        # Extract coordinate arrays
        azimuths = result.coords.get("azimuth", np.linspace(0, 360, result.dims["azimuth"]))
        ranges = result.coords.get("range", np.linspace(0, 250, result.dims["range"]))

        if isinstance(azimuths, xr.DataArray):
            azimuths = azimuths.values
        if isinstance(ranges, xr.DataArray):
            ranges = ranges.values

        # Convert precipitation rate to Cartesian grid
        if "precipitation_rate" in result:
            precip_data = result["precipitation_rate"].values

            # Handle multiple elevations - use first or mean
            if len(precip_data.shape) == 3:
                precip_data = np.nanmean(precip_data, axis=0)

            gridded_precip, lat_grid, lon_grid = polar_to_cartesian_grid(
                precip_data,
                radar_lat,
                radar_lon,
                azimuths,
                ranges,
                grid_resolution_km=grid_resolution_km,
                grid_size=grid_size,
            )

            # Create new xarray Dataset with Cartesian coordinates
            cartesian_result = xr.Dataset(
                {
                    "precipitation_rate": (["lat", "lon"], gridded_precip),
                },
                coords={
                    "lat": lat_grid,
                    "lon": lon_grid,
                },
                attrs={
                    **result.attrs,
                    "radar_lat": radar_lat,
                    "radar_lon": radar_lon,
                    "grid_resolution_km": grid_resolution_km,
                    "coordinate_system": "cartesian",
                },
            )

            # Copy precipitation attributes
            cartesian_result["precipitation_rate"].attrs = result["precipitation_rate"].attrs

            # Also convert reflectivity if present
            if "reflectivity" in result:
                refl_data = result["reflectivity"].values
                if len(refl_data.shape) == 3:
                    refl_data = np.nanmax(refl_data, axis=0)

                gridded_refl, _, _ = polar_to_cartesian_grid(
                    refl_data,
                    radar_lat,
                    radar_lon,
                    azimuths,
                    ranges,
                    grid_resolution_km=grid_resolution_km,
                    grid_size=grid_size,
                )
                cartesian_result["reflectivity"] = (["lat", "lon"], gridded_refl)
                cartesian_result["reflectivity"].attrs = result["reflectivity"].attrs

            logger.info(
                "QPE product created on Cartesian grid",
                grid_size=grid_size,
                resolution_km=grid_resolution_km,
            )

            return cartesian_result

    # Return original result if not polar or conversion not possible
    return result
