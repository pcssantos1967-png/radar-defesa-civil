"""
Radar Quality Control Module

Implements various quality control algorithms for radar data:
- Ground clutter removal
- Speckle filtering
- Attenuation correction
- Data masking
"""

import numpy as np
import xarray as xr
from scipy import ndimage
from typing import Optional
import structlog

logger = structlog.get_logger()


class QualityControl:
    """Quality control processor for radar data."""

    def __init__(
        self,
        texture_threshold: float = 10.0,
        speckle_size: int = 3,
        min_reflectivity: float = -10.0,
        max_reflectivity: float = 70.0,
    ):
        self.texture_threshold = texture_threshold
        self.speckle_size = speckle_size
        self.min_reflectivity = min_reflectivity
        self.max_reflectivity = max_reflectivity

    def process(self, data: xr.Dataset) -> xr.Dataset:
        """
        Apply all quality control steps to radar data.

        Args:
            data: xarray Dataset with reflectivity data

        Returns:
            Quality-controlled xarray Dataset
        """
        logger.info("Starting quality control processing")

        result = data.copy(deep=True)

        # Apply each QC step
        if "reflectivity" in result:
            refl = result["reflectivity"].values

            # 1. Range-based clutter filter
            refl = self._remove_range_clutter(refl, result.range.values)

            # 2. Texture-based filter
            refl = self._texture_filter(refl)

            # 3. Speckle removal
            refl = self._despeckle(refl)

            # 4. Value bounds check
            refl = self._apply_bounds(refl)

            # 5. Calculate quality score
            quality = self._calculate_quality_score(refl, data["reflectivity"].values)

            result["reflectivity"].values = refl
            result["quality_score"] = (result["reflectivity"].dims, quality)

        logger.info("Quality control complete")
        return result

    def _remove_range_clutter(
        self, data: np.ndarray, ranges: np.ndarray, near_range_km: float = 5.0
    ) -> np.ndarray:
        """
        Remove clutter in near-range bins.

        Ground clutter is most prominent in the first few kilometers.
        """
        near_range_bins = np.sum(ranges < near_range_km * 1000)

        if near_range_bins > 0:
            # Apply aggressive filtering to near-range
            near_data = data[..., :near_range_bins]
            median = np.nanmedian(near_data)
            std = np.nanstd(near_data)

            # Mask values significantly above median
            clutter_mask = near_data > median + 2 * std
            near_data[clutter_mask] = np.nan
            data[..., :near_range_bins] = near_data

        return data

    def _texture_filter(self, data: np.ndarray) -> np.ndarray:
        """
        Apply texture-based filter to remove non-meteorological echoes.

        Meteorological echoes typically have smooth texture, while
        clutter and interference have high texture values.
        """
        # Calculate local standard deviation as texture measure
        kernel_size = 5
        data_filled = np.nan_to_num(data, nan=0.0)

        # Local mean
        kernel = np.ones((kernel_size, kernel_size)) / (kernel_size**2)

        if data.ndim == 2:
            local_mean = ndimage.convolve(data_filled, kernel, mode="reflect")
            local_sq_mean = ndimage.convolve(data_filled**2, kernel, mode="reflect")
        else:
            # Handle 3D data (elevation, azimuth, range)
            local_mean = ndimage.convolve(data_filled, kernel[np.newaxis, ...], mode="reflect")
            local_sq_mean = ndimage.convolve(data_filled**2, kernel[np.newaxis, ...], mode="reflect")

        texture = np.sqrt(np.maximum(local_sq_mean - local_mean**2, 0))

        # Mask high texture areas
        high_texture_mask = texture > self.texture_threshold
        data[high_texture_mask] = np.nan

        return data

    def _despeckle(self, data: np.ndarray) -> np.ndarray:
        """
        Remove isolated pixels (speckle) using morphological operations.
        """
        # Create binary mask of valid data
        valid_mask = ~np.isnan(data)

        # Remove small isolated regions
        structure = np.ones((self.speckle_size, self.speckle_size))

        if data.ndim == 2:
            cleaned_mask = ndimage.binary_opening(valid_mask, structure=structure)
            cleaned_mask = ndimage.binary_closing(cleaned_mask, structure=structure)
        else:
            cleaned_mask = np.zeros_like(valid_mask)
            for i in range(data.shape[0]):
                cleaned_mask[i] = ndimage.binary_opening(valid_mask[i], structure=structure)
                cleaned_mask[i] = ndimage.binary_closing(cleaned_mask[i], structure=structure)

        # Apply cleaned mask
        data[~cleaned_mask] = np.nan

        return data

    def _apply_bounds(self, data: np.ndarray) -> np.ndarray:
        """Apply physical bounds to reflectivity values."""
        data[data < self.min_reflectivity] = np.nan
        data[data > self.max_reflectivity] = np.nan
        return data

    def _calculate_quality_score(
        self, processed: np.ndarray, original: np.ndarray
    ) -> np.ndarray:
        """
        Calculate a quality score for each pixel.

        Score ranges from 0 (low quality) to 1 (high quality).
        """
        quality = np.ones_like(processed)

        # Reduce quality for NaN pixels
        quality[np.isnan(processed)] = 0.0

        # Reduce quality for extreme values
        extreme_mask = (processed > 60) | (processed < 0)
        quality[extreme_mask] *= 0.5

        # Reduce quality where large corrections were made
        diff = np.abs(np.nan_to_num(processed, nan=0) - np.nan_to_num(original, nan=0))
        correction_factor = np.clip(1 - diff / 20, 0, 1)
        quality *= correction_factor

        return quality


def apply_attenuation_correction(
    data: xr.Dataset,
    coefficient: float = 0.08,  # dB/km for X-band
) -> xr.Dataset:
    """
    Apply simple path-integrated attenuation correction.

    For X-band radars, attenuation in heavy rain can be significant.
    This applies a simple cumulative correction along each ray.

    Args:
        data: xarray Dataset with reflectivity
        coefficient: Attenuation coefficient in dB/km

    Returns:
        Attenuation-corrected Dataset
    """
    if "reflectivity" not in data:
        return data

    result = data.copy(deep=True)
    refl = result["reflectivity"].values
    ranges_km = result.range.values / 1000

    # Calculate range gate spacing in km
    range_spacing = np.mean(np.diff(ranges_km))

    # Simple cumulative correction along range
    # In practice, this should use iterative methods or dual-pol data
    for az_idx in range(refl.shape[-2]):
        cumulative_attenuation = 0.0
        for r_idx in range(refl.shape[-1]):
            if not np.isnan(refl[..., az_idx, r_idx]).all():
                # Estimate attenuation from reflectivity
                z_linear = 10 ** (refl[..., az_idx, r_idx] / 10)
                attenuation_this_gate = coefficient * range_spacing * (z_linear / 200) ** 0.5
                cumulative_attenuation += np.nanmean(attenuation_this_gate)

                # Apply correction
                refl[..., az_idx, r_idx] += cumulative_attenuation

    result["reflectivity"].values = refl
    result.attrs["attenuation_corrected"] = True

    return result
