"""
Optical Flow Nowcasting

Implements Lucas-Kanade optical flow for radar echo extrapolation.
Used for short-term precipitation forecasting (0-2 hours).
"""

import numpy as np
from scipy import ndimage
from scipy.interpolate import griddata
from typing import Optional, Tuple
import structlog

logger = structlog.get_logger()


class OpticalFlowNowcast:
    """
    Optical flow-based nowcasting using Lucas-Kanade method.

    This implementation follows the approach used in pySTEPS and similar
    operational nowcasting systems.
    """

    def __init__(
        self,
        window_size: int = 15,
        levels: int = 3,
        iterations: int = 3,
        smoothing_passes: int = 2,
    ):
        """
        Initialize optical flow calculator.

        Args:
            window_size: Size of the window for local flow estimation
            levels: Number of pyramid levels for multi-scale analysis
            iterations: Number of refinement iterations per level
            smoothing_passes: Number of smoothing passes for the flow field
        """
        self.window_size = window_size
        self.levels = levels
        self.iterations = iterations
        self.smoothing_passes = smoothing_passes

    def compute_flow(
        self,
        image1: np.ndarray,
        image2: np.ndarray,
        mask: Optional[np.ndarray] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute optical flow between two radar images.

        Args:
            image1: First radar image (earlier time)
            image2: Second radar image (later time)
            mask: Optional mask for valid data regions

        Returns:
            Tuple of (u, v) flow components in pixels per time step
        """
        # Preprocess images
        img1 = self._preprocess(image1)
        img2 = self._preprocess(image2)

        # Initialize flow fields
        h, w = img1.shape
        u = np.zeros((h, w), dtype=np.float32)
        v = np.zeros((h, w), dtype=np.float32)

        # Build image pyramids
        pyramid1 = self._build_pyramid(img1, self.levels)
        pyramid2 = self._build_pyramid(img2, self.levels)

        # Coarse-to-fine estimation
        for level in range(self.levels - 1, -1, -1):
            scale = 2 ** level
            level_img1 = pyramid1[level]
            level_img2 = pyramid2[level]

            if level < self.levels - 1:
                # Upsample flow from coarser level
                u = ndimage.zoom(u, 2, order=1) * 2
                v = ndimage.zoom(v, 2, order=1) * 2

                # Adjust size if needed
                target_shape = level_img1.shape
                if u.shape != target_shape:
                    u = u[:target_shape[0], :target_shape[1]]
                    v = v[:target_shape[0], :target_shape[1]]

            # Refine flow at this level
            for _ in range(self.iterations):
                u, v = self._lucas_kanade_step(level_img1, level_img2, u, v)

        # Apply smoothing
        for _ in range(self.smoothing_passes):
            u = ndimage.gaussian_filter(u, sigma=2)
            v = ndimage.gaussian_filter(v, sigma=2)

        # Apply mask if provided
        if mask is not None:
            u[~mask] = 0
            v[~mask] = 0

        return u, v

    def extrapolate(
        self,
        image: np.ndarray,
        u: np.ndarray,
        v: np.ndarray,
        n_steps: int,
        decay_factor: float = 0.95,
    ) -> list[np.ndarray]:
        """
        Extrapolate radar image forward in time using flow field.

        Args:
            image: Current radar image
            u: Horizontal flow component (pixels/step)
            v: Vertical flow component (pixels/step)
            n_steps: Number of time steps to extrapolate
            decay_factor: Intensity decay per step (accounts for growth/decay)

        Returns:
            List of extrapolated images
        """
        h, w = image.shape
        forecasts = []

        # Create coordinate grids
        y, x = np.mgrid[0:h, 0:w]

        current = image.copy()

        for step in range(1, n_steps + 1):
            # Calculate backward mapping coordinates
            x_back = x - u * step
            y_back = y - v * step

            # Clip to valid range
            x_back = np.clip(x_back, 0, w - 1)
            y_back = np.clip(y_back, 0, h - 1)

            # Bilinear interpolation
            forecast = ndimage.map_coordinates(
                current,
                [y_back, x_back],
                order=1,
                mode='constant',
                cval=np.nan,
            )

            # Apply decay
            forecast = forecast * (decay_factor ** step)

            forecasts.append(forecast)

        return forecasts

    def _preprocess(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for optical flow computation."""
        # Replace NaN with zeros
        result = np.nan_to_num(image, nan=0.0)

        # Normalize to 0-1 range
        vmin, vmax = np.nanmin(image), np.nanmax(image)
        if vmax > vmin:
            result = (result - vmin) / (vmax - vmin)

        return result.astype(np.float32)

    def _build_pyramid(self, image: np.ndarray, levels: int) -> list[np.ndarray]:
        """Build Gaussian image pyramid."""
        pyramid = [image]
        current = image

        for _ in range(levels - 1):
            # Gaussian smoothing then downsampling
            smoothed = ndimage.gaussian_filter(current, sigma=1)
            downsampled = smoothed[::2, ::2]
            pyramid.append(downsampled)
            current = downsampled

        return pyramid

    def _lucas_kanade_step(
        self,
        img1: np.ndarray,
        img2: np.ndarray,
        u: np.ndarray,
        v: np.ndarray,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Single Lucas-Kanade iteration.

        Solves the optical flow constraint equation:
        Ix * u + Iy * v + It = 0
        """
        h, w = img1.shape
        half_win = self.window_size // 2

        # Warp img2 using current flow estimate
        y, x = np.mgrid[0:h, 0:w]
        x_warp = np.clip(x + u, 0, w - 1)
        y_warp = np.clip(y + v, 0, h - 1)

        img2_warped = ndimage.map_coordinates(
            img2, [y_warp, x_warp], order=1, mode='constant'
        )

        # Compute image gradients
        Ix = ndimage.sobel(img1, axis=1, mode='constant') / 8.0
        Iy = ndimage.sobel(img1, axis=0, mode='constant') / 8.0
        It = img2_warped - img1

        # Compute structure tensor components (windowed)
        kernel = np.ones((self.window_size, self.window_size))

        Ix2 = ndimage.convolve(Ix * Ix, kernel, mode='constant')
        Iy2 = ndimage.convolve(Iy * Iy, kernel, mode='constant')
        IxIy = ndimage.convolve(Ix * Iy, kernel, mode='constant')
        IxIt = ndimage.convolve(Ix * It, kernel, mode='constant')
        IyIt = ndimage.convolve(Iy * It, kernel, mode='constant')

        # Solve 2x2 system: [Ix2 IxIy; IxIy Iy2] * [du; dv] = -[IxIt; IyIt]
        det = Ix2 * Iy2 - IxIy * IxIy

        # Avoid division by zero
        valid = np.abs(det) > 1e-6

        du = np.zeros_like(u)
        dv = np.zeros_like(v)

        du[valid] = (IxIy[valid] * IyIt[valid] - Iy2[valid] * IxIt[valid]) / det[valid]
        dv[valid] = (IxIy[valid] * IxIt[valid] - Ix2[valid] * IyIt[valid]) / det[valid]

        # Update flow
        u_new = u + du
        v_new = v + dv

        return u_new, v_new


def compute_nowcast(
    images: list[np.ndarray],
    time_step_minutes: float,
    lead_times_minutes: list[int],
) -> dict[int, np.ndarray]:
    """
    Compute nowcast from a sequence of radar images.

    Args:
        images: List of radar images (at least 2, most recent last)
        time_step_minutes: Time between consecutive images
        lead_times_minutes: List of forecast lead times

    Returns:
        Dictionary mapping lead time to forecast image
    """
    if len(images) < 2:
        raise ValueError("At least 2 images required for nowcasting")

    logger.info(
        "Computing nowcast",
        n_images=len(images),
        lead_times=lead_times_minutes,
    )

    # Use last two images for flow computation
    img1 = images[-2]
    img2 = images[-1]

    # Compute optical flow
    of = OpticalFlowNowcast()
    u, v = of.compute_flow(img1, img2)

    # Calculate number of steps needed
    max_lead = max(lead_times_minutes)
    n_steps = int(np.ceil(max_lead / time_step_minutes))

    # Extrapolate
    forecasts = of.extrapolate(img2, u, v, n_steps)

    # Map to requested lead times
    result = {}
    for lead_time in lead_times_minutes:
        step_idx = int(lead_time / time_step_minutes) - 1
        if 0 <= step_idx < len(forecasts):
            result[lead_time] = forecasts[step_idx]

    logger.info("Nowcast complete", n_forecasts=len(result))

    return result
