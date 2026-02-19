"""
Alert Publisher Module

Publishes precipitation data and alert triggers to Redis for the alert system.
The Node.js API subscribes to these events and evaluates alert rules.
"""

import json
from datetime import datetime
from typing import Optional
import redis
import structlog
import numpy as np
from dataclasses import dataclass, asdict

from ..config.settings import get_settings

logger = structlog.get_logger()
settings = get_settings()


@dataclass
class PrecipitationUpdate:
    """Precipitation data for a municipality."""
    municipality_id: str
    observation_time: str
    source: str  # 'radar', 'gauge', 'satellite', 'merged'
    source_id: str  # radar ID or station ID
    precipitation_mm: float
    reflectivity_dbz: Optional[float] = None
    confidence: Optional[float] = None
    metadata: Optional[dict] = None


@dataclass
class CellApproachAlert:
    """Alert for convective cell approaching a municipality."""
    municipality_id: str
    cell_track_id: str
    estimated_arrival_minutes: int
    cell_severity: str
    max_reflectivity_dbz: float
    velocity_ms: float
    direction_deg: int
    metadata: Optional[dict] = None


class AlertPublisher:
    """
    Publishes radar-derived data to Redis for alert system consumption.

    The Node.js API subscribes to these Redis channels and triggers
    appropriate alert rule evaluations.
    """

    def __init__(self):
        self.redis = redis.Redis.from_url(settings.redis_url)
        self._verify_connection()

    def _verify_connection(self):
        """Verify Redis connection is working."""
        try:
            self.redis.ping()
            logger.info("Alert publisher connected to Redis")
        except redis.ConnectionError as e:
            logger.error("Failed to connect to Redis", error=str(e))
            raise

    def publish_precipitation(
        self,
        municipality_id: str,
        precipitation_mm: float,
        reflectivity_dbz: Optional[float],
        radar_id: str,
        scan_time: datetime,
        confidence: float = 0.85,
    ):
        """
        Publish precipitation observation for a municipality.

        This data is consumed by the alert system to evaluate
        precipitation-based alert rules.
        """
        update = PrecipitationUpdate(
            municipality_id=municipality_id,
            observation_time=scan_time.isoformat(),
            source='radar',
            source_id=radar_id,
            precipitation_mm=precipitation_mm,
            reflectivity_dbz=reflectivity_dbz,
            confidence=confidence,
        )

        message = json.dumps(asdict(update))

        # Publish to precipitation channel
        self.redis.publish('precipitation:update', message)

        # Also trigger rule evaluation for this municipality
        self.redis.publish('alert:evaluate', json.dumps({
            'municipality_id': municipality_id,
            'trigger': 'precipitation',
            'timestamp': scan_time.isoformat(),
        }))

        logger.debug(
            "Published precipitation update",
            municipality_id=municipality_id,
            precipitation_mm=precipitation_mm,
        )

    def publish_batch_precipitation(
        self,
        observations: list[dict],
        radar_id: str,
        scan_time: datetime,
    ):
        """
        Publish precipitation for multiple municipalities at once.

        More efficient than individual publishes when processing
        a full radar scan.
        """
        pipeline = self.redis.pipeline()
        municipality_ids = []

        for obs in observations:
            update = PrecipitationUpdate(
                municipality_id=obs['municipality_id'],
                observation_time=scan_time.isoformat(),
                source='radar',
                source_id=radar_id,
                precipitation_mm=obs['precipitation_mm'],
                reflectivity_dbz=obs.get('reflectivity_dbz'),
                confidence=obs.get('confidence', 0.85),
            )

            pipeline.publish('precipitation:update', json.dumps(asdict(update)))
            municipality_ids.append(obs['municipality_id'])

        # Execute batch publish
        pipeline.execute()

        # Trigger batch evaluation
        self.redis.publish('alert:evaluate:batch', json.dumps({
            'municipality_ids': municipality_ids,
            'trigger': 'precipitation',
            'timestamp': scan_time.isoformat(),
            'radar_id': radar_id,
        }))

        logger.info(
            "Published batch precipitation",
            count=len(observations),
            radar_id=radar_id,
        )

    def publish_cell_approach(
        self,
        municipality_id: str,
        cell_track_id: str,
        arrival_minutes: int,
        severity: str,
        max_dbz: float,
        velocity: float,
        direction: int,
    ):
        """
        Publish alert for convective cell approaching a municipality.

        Used for nowcasting-based warnings when a severe cell is
        on track to affect a municipality.
        """
        alert = CellApproachAlert(
            municipality_id=municipality_id,
            cell_track_id=cell_track_id,
            estimated_arrival_minutes=arrival_minutes,
            cell_severity=severity,
            max_reflectivity_dbz=max_dbz,
            velocity_ms=velocity,
            direction_deg=direction,
        )

        message = json.dumps(asdict(alert))

        # Publish to cell approach channel
        self.redis.publish('cell:approach', message)

        # Also trigger evaluation if severity is high
        if severity in ('strong', 'severe'):
            self.redis.publish('alert:evaluate', json.dumps({
                'municipality_id': municipality_id,
                'trigger': 'cell_approach',
                'cell_track_id': cell_track_id,
                'timestamp': datetime.now().isoformat(),
            }))

        logger.info(
            "Published cell approach alert",
            municipality_id=municipality_id,
            cell_track_id=cell_track_id,
            arrival_minutes=arrival_minutes,
            severity=severity,
        )

    def publish_radar_status(
        self,
        radar_id: str,
        status: str,  # 'operational', 'degraded', 'offline'
        last_scan: Optional[datetime] = None,
        message: Optional[str] = None,
    ):
        """
        Publish radar operational status update.

        Used to track data quality and trigger alerts when
        radar coverage is degraded.
        """
        data = {
            'radar_id': radar_id,
            'status': status,
            'timestamp': datetime.now().isoformat(),
        }

        if last_scan:
            data['last_scan'] = last_scan.isoformat()
        if message:
            data['message'] = message

        self.redis.publish('radar:status', json.dumps(data))

        # Update radar status in cache
        self.redis.hset(f'radar:{radar_id}', mapping={
            'status': status,
            'last_status_update': datetime.now().isoformat(),
        })

        logger.info("Published radar status", radar_id=radar_id, status=status)

    def store_municipality_precipitation(
        self,
        municipality_id: str,
        precipitation_mm: float,
        reflectivity_dbz: Optional[float],
        scan_time: datetime,
        radar_id: str,
    ):
        """
        Store precipitation in time-series cache for quick access.

        This allows the alert system to query recent precipitation
        without hitting the main database.
        """
        key = f'precip:{municipality_id}'
        score = scan_time.timestamp()

        data = json.dumps({
            'precipitation_mm': precipitation_mm,
            'reflectivity_dbz': reflectivity_dbz,
            'radar_id': radar_id,
            'time': scan_time.isoformat(),
        })

        # Add to sorted set (score = timestamp for time-based queries)
        self.redis.zadd(key, {data: score})

        # Trim to keep last 6 hours of data
        cutoff = score - (6 * 60 * 60)
        self.redis.zremrangebyscore(key, '-inf', cutoff)

        # Set expiry on the key (7 days)
        self.redis.expire(key, 7 * 24 * 60 * 60)

    def get_recent_precipitation(
        self,
        municipality_id: str,
        hours: int = 1,
    ) -> list[dict]:
        """
        Get recent precipitation observations from cache.

        Returns list of observations within the specified time window.
        """
        key = f'precip:{municipality_id}'
        cutoff = datetime.now().timestamp() - (hours * 60 * 60)

        results = self.redis.zrangebyscore(key, cutoff, '+inf')

        return [json.loads(r) for r in results]

    def close(self):
        """Close Redis connection."""
        self.redis.close()


# Module-level instance
_publisher: Optional[AlertPublisher] = None


def get_alert_publisher() -> AlertPublisher:
    """Get or create the alert publisher instance."""
    global _publisher
    if _publisher is None:
        _publisher = AlertPublisher()
    return _publisher


def close_alert_publisher():
    """Close the alert publisher."""
    global _publisher
    if _publisher:
        _publisher.close()
        _publisher = None
