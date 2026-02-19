'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Map as MaplibreMap, Popup } from 'maplibre-gl';
import maplibregl from 'maplibre-gl';
import { useWebSocket } from '@/contexts/websocket-context';
import { api } from '@/services/api';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertOverlayProps {
  map: MaplibreMap | null;
  visible?: boolean;
  onAlertClick?: (alert: Alert) => void;
}

interface Alert {
  id: string;
  severity: 'observation' | 'attention' | 'alert' | 'max_alert';
  type: string;
  title: string;
  description?: string;
  status: string;
  startedAt: string;
  municipalityId?: string;
  municipality?: {
    id: string;
    name: string;
    ibgeCode: string;
    centroid?: {
      lat: number;
      lng: number;
    };
  };
  triggerValue?: number;
  thresholdValue?: number;
}

// Severity color mapping
const SEVERITY_COLORS: Record<string, string> = {
  observation: '#4CAF50',
  attention: '#FFD600',
  alert: '#FF9800',
  max_alert: '#FF1744',
};

const SEVERITY_LABELS: Record<string, string> = {
  observation: 'Observacao',
  attention: 'Atencao',
  alert: 'Alerta',
  max_alert: 'Alerta Maximo',
};

// Pulse animation keyframes for critical alerts
const PULSE_OPACITY = [0.3, 0.6, 0.3];

const SOURCE_ID = 'alerts';
const MARKERS_LAYER_ID = 'alerts-markers';
const PULSE_LAYER_ID = 'alerts-pulse';

