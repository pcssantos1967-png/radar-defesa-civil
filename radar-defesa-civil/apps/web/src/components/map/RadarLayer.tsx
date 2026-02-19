'use client';

import { useEffect, useRef } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useWebSocket } from '@/contexts/websocket-context';

interface RadarLayerProps {
  map: MaplibreMap | null;
  radarId: string;
  product: string;
  timestamp: string;
  opacity?: number;
}

const TILE_SERVER_URL = process.env.NEXT_PUBLIC_TILE_SERVER_URL || 'http://localhost:8080';

export function RadarLayer({
  map,
  radarId,
  product,
  timestamp,
  opacity = 0.7,
}: RadarLayerProps) {
  const { socket } = useWebSocket();
  const sourceId = 'radar-tiles';
  const layerId = 'radar-layer';

  useEffect(() => {
    if (!map) return;

    const addRadarLayer = () => {
      // Remove existing layer and source
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      // Add tile source
      const tileUrl = `${TILE_SERVER_URL}/${radarId}/${product}/${timestamp}/{z}/{x}/{y}.webp`;

      map.addSource(sourceId, {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution: 'Radar Defesa Civil',
      });

      // Add layer
      map.addLayer(
        {
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': opacity,
            'raster-fade-duration': 300,
          },
        },
        // Insert below labels
        map.getStyle().layers?.find((l) => l.type === 'symbol')?.id
      );
    };

    if (map.isStyleLoaded()) {
      addRadarLayer();
    } else {
      map.once('load', addRadarLayer);
    }

    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, radarId, product, timestamp, opacity]);

  // Update opacity when changed
  useEffect(() => {
    if (map && map.getLayer(layerId)) {
      map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
  }, [map, opacity]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket || !map) return;

    const handleRadarUpdate = (data: { radar_id: string; tile_path: string }) => {
      if (data.radar_id === radarId) {
        // Update tile source URL
        const source = map.getSource(sourceId);
        if (source && 'setTiles' in source) {
          (source as maplibregl.RasterTileSource).setTiles([
            `${TILE_SERVER_URL}${data.tile_path}`,
          ]);
        }
      }
    };

    socket.on('radar:update', handleRadarUpdate);

    return () => {
      socket.off('radar:update', handleRadarUpdate);
    };
  }, [socket, map, radarId]);

  return null;
}
