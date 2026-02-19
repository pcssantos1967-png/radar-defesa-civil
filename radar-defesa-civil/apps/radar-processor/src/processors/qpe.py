"""
Quantitative Precipitation Estimation (QPE)

Converts radar reflectivity to precipitation rates using Z-R relationships.
"""

import numpy as np
import xarray as xr
from typing import Optional
import structlog

logger = structlog.get_logger()


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
) -> xr.Dataset:
    """
    Create a QPE product from radar data.

    This creates a Cartesian grid of precipitation estimates
    suitable for display and further analysis.

    Args:
        data: xarray Dataset with reflectivity
        estimator: PrecipitationEstimator instance

    Returns:
        QPE Dataset on Cartesian grid
    """
    if estimator is None:
        estimator = PrecipitationEstimator()

    # Estimate precipitation
    result = estimator.estimate(data)

    # TODO: Implement polar to Cartesian conversion
    # For now, return polar coordinates

    return result
