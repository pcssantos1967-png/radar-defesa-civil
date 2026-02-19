"""
Redis Cache Utilities

Provides caching and pub/sub utilities for radar data.
"""

import json
import redis
from typing import Optional, Any
from datetime import timedelta
import structlog

from ..config.settings import get_settings

logger = structlog.get_logger()
settings = get_settings()


class RedisCache:
    """Redis cache client for radar data."""

    def __init__(self, url: Optional[str] = None):
        self.redis = redis.Redis.from_url(url or settings.redis_url)
        self._pubsub = None

    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache."""
        data = self.redis.get(key)
        if data:
            return json.loads(data)
        return None

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[int] = None,
    ):
        """Set a value in cache."""
        data = json.dumps(value, default=str)
        if ttl_seconds:
            self.redis.setex(key, ttl_seconds, data)
        else:
            self.redis.set(key, data)

    def delete(self, key: str):
        """Delete a key from cache."""
        self.redis.delete(key)

    def delete_pattern(self, pattern: str):
        """Delete all keys matching a pattern."""
        keys = self.redis.keys(pattern)
        if keys:
            self.redis.delete(*keys)

    def publish(self, channel: str, message: Any):
        """Publish a message to a channel."""
        data = json.dumps(message, default=str)
        self.redis.publish(channel, data)

    def subscribe(self, *channels: str):
        """Subscribe to channels."""
        if self._pubsub is None:
            self._pubsub = self.redis.pubsub()
        self._pubsub.subscribe(*channels)
        return self._pubsub

    # Radar-specific methods

    def get_latest_scan(self, radar_id: str) -> Optional[dict]:
        """Get the latest scan info for a radar."""
        return self.get(f"radar:{radar_id}:latest")

    def set_latest_scan(self, radar_id: str, scan_info: dict, ttl_seconds: int = 3600):
        """Set the latest scan info for a radar."""
        self.set(f"radar:{radar_id}:latest", scan_info, ttl_seconds)

    def get_radar_status(self, radar_id: str) -> Optional[dict]:
        """Get radar status."""
        data = self.redis.hgetall(f"radar:{radar_id}")
        if data:
            return {k.decode(): v.decode() for k, v in data.items()}
        return None

    def set_radar_status(self, radar_id: str, status: dict):
        """Set radar status."""
        self.redis.hset(f"radar:{radar_id}", mapping=status)

    def get_active_cells(self, radar_id: str) -> list[dict]:
        """Get active convective cells for a radar."""
        data = self.get(f"radar:{radar_id}:cells")
        return data or []

    def set_active_cells(self, radar_id: str, cells: list[dict], ttl_seconds: int = 600):
        """Set active convective cells for a radar."""
        self.set(f"radar:{radar_id}:cells", cells, ttl_seconds)

    def add_to_precipitation_history(
        self,
        municipality_id: str,
        timestamp: str,
        value: float,
        max_entries: int = 144,  # 24h at 10min intervals
    ):
        """Add precipitation observation to history."""
        key = f"precip:{municipality_id}:history"
        entry = json.dumps({"timestamp": timestamp, "value": value})

        self.redis.lpush(key, entry)
        self.redis.ltrim(key, 0, max_entries - 1)

    def get_precipitation_history(
        self,
        municipality_id: str,
        count: int = 144,
    ) -> list[dict]:
        """Get precipitation history for a municipality."""
        key = f"precip:{municipality_id}:history"
        entries = self.redis.lrange(key, 0, count - 1)

        return [json.loads(e) for e in entries]


# Global cache instance
_cache: Optional[RedisCache] = None


def get_cache() -> RedisCache:
    """Get the global cache instance."""
    global _cache
    if _cache is None:
        _cache = RedisCache()
    return _cache
