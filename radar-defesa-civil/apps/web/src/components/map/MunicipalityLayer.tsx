'use client';

import { useEffect, useState } from 'react';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { api } from '@/services/api';

interface MunicipalityLayerProps {
  map: MaplibreMap | null;
  visible?: boolean;
  onMunicipalityClick?: (municipality: MunicipalityFeature) => void;
}

interface MunicipalityFeature {
  id: string;
  name: string;
  ibgeCode: string;
  population?: number;
}

const SOURCE_ID = 'municipalities';
const FILL_LAYER_ID = 'municipalities-fill';
const LINE_LAYER_ID = 'municipalities-line';
const LABEL_LAYER_ID = 'municipalities-label';

export function MunicipalityLayer({
  map,
  visible = true,
  onMunicipalityClick,
}: MunicipalityLayerProps) {
  const [geojsonData, setGeojsonData] = useState<GeoJSON.FeatureCollection | null>(null);

  // Load municipality boundaries
  useEffect(() => {
    loadMunicipalityBoundaries();
  }, []);

  const loadMunicipalityBoundaries = async () => {
    try {
      // In production, this would fetch from IBGE or your API
      // For now, create a simple placeholder
      const response = await api.get<{ data: { municipalities: MunicipalityFeature[] } }>(
        '/municipalities'
      );

      // Convert to GeoJSON (simplified - actual implementation would use real boundaries)
      const features: GeoJSON.Feature[] = response.data.municipalities.map((m) => ({
        type: 'Feature',
        properties: {
          id: m.id,
          name: m.name,
          ibgeCode: m.ibgeCode,
          population: m.population,
        },
        geometry: {
          type: 'Point',
          coordinates: [0, 0], // Would be actual boundaries
        },
      }));

      setGeojsonData({
        type: 'FeatureCollection',
        features,
      });
    } catch (error) {
      console.error('Failed to load municipalities:', error);
    }
  };

  useEffect(() => {
    if (!map || !geojsonData) return;

    const addLayers = () => {
      // Add source
      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geojsonData,
        });
      }

      // Add fill layer (for polygons)
      if (!map.getLayer(FILL_LAYER_ID)) {
        map.addLayer({
          id: FILL_LAYER_ID,
          type: 'fill',
          source: SOURCE_ID,
          paint: {
            'fill-color': '#00E5FF',
            'fill-opacity': 0.05,
          },
          filter: ['==', '$type', 'Polygon'],
        });
      }

      // Add line layer (boundaries)
      if (!map.getLayer(LINE_LAYER_ID)) {
        map.addLayer({
          id: LINE_LAYER_ID,
          type: 'line',
          source: SOURCE_ID,
          paint: {
            'line-color': '#00E5FF',
            'line-width': 1,
            'line-opacity': 0.5,
          },
          filter: ['==', '$type', 'Polygon'],
        });
      }

      // Add label layer
      if (!map.getLayer(LABEL_LAYER_ID)) {
        map.addLayer({
          id: LABEL_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#94A3B8',
            'text-halo-color': '#0B1120',
            'text-halo-width': 1,
          },
        });
      }

      // Add click handler
      if (onMunicipalityClick) {
        map.on('click', FILL_LAYER_ID, (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            onMunicipalityClick({
              id: feature.properties?.id,
              name: feature.properties?.name,
              ibgeCode: feature.properties?.ibgeCode,
              population: feature.properties?.population,
            });
          }
        });

        map.on('mouseenter', FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', FILL_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once('load', addLayers);
    }

    return () => {
      if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
      if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
      if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, geojsonData, onMunicipalityClick]);

  // Toggle visibility
  useEffect(() => {
    if (!map) return;

    const visibility = visible ? 'visible' : 'none';

    [FILL_LAYER_ID, LINE_LAYER_ID, LABEL_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    });
  }, [map, visible]);

  return null;
}
