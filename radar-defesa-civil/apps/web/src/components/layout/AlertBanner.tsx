'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/contexts/websocket-context';
import { api } from '@/services/api';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { X, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

interface Alert {
  id: string;
  severity: 'observation' | 'attention' | 'alert' | 'max_alert';
  title: string;
  municipality?: { name: string };
}

export function AlertBanner() {
  const { socket } = useWebSocket();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadActiveAlerts();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (data: Alert) => {
      setAlerts((prev) => [data, ...prev]);
      setIsVisible(true);
    };

    const handleAlertEnd = (data: { id: string }) => {
      setAlerts((prev) => prev.filter((a) => a.id !== data.id));
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:end', handleAlertEnd);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:end', handleAlertEnd);
    };
  }, [socket]);

  useEffect(() => {
    if (alerts.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % alerts.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [alerts.length]);

  const loadActiveAlerts = async () => {
    try {
      const response = await api.get<{ data: { alerts: Alert[] } }>('/alerts/active');
      const criticalAlerts = response.data.alerts.filter(
        (a) => a.severity === 'alert' || a.severity === 'max_alert'
      );
      setAlerts(criticalAlerts);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  };

  if (!isVisible || alerts.length === 0) {
    return null;
  }

  const currentAlert = alerts[currentIndex];
  const isMaxAlert = currentAlert?.severity === 'max_alert';

  return (
    <div
      className={clsx(
        'relative flex items-center justify-center px-4 py-2 text-sm',
        isMaxAlert
          ? 'bg-severity-max-alert text-white animate-pulse'
          : 'bg-severity-alert text-white'
      )}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-4 h-4" />
        <span className="font-medium">{currentAlert?.title}</span>
        {currentAlert?.municipality && (
          <span className="opacity-80">- {currentAlert.municipality.name}</span>
        )}
        {alerts.length > 1 && (
          <span className="opacity-60 text-xs">
            ({currentIndex + 1}/{alerts.length})
          </span>
        )}
      </div>

      <button
        onClick={() => setIsVisible(false)}
        className="absolute right-4 p-1 hover:bg-white/20 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
