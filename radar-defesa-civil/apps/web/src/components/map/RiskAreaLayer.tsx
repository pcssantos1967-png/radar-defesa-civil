'use client';

import { useEffect, useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { api } from '@/services/api';

interface RiskAreaLayerProps {
  map: MaplibreMap | null;
  visible?: boolean;
  municipalityId?: string;
}

interface RiskArea {
  id: string;
  name: string;
  riskType: string;
  severity: string;
  populationAtRisk?: number;
}

const SOURCE_ID = 'risk-areas';
const FILL_LAYER_ID = 'risk-areas-fill';
const LINE_LAYER_ID = 'risk-areas-line';

const SEVERITY_COLORS: Record<string, string> = {
  high: '#FF1744',
  medium: '#FF9800',
  low: '#FFD600',
};

const RISK_TYPE_PATTERNS: Record<string, string> = {
  flood: 'flood-pattern',
  landslide: 'landslide-pattern',
  flashflood: 'flashflood-pattern',
};

export function RiskAreaLayer({
  map,
  visible = false,
  municipalityId,
}: RiskAreaLayerProps) {
  const [riskAreas, setRiskAreas] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    if (municipalityId) {
      loadRiskAreas(municipalityId);
    }
  }, [municipalityId]);

  const loadRiskAreas = async (munId: string) => {
    try {
      const response = await api.get<{ data: { riskAreas: RiskArea[] } }>(
        `/municipalities/${munId}/risk-areas`
      );

      // Convert to GeoJSON (simplified)
      const features: GeoJSON.Feature[] = response.data.riskAreas.map((area) => ({
        type: 'Feature',
        properties: {
          id: area.id,
          name: area.name,
          riskType: area.riskType,
          severity: area.severity,
          populationAtRisk: area.populationAtRisk,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [], // Would be actual boundaries
        },
      }));

      setRiskAreas({
        type: 'FeatureCollection',
        features,
      });
    } catch (error) {
      console.error('Failed to load risk areas:', error);
    }
  };

  useEffect(() => {
    if (!map || !riskAreas) return;

    const addLayers = () => {
      // Add source
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: riskAreas,
        });
      } else {
        (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(riskAreas);
      }

      // Add fill layer with data-driven styling
      if (!map.getLayer(FILL_LAYER_ID)) {
        map.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': [
              'match',
              ['get', 'severity'],
              'high', SEVERITY_COLORS.high,
              'medium', SEVERITY_COLORS.medium,
              'low', SEVERITY_COLORS.low,
              '#808080',
            ],
            'fill-opacity': 0.3,
          },
        });
      }

      // Add line layer
      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': [
              'match',
              ['get', 'severity'],
              'high', SEVERITY_COLORS.high,
              'medium', SEVERITY_COLORS.medium,
              'low', SEVERITY_COLORS.low,
              '#808080',
            ],
            'line-width': 2,
            'line-dasharray': [2, 2],
          },
        });
      }

      // Add popup on click
      map.on('click', FILL_LAYER_ID, (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const coordinates = e.lngLat;

          const popup = new (window as any).maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(`
              <div class="bg-background-secondary p-3 rounded">
                <h3 class="font-semibold text-text">${feature.properties?.name || 'Área de Risco'}</h3>
                <p class="text-sm text-text-secondary">Tipo: ${feature.properties?.riskType}</p>
                <p class="text-sm text-text-secondary">Severidade: ${feature.properties?.severity}</p>
                ${feature.properties?.populationAtRisk ? `<p class="text-sm text-text-secondary">Pop. em risco: ${feature.properties.populationAtRisk}</p>` : ''}
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

    return () => {
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
    };
  }, [map, riskAreas]);

  // Toggle visibility
  useEffect(() => {
    if (!map) return;

    const visibility = visible ? 'visible' : 'none';

    [FILL_LAYER_ID, LINE_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    });
  }, [map, visible]);

  return null;
}