export function AlertOverlay({
  map,
  visible = true,
  onAlertClick,
}: AlertOverlayProps) {
  const { socket } = useWebSocket();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [popup, setPopup] = useState<Popup | null>(null);

  // Load active alerts
  useEffect(() => {
    loadActiveAlerts();
  }, []);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (data: { alert: Alert }) => {
      setAlerts((prev) => {
        // Avoid duplicates
        if (prev.some((a) => a.id === data.alert.id)) {
          return prev.map((a) =>
            a.id === data.alert.id ? { ...a, ...data.alert } : a
          );
        }
        return [data.alert, ...prev];
      });
    };

    const handleAlertUpdate = (data: { alert: Alert }) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === data.alert.id ? { ...a, ...data.alert } : a))
      );
    };

    const handleAlertEnd = (data: { id: string }) => {
      setAlerts((prev) => prev.filter((a) => a.id !== data.id));
    };

    const handleAlertEscalated = (data: {
      alertId: string;
      newSeverity: string;
    }) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === data.alertId
            ? { ...a, severity: data.newSeverity as Alert['severity'] }
            : a
        )
      );
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:update', handleAlertUpdate);
    socket.on('alert:end', handleAlertEnd);
    socket.on('alert:expired', handleAlertEnd);
    socket.on('alert:escalated', handleAlertEscalated);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:update', handleAlertUpdate);
      socket.off('alert:end', handleAlertEnd);
      socket.off('alert:expired', handleAlertEnd);
      socket.off('alert:escalated', handleAlertEscalated);
    };
  }, [socket]);

  const loadActiveAlerts = async () => {
    try {
      const response = await api.get<{
        data: { alerts: Alert[] };
      }>('/alerts/active');
      setAlerts(response.data.alerts);
    } catch (error) {
      console.error('Failed to load active alerts:', error);
    }
  };

  // Create GeoJSON from alerts
  const createGeoJSON = useCallback((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = alerts
      .filter((alert) => alert.municipality?.centroid)
      .map((alert) => ({
        type: 'Feature',
        properties: {
          id: alert.id,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          municipalityName: alert.municipality?.name,
          type: alert.type,
          startedAt: alert.startedAt,
          triggerValue: alert.triggerValue,
          thresholdValue: alert.thresholdValue,
          color: SEVERITY_COLORS[alert.severity],
          isCritical: alert.severity === 'max_alert' || alert.severity === 'alert',
        },
        geometry: {
          type: 'Point',
          coordinates: [
            alert.municipality!.centroid!.lng,
            alert.municipality!.centroid!.lat,
          ],
        },
      }));

    return {
      type: 'FeatureCollection',
      features,
    };
  }, [alerts]);

  // Setup map layers
  useEffect(() => {
    if (!map) return;

    const addLayers = () => {
      const geojson = createGeoJSON();

      // Add or update source
      if (map.getSource(SOURCE_ID)) {
        (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geojson,
        });
      }

      // Add pulse layer for critical alerts (rendered first, behind markers)
      if (!map.getLayer(PULSE_LAYER_ID)) {
        map.addLayer({
          id: PULSE_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['==', ['get', 'isCritical'], true],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6, 20,
              12, 40,
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.3,
            'circle-stroke-width': 2,
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-opacity': 0.5,
          },
        });
      }

      // Add markers layer
      if (!map.getLayer(MARKERS_LAYER_ID)) {
        map.addLayer({
          id: MARKERS_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6, 8,
              12, 16,
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.8,
          },
        });

        // Add click handler
        map.on('click', MARKERS_LAYER_ID, (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const props = feature.properties;

            if (onAlertClick) {
              const alert = alerts.find((a) => a.id === props?.id);
              if (alert) {
                onAlertClick(alert);
              }
            }

            // Show popup
            const coordinates = (feature.geometry as GeoJSON.Point).coordinates.slice() as [number, number];

            // Format time
            const timeAgo = props?.startedAt
              ? formatDistanceToNow(new Date(props.startedAt), {
                  addSuffix: true,
                  locale: ptBR,
                })
              : '';

            const popupHtml = `
              <div class="p-2 max-w-xs">
                <div class="flex items-center gap-2 mb-2">
                  <span
                    class="w-3 h-3 rounded-full"
                    style="background-color: ${props?.color}"
                  ></span>
                  <span class="text-xs font-medium uppercase" style="color: ${props?.color}">
                    ${SEVERITY_LABELS[props?.severity as string] || props?.severity}
                  </span>
                </div>
                <h3 class="font-semibold text-sm mb-1">${props?.title || 'Alerta'}</h3>
                <p class="text-xs text-gray-400 mb-2">${props?.municipalityName || ''}</p>
                ${
                  props?.triggerValue
                    ? `<p class="text-xs">Valor: <strong>${Number(props.triggerValue).toFixed(1)}</strong> / ${Number(props.thresholdValue || 0).toFixed(1)} mm</p>`
                    : ''
                }
                <p class="text-xs text-gray-500 mt-2">${timeAgo}</p>
              </div>
            `;

            // Remove existing popup
            if (popup) {
              popup.remove();
            }

            const newPopup = new maplibregl.Popup({
              closeButton: true,
              closeOnClick: true,
              className: 'alert-popup',
              maxWidth: '250px',
            })
              .setLngLat(coordinates)
              .setHTML(popupHtml)
              .addTo(map);

            setPopup(newPopup);
          }
        });

        // Change cursor on hover
        map.on('mouseenter', MARKERS_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', MARKERS_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    };

    if (map.isStyleLoaded()) {
      addLayers();
    } else {
      map.once('load', addLayers);
    }
  }, [map, alerts, createGeoJSON, onAlertClick, popup]);

  // Update source data when alerts change
  useEffect(() => {
    if (!map || !map.getSource(SOURCE_ID)) return;

    const geojson = createGeoJSON();
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource).setData(geojson);
  }, [map, alerts, createGeoJSON]);

  // Toggle visibility
  useEffect(() => {
    if (!map) return;

    const visibility = visible ? 'visible' : 'none';

    [MARKERS_LAYER_ID, PULSE_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    });
  }, [map, visible]);

  // Animate pulse for critical alerts
  useEffect(() => {
    if (!map || !visible) return;

    let animationFrame: number;
    let step = 0;

    const animate = () => {
      step = (step + 1) % 60;
      const opacity = 0.2 + Math.sin((step / 60) * Math.PI * 2) * 0.3;

      if (map.getLayer(PULSE_LAYER_ID)) {
        map.setPaintProperty(PULSE_LAYER_ID, 'circle-opacity', opacity);
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [map, visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (map) {
        if (map.getLayer(MARKERS_LAYER_ID)) map.removeLayer(MARKERS_LAYER_ID);
        if (map.getLayer(PULSE_LAYER_ID)) map.removeLayer(PULSE_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      }
      if (popup) {
        popup.remove();
      }
    };
  }, [map, popup]);

  return null;
}
