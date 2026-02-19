'use client';

import { useEffect, useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { useWebSocket } from '@/contexts/websocket-context';

interface CellTrackingLayerProps {
  map: MaplibreMap | null;
  visible?: boolean;
}

interface ConvectiveCell {
  track_id: string;
  lat: number;
  lng: number;
  max_reflectivity: number;
  severity: string;
  velocity_ms?: number;
  direction?: number;
}

const SOURCE_ID = 'convective-cells';
const CIRCLE_LAYER_ID = 'cells-circle';
const ARROW_LAYER_ID = 'cells-arrow';

const SEVERITY_COLORS: Record<string, string> = {
  weak: '#4CAF50',
  moderate: '#FFD600',
  strong: '#FF9800',
  severe: '#FF1744',
};

export function CellTrackingLayer({ map, visible = true }: CellTrackingLayerProps) {
  const { socket } = useWebSocket();
  const [cells, setCells] = useState<ConvectiveCell[]>([]);

  // Listen for cell updates
  useEffect(() => {
    if (!socket) return;

    const handleCellsUpdate = (data: { cells: ConvectiveCell[] }) => {
      setCells(data.cells || []);
    };

    socket.on('cells:update', handleCellsUpdate);

    return () => {
      socket.off('cells:update', handleCellsUpdate);
    };
  }, [socket]);

  // Update map layer
  useEffect(() => {
    if (!map) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: cells.map((cell) => ({
        type: 'Feature',
        properties: {
          track_id: cell.track_id,
          max_reflectivity: cell.max_reflectivity,
          severity: cell.severity,
          velocity_ms: cell.velocity_ms,
          direction: cell.direction,
        },
        geometry: {
          type: 'Point',
          coordinates: [cell.lng, cell.lat],
        },
      })),
    };

    const addLayers = () => {
      // Add source
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geojson,
        });
      } else {
        (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
        return;
      }

      // Add circle layer for cell centers
      if (!map.getLayer(CIRCLE_LAYER_ID)) {
        map.addLayer({
          id: CIRCLE_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'max_reflectivity'],
              35, 8,
              50, 15,
              60, 25,
            ],
            'circle-color': [
              'match',
              ['get', 'severity'],
              'severe', SEVERITY_COLORS.severe,
              'strong', SEVERITY_COLORS.strong,
              'moderate', SEVERITY_COLORS.moderate,
              'weak', SEVERITY_COLORS.weak,
              '#808080',
            ],
            'circle-opacity': 0.7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      // Add symbol layer for direction arrows
      if (!map.getLayer(ARROW_LAYER_ID)) {
        map.addLayer({
          id: ARROW_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'icon-image': 'arrow',
            'icon-size': 0.5,
            'icon-rotate': ['get', 'direction'],
            'icon-allow-overlap': true,
          },
          filter: ['has', 'direction'],
        });
      }

      // Add click handler
      map.on('click', CIRCLE_LAYER_ID, (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];

          new (window as any).maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <div class="p-2">
                <h3 class="font-semibold">Célula ${feature.properties?.track_id}</h3>
                <p class="text-sm">Refletividade: ${feature.properties?.max_reflectivity?.toFixed(1)} dBZ</p>
                <p class="text-sm">Severidade: ${feature.properties?.severity}</p>
                ${feature.properties?.velocity_ms ? `<p class="text-sm">Velocidade: ${feature.properties.velocity_ms.toFixed(1)} m/s</p>` : ''}
                ${feature.properties?.direction ? `<p class="text-sm">Direção: ${feature.properties.direction}°</p>` : ''}
              </div>
            `)
            .addTo(map);
        }
      });
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once('load', addLayers);
    }
  }, [map, cells]);

  // Toggle visibility
  useEffect(() => {
    if (!map) return;

    const visibility = visible ? 'visible' : 'none';

    [CIRCLE_LAYER_ID, ARROW_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    });
  }, [map, visible]);

  return null;
}
