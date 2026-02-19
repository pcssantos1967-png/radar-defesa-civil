'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RadarColorScale } from './RadarColorScale';
import { MapControls } from './MapControls';
import { RadarLayer } from './RadarLayer';
import { MunicipalityLayer } from './MunicipalityLayer';
import { RiskAreaLayer } from './RiskAreaLayer';
import { StationMarkers } from './StationMarkers';
import { CellTrackingLayer } from './CellTrackingLayer';
import { AlertOverlay } from './AlertOverlay';

interface MapContainerProps {
  selectedProduct: string;
  currentTime: Date;
}

// Default center: Vale do Paraíba, SP
const DEFAULT_CENTER: [number, number] = [-45.8869, -23.1896];
const DEFAULT_ZOOM = 8;
const DEFAULT_RADAR_ID = 'RSJC';

interface LayerVisibility {
  radar: boolean;
  municipalities: boolean;
  riskAreas: boolean;
  stations: boolean;
  cells: boolean;
  alerts: boolean;
}

export default function MapContainer({ selectedProduct, currentTime }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerVisibility>({
    radar: true,
    municipalities: true,
    riskAreas: false,
    stations: false,
    cells: true,
    alerts: true,
  });

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
          },
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    mapRef.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-left'
    );

    mapRef.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    mapRef.current.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }),
      'bottom-right'
    );

    mapRef.current.on('load', () => {
      setIsLoaded(true);

      if (mapRef.current) {
        // Add radar range indicator
        mapRef.current.addSource('radar-range', {
          type: 'geojson',
          data: createRadarRangeCircle(DEFAULT_CENTER, 250),
        });

        mapRef.current.addLayer({
          id: 'radar-range-fill',
          type: 'fill',
          source: 'radar-range',
          paint: {
            'fill-color': '#00E5FF',
            'fill-opacity': 0.03,
          },
        });

        mapRef.current.addLayer({
          id: 'radar-range-line',
          type: 'line',
          source: 'radar-range',
          paint: {
            'line-color': '#00E5FF',
            'line-width': 1,
            'line-dasharray': [4, 2],
            'line-opacity': 0.4,
          },
        });

        // Add 100km range ring
        mapRef.current.addSource('radar-range-100', {
          type: 'geojson',
          data: createRadarRangeCircle(DEFAULT_CENTER, 100),
        });

        mapRef.current.addLayer({
          id: 'radar-range-100-line',
          type: 'line',
          source: 'radar-range-100',
          paint: {
            'line-color': '#00E5FF',
            'line-width': 0.5,
            'line-dasharray': [2, 4],
            'line-opacity': 0.3,
          },
        });

        // Add radar center marker
        new maplibregl.Marker({
          color: '#00E5FF',
        })
          .setLngLat(DEFAULT_CENTER)
          .setPopup(
            new maplibregl.Popup({ offset: 15 }).setHTML(`
              <div class="p-2">
                <strong>Radar São José dos Campos</strong><br/>
                <span class="text-sm text-gray-400">RSJC - Banda X</span><br/>
                <span class="text-xs text-gray-500">Alcance: 250 km</span>
              </div>
            `)
          )
          .addTo(mapRef.current);
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const handleMunicipalityClick = useCallback((municipality: { id: string; name: string }) => {
    setSelectedMunicipality(municipality.id);
    // Could open a panel or navigate
  }, []);

  const toggleLayer = useCallback((layer: keyof LayerVisibility) => {
    setLayerVisibility((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  }, []);

  const timestamp = currentTime.toISOString().replace(/[-:]/g, '').slice(0, 14);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Layer components */}
      {isLoaded && (
        <>
          <RadarLayer
            map={mapRef.current}
            radarId={DEFAULT_RADAR_ID}
            product={selectedProduct}
            timestamp={timestamp}
            opacity={0.7}
          />
          <MunicipalityLayer
            map={mapRef.current}
            visible={layerVisibility.municipalities}
            onMunicipalityClick={handleMunicipalityClick}
          />
          <RiskAreaLayer
            map={mapRef.current}
            visible={layerVisibility.riskAreas}
            municipalityId={selectedMunicipality || undefined}
          />
          <StationMarkers
            map={mapRef.current}
            visible={layerVisibility.stations}
          />
          <CellTrackingLayer
            map={mapRef.current}
            visible={layerVisibility.cells}
          />
          <AlertOverlay
            map={mapRef.current}
            visible={layerVisibility.alerts}
          />
        </>
      )}

      {/* Radar color scale */}
      <div className="absolute bottom-20 right-4 z-10">
        <RadarColorScale />
      </div>

      {/* Map controls */}
      <div className="absolute top-4 right-4 z-10">
        <MapControls map={mapRef.current} />
      </div>

      {/* Timestamp overlay */}
      <div className="absolute top-4 right-20 z-10 bg-background-elevated/90 px-3 py-1.5 rounded text-sm font-mono text-text">
        {currentTime.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      {/* Layer toggle buttons */}
      <div className="absolute top-20 right-4 z-10 bg-background-elevated/90 rounded-lg p-2 space-y-1">
        <button
          onClick={() => toggleLayer('municipalities')}
          className={`block w-full text-left px-2 py-1 rounded text-xs ${
            layerVisibility.municipalities ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-background-tertiary'
          }`}
        >
          Municípios
        </button>
        <button
          onClick={() => toggleLayer('riskAreas')}
          className={`block w-full text-left px-2 py-1 rounded text-xs ${
            layerVisibility.riskAreas ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-background-tertiary'
          }`}
        >
          Áreas de Risco
        </button>
        <button
          onClick={() => toggleLayer('stations')}
          className={`block w-full text-left px-2 py-1 rounded text-xs ${
            layerVisibility.stations ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-background-tertiary'
          }`}
        >
          Estações
        </button>
        <button
          onClick={() => toggleLayer('cells')}
          className={`block w-full text-left px-2 py-1 rounded text-xs ${
            layerVisibility.cells ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-background-tertiary'
          }`}
        >
          Células
        </button>
        <button
          onClick={() => toggleLayer('alerts')}
          className={`block w-full text-left px-2 py-1 rounded text-xs ${
            layerVisibility.alerts ? 'bg-severity-alert/20 text-severity-alert' : 'text-text-secondary hover:bg-background-tertiary'
          }`}
        >
          Alertas
        </button>
      </div>
    </div>
  );
}

// Helper function to create a circle for radar range
function createRadarRangeCircle(center: [number, number], radiusKm: number): GeoJSON.Feature {
  const points = 64;
  const coordinates: [number, number][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);

    // Convert km to degrees (approximate)
    const lat = center[1] + (dy / 111.32);
    const lng = center[0] + (dx / (111.32 * Math.cos(center[1] * Math.PI / 180)));

    coordinates.push([lng, lat]);
  }

  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  };
}
