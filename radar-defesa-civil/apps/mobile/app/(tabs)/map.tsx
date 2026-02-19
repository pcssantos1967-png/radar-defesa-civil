import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../../src/services/api';
import { SeverityBadge } from '../../src/components/ui';
import { colors, spacing, fontSize, borderRadius, severityColors } from '../../src/theme';
import type { Alert, RadarStation } from '../../src/types';

const BRAZIL_CENTER: Region = {
  latitude: -14.235,
  longitude: -51.9253,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [radars, setRadars] = useState<RadarStation[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showRadars, setShowRadars] = useState(true);
  const [showAlerts, setShowAlerts] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, radarsRes] = await Promise.all([
        api.get<{ success: boolean; data: Alert[] }>('/alerts?status=active'),
        api.get<{ success: boolean; data: RadarStation[] }>('/radar/stations'),
      ]);

      setAlerts(alertsRes.data.filter((a) => a.latitude && a.longitude));
      setRadars(radarsRes.data);
    } catch (error) {
      console.error('Error fetching map data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  const goToUserLocation = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      });
    }
  };

  const getMarkerColor = (severity: string) => {
    return severityColors[severity] || colors.accent;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Carregando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={userLocation ? { ...userLocation, latitudeDelta: 2, longitudeDelta: 2 } : BRAZIL_CENTER}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={darkMapStyle}
      >
        {/* Alert Markers */}
        {showAlerts &&
          alerts.map((alert) => (
            <Marker
              key={alert.id}
              coordinate={{
                latitude: alert.latitude!,
                longitude: alert.longitude!,
              }}
              onPress={() => setSelectedAlert(alert)}
            >
              <View style={[styles.alertMarker, { backgroundColor: getMarkerColor(alert.severity) }]}>
                <Ionicons name="warning" size={16} color={colors.white} />
              </View>
            </Marker>
          ))}

        {/* Radar Markers */}
        {showRadars &&
          radars.map((radar) => (
            <Marker
              key={radar.id}
              coordinate={{
                latitude: radar.latitude,
                longitude: radar.longitude,
              }}
            >
              <View
                style={[
                  styles.radarMarker,
                  {
                    backgroundColor:
                      radar.status === 'online'
                        ? colors.success
                        : radar.status === 'maintenance'
                        ? colors.warning
                        : colors.error,
                  },
                ]}
              >
                <Ionicons name="radio-outline" size={14} color={colors.white} />
              </View>
            </Marker>
          ))}
      </MapView>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={goToUserLocation}
        >
          <Ionicons name="locate" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !showAlerts && styles.controlButtonInactive]}
          onPress={() => setShowAlerts(!showAlerts)}
        >
          <Ionicons
            name="warning"
            size={22}
            color={showAlerts ? colors.severity.alert : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, !showRadars && styles.controlButtonInactive]}
          onPress={() => setShowRadars(!showRadars)}
        >
          <Ionicons
            name="radio"
            size={22}
            color={showRadars ? colors.accent : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legenda</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.severity.maxAlert }]} />
            <Text style={styles.legendText}>Máximo</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.severity.alert }]} />
            <Text style={styles.legendText}>Alerta</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.severity.attention }]} />
            <Text style={styles.legendText}>Atenção</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>Radar</Text>
          </View>
        </View>
      </View>

      {/* Selected Alert Info */}
      {selectedAlert && (
        <View style={styles.alertInfo}>
          <View style={styles.alertInfoHeader}>
            <SeverityBadge severity={selectedAlert.severity} />
            <TouchableOpacity onPress={() => setSelectedAlert(null)}>
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.alertInfoTitle}>{selectedAlert.title}</Text>
          <View style={styles.alertInfoLocation}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.alertInfoLocationText}>{selectedAlert.municipalityName}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#334e87' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6f9ba5' }] },
  { featureType: 'poi', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#3C7680' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
  { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
  { featureType: 'transit', elementType: 'labels.text.stroke', stylers: [{ color: '#1d2c4d' }] },
  { featureType: 'transit.line', elementType: 'geometry.fill', stylers: [{ color: '#283d6a' }] },
  { featureType: 'transit.station', elementType: 'geometry', stylers: [{ color: '#3a4762' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  map: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlButtonInactive: {
    opacity: 0.6,
  },
  legend: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  legendText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  alertMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  radarMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  alertInfo: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  alertInfoTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  alertInfoLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertInfoLocationText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
});
