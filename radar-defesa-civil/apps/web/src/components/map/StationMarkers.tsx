'use client';

import { useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { api } from '@/services/api';

interface StationMarkersProps {
  map: MaplibreMap | null;
  visible?: boolean;
  showLabels?: boolean;
}

interface Station {
  id: string;
  code: string;
  name: string;
  source: string;
  latitude: number;
  longitude: number;
  stationType?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  cemaden: '#4CAF50',
  inmet: '#2196F3',
  ana: '#FF9800',
};

export function StationMarkers({
  map,
  visible = false,
  showLabels = true,
}: StationMarkersProps) {
  const [stations, setStations] = useState<Station[]>([]);
  const markersRef = new Map<string, maplibregl.Marker>();

  useEffect(() => {
    if (visible) {
      loadStations();
    }
  }, [visible]);

  const loadStations = async () => {
    try {
      // This would load from your API or external services
      // For now, return empty - would be populated by integrations
      setStations([]);
    } catch (error) {
      console.error('Failed to load stations:', error);
    }
  };

  useEffect(() => {
    if (!map || !visible) {
      // Remove all markers
      markersRef.forEach((marker) => marker.remove());
      markersRef.clear();
      return;
    }

    // Add markers for each station
    stations.forEach((station) => {
      if (markersRef.has(station.id)) return;

      const color = SOURCE_COLORS[station.source] || '#808080';

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'station-marker';
      el.style.cssText = `
        width: 12px;
        height: 12px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.longitude, station.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 15 }).setHTML(`
            <div class="p-2">
              <h3 class="font-semibold">${station.name}</h3>
              <p class="text-sm text-gray-600">${station.code}</p>
              <p class="text-xs text-gray-500">${station.source.toUpperCase()}</p>
            </div>
          `)
        )
        .addTo(map);

      markersRef.set(station.id, marker);
    });

    return () => {
      markersRef.forEach((marker) => marker.remove());
      markersRef.clear();
    };
  }, [map, stations, visible]);

  return null;
}
