"""
ODIM HDF5 Ingestor

Reads radar data in ODIM HDF5 format (OPERA Data Information Model).
This is the standard format used by many radar manufacturers and networks.
"""

import h5py
import numpy as np
import xarray as xr
from datetime import datetime
from pathlib import Path
from typing import Optional
import structlog

logger = structlog.get_logger()


class OdimHdf5Ingestor:
    """Ingestor for ODIM HDF5 radar files."""

    def __init__(self, filepath: str | Path):
        self.filepath = Path(filepath)
        self._file: Optional[h5py.File] = None
        self._metadata: dict = {}

    def __enter__(self):
        self._file = h5py.File(self.filepath, "r")
        self._read_metadata()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._file:
            self._file.close()

    def _read_metadata(self) -> None:
        """Read radar metadata from the file."""
        if not self._file:
            return

        # Read root attributes
        what = self._file.get("what")
        where = self._file.get("where")
        how = self._file.get("how")

        self._metadata = {
            "object": self._get_attr(what, "object", "PVOL"),
            "version": self._get_attr(what, "version", "H5rad 2.3"),
            "date": self._get_attr(what, "date", ""),
            "time": self._get_attr(what, "time", ""),
            "source": self._get_attr(what, "source", ""),
            "latitude": self._get_attr(where, "lat", 0.0),
            "longitude": self._get_attr(where, "lon", 0.0),
            "height": self._get_attr(where, "height", 0.0),
            "beamwidth": self._get_attr(how, "beamwidth", 1.0),
            "wavelength": self._get_attr(how, "wavelength", 3.2),  # X-band default
        }

    def _get_attr(self, group: Optional[h5py.Group], key: str, default):
        """Safely get an attribute from an HDF5 group."""
        if group is None:
            return default
        attrs = group.attrs
        if key not in attrs:
            return default
        value = attrs[key]
        if isinstance(value, bytes):
            return value.decode("utf-8")
        return value

    @property
    def metadata(self) -> dict:
        """Return radar metadata."""
        return self._metadata

    @property
    def scan_time(self) -> datetime:
        """Return scan datetime."""
        date_str = self._metadata.get("date", "")
        time_str = self._metadata.get("time", "")
        if date_str and time_str:
            return datetime.strptime(f"{date_str}{time_str}", "%Y%m%d%H%M%S")
        return datetime.now()

    def get_sweeps(self) -> list[str]:
        """Get list of sweep/dataset names."""
        if not self._file:
            return []
        return [k for k in self._file.keys() if k.startswith("dataset")]

    def read_sweep(self, sweep_name: str) -> Optional[xr.Dataset]:
        """
        Read a single sweep/dataset from the file.

        Returns an xarray Dataset with:
        - reflectivity (dBZ)
        - velocity (m/s) if available
        - azimuth angles
        - range gates
        """
        if not self._file or sweep_name not in self._file:
            return None

        sweep = self._file[sweep_name]
        what = sweep.get("what")
        where = sweep.get("where")

        # Sweep metadata
        elangle = self._get_attr(where, "elangle", 0.5)
        nbins = self._get_attr(where, "nbins", 500)
        nrays = self._get_attr(where, "nrays", 360)
        rscale = self._get_attr(where, "rscale", 500.0)  # meters
        rstart = self._get_attr(where, "rstart", 0.0)
        a1gate = self._get_attr(where, "a1gate", 0)

        # Calculate coordinates
        ranges = np.arange(rstart, rstart + nbins * rscale, rscale)[:nbins]
        azimuths = np.linspace(a1gate, a1gate + 360, nrays, endpoint=False) % 360

        # Read data arrays
        data_vars = {}

        for data_name in sweep.keys():
            if data_name.startswith("data"):
                data_group = sweep[data_name]
                data_what = data_group.get("what")

                quantity = self._get_attr(data_what, "quantity", "DBZH")
                gain = self._get_attr(data_what, "gain", 1.0)
                offset = self._get_attr(data_what, "offset", 0.0)
                nodata = self._get_attr(data_what, "nodata", 255)
                undetect = self._get_attr(data_what, "undetect", 0)

                raw_data = data_group["data"][:]

                # Convert to physical values
                data = raw_data.astype(np.float32) * gain + offset

                # Mask invalid values
                data = np.where(raw_data == nodata, np.nan, data)
                data = np.where(raw_data == undetect, np.nan, data)

                # Map ODIM quantity names to standard names
                var_name = self._map_quantity(quantity)
                data_vars[var_name] = (["azimuth", "range"], data)

        if not data_vars:
            return None

        ds = xr.Dataset(
            data_vars,
            coords={
                "range": ranges,
                "azimuth": azimuths,
            },
            attrs={
                "elevation_angle": elangle,
                "latitude": self._metadata["latitude"],
                "longitude": self._metadata["longitude"],
                "scan_time": self.scan_time.isoformat(),
            },
        )

        return ds

    def _map_quantity(self, quantity: str) -> str:
        """Map ODIM quantity names to standard names."""
        mapping = {
            "DBZH": "reflectivity",
            "DBZV": "reflectivity_v",
            "DBZ": "reflectivity",
            "VRAD": "velocity",
            "VRADH": "velocity",
            "WRAD": "spectrum_width",
            "ZDR": "differential_reflectivity",
            "RHOHV": "cross_correlation",
            "PHIDP": "differential_phase",
            "KDP": "specific_differential_phase",
        }
        return mapping.get(quantity, quantity.lower())

    def read_volume(self) -> xr.Dataset:
        """
        Read the entire radar volume.

        Returns an xarray Dataset with all sweeps concatenated.
        """
        datasets = []
        elevations = []

        for sweep_name in self.get_sweeps():
            ds = self.read_sweep(sweep_name)
            if ds is not None:
                elevations.append(ds.attrs["elevation_angle"])
                datasets.append(ds)

        if not datasets:
            raise ValueError(f"No valid sweeps found in {self.filepath}")

        # Stack sweeps along elevation dimension
        volume = xr.concat(datasets, dim="elevation")
        volume = volume.assign_coords(elevation=elevations)
        volume.attrs.update(self._metadata)

        return volume


def read_odim_hdf5(filepath: str | Path) -> xr.Dataset:
    """
    Convenience function to read an ODIM HDF5 file.

    Args:
        filepath: Path to the HDF5 file

    Returns:
        xarray Dataset containing the radar volume
    """
    with OdimHdf5Ingestor(filepath) as ingestor:
        return ingestor.read_volume()
