'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useWebSocket } from '@/contexts/websocket-context';

interface Alert {
  id: string;
  title: string;
  description?: string;
  severity: string;
  municipalityId?: string;
  municipality?: { name: string };
  startedAt: string;
}

interface AlertEvent {
  alert: Alert;
  timestamp: string;
}

interface UseAlertNotificationsOptions {
  enabled?: boolean;
  soundEnabled?: boolean;
  browserNotifications?: boolean;
  filterSeverities?: string[];
  filterMunicipalities?: string[];
  onNewAlert?: (alert: Alert) => void;
  onAlertAcknowledged?: (alertId: string) => void;
  onAlertResolved?: (alertId: string) => void;
}

// Audio files for different severity levels
const ALERT_SOUNDS: Record<string, string> = {
  observation: '/sounds/notification.mp3',
  attention: '/sounds/attention.mp3',
  alert: '/sounds/alert.mp3',
  max_alert: '/sounds/critical.mp3',
};

// Severity labels for notifications
const SEVERITY_LABELS: Record<string, string> = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
};

export function useAlertNotifications(options: UseAlertNotificationsOptions = {}) {
  const {
    enabled = true,
    soundEnabled = true,
    browserNotifications = true,
    filterSeverities,
    filterMunicipalities,
    onNewAlert,
    onAlertAcknowledged,
    onAlertResolved,
  } = options;

  const { socket, isConnected } = useWebSocket();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return 'denied';

    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
      return 'granted';
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      return permission;
    }

    setNotificationPermission(Notification.permission);
    return Notification.permission;
  }, []);

  // Play alert sound
  const playAlertSound = useCallback((severity: string) => {
    if (!soundEnabled) return;

    const soundUrl = ALERT_SOUNDS[severity] || ALERT_SOUNDS.attention;

    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      audioRef.current = new Audio(soundUrl);
      audioRef.current.volume = severity === 'max_alert' ? 1.0 : severity === 'alert' ? 0.8 : 0.5;
      audioRef.current.play().catch(() => {
        // Audio play failed - likely blocked by browser
      });
    } catch {
      // Audio not supported
    }
  }, [soundEnabled]);

  // Show browser notification
  const showBrowserNotification = useCallback(
    (alert: Alert) => {
      if (!browserNotifications || notificationPermission !== 'granted') return;

      const severityLabel = SEVERITY_LABELS[alert.severity] || alert.severity;
      const municipalityName = alert.municipality?.name || 'Sistema';

      const notification = new Notification(`${severityLabel}: ${alert.title}`, {
        body: `${municipalityName}\n${alert.description || ''}`,
        icon: '/icons/alert-icon.png',
        tag: alert.id,
        requireInteraction: alert.severity === 'max_alert' || alert.severity === 'alert',
        silent: soundEnabled, // We handle sound separately
      });

      notification.onclick = () => {
        window.focus();
        window.location.href = `/alertas/${alert.id}`;
        notification.close();
      };

      // Auto-close non-critical notifications
      if (alert.severity !== 'max_alert') {
        setTimeout(() => notification.close(), 10000);
      }
    },
    [browserNotifications, notificationPermission, soundEnabled]
  );

  // Check if alert passes filters
  const shouldProcessAlert = useCallback(
    (alert: Alert): boolean => {
      if (filterSeverities?.length && !filterSeverities.includes(alert.severity)) {
        return false;
      }

      if (
        filterMunicipalities?.length &&
        alert.municipalityId &&
        !filterMunicipalities.includes(alert.municipalityId)
      ) {
        return false;
      }

      return true;
    },
    [filterSeverities, filterMunicipalities]
  );

  // Handle new alert
  const handleNewAlert = useCallback(
    (event: AlertEvent) => {
      const { alert } = event;

      if (!shouldProcessAlert(alert)) return;

      // Play sound
      playAlertSound(alert.severity);

      // Show browser notification
      showBrowserNotification(alert);

      // Add to recent alerts
      setRecentAlerts((prev) => [alert, ...prev.slice(0, 9)]);

      // Call callback
      onNewAlert?.(alert);
    },
    [shouldProcessAlert, playAlertSound, showBrowserNotification, onNewAlert]
  );

  // Handle alert acknowledged
  const handleAlertAcknowledged = useCallback(
    (event: { alertId: string }) => {
      setRecentAlerts((prev) => prev.filter((a) => a.id !== event.alertId));
      onAlertAcknowledged?.(event.alertId);
    },
    [onAlertAcknowledged]
  );

  // Handle alert resolved
  const handleAlertResolved = useCallback(
    (event: { alertId: string }) => {
      setRecentAlerts((prev) => prev.filter((a) => a.id !== event.alertId));
      onAlertResolved?.(event.alertId);
    },
    [onAlertResolved]
  );

  // Subscribe to socket events
  useEffect(() => {
    if (!enabled || !socket || !isConnected) return;

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:acknowledged', handleAlertAcknowledged);
    socket.on('alert:resolved', handleAlertResolved);
    socket.on('alert:escalated', handleNewAlert);
    socket.on('alert:critical', handleNewAlert);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:acknowledged', handleAlertAcknowledged);
      socket.off('alert:resolved', handleAlertResolved);
      socket.off('alert:escalated', handleNewAlert);
      socket.off('alert:critical', handleNewAlert);
    };
  }, [
    enabled,
    socket,
    isConnected,
    handleNewAlert,
    handleAlertAcknowledged,
    handleAlertResolved,
  ]);

  // Request permission on mount
  useEffect(() => {
    if (browserNotifications) {
      requestNotificationPermission();
    }
  }, [browserNotifications, requestNotificationPermission]);

  // Clear recent alerts
  const clearRecentAlerts = useCallback(() => {
    setRecentAlerts([]);
  }, []);

  // Stop current sound
  const stopSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  return {
    recentAlerts,
    notificationPermission,
    requestNotificationPermission,
    clearRecentAlerts,
    stopSound,
    isConnected,
  };
}
