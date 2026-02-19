'use client';

import { useEffect, useState } from 'react';
import { X, Volume2, VolumeX, Bell, BellOff } from 'lucide-react';
import { useAlertNotifications } from '@/hooks/useAlertNotifications';
import { useRouter } from 'next/navigation';

interface Alert {
  id: string;
  title: string;
  description?: string;
  severity: string;
  municipalityId?: string;
  municipality?: { name: string };
  startedAt: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  observation: 'bg-green-500/20 border-green-500 text-green-500',
  attention: 'bg-yellow-500/20 border-yellow-500 text-yellow-500',
  alert: 'bg-orange-500/20 border-orange-500 text-orange-500',
  max_alert: 'bg-red-500/20 border-red-500 text-red-500 animate-pulse',
};

const SEVERITY_LABELS: Record<string, string> = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
};

export function AlertToast() {
  const router = useRouter();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const {
    recentAlerts,
    notificationPermission,
    requestNotificationPermission,
    clearRecentAlerts,
    stopSound,
    isConnected,
  } = useAlertNotifications({
    enabled: true,
    soundEnabled,
    browserNotifications: notificationsEnabled,
  });

  // Filter out dismissed alerts
  const visibleAlerts = recentAlerts.filter((a) => !dismissedAlerts.has(a.id));

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
    stopSound();
  };

  const handleDismissAll = () => {
    setDismissedAlerts(new Set(recentAlerts.map((a) => a.id)));
    stopSound();
  };

  const handleClick = (alert: Alert) => {
    router.push(`/alertas/${alert.id}`);
    handleDismiss(alert.id);
  };

  const handleToggleSound = () => {
    if (soundEnabled) {
      stopSound();
    }
    setSoundEnabled(!soundEnabled);
  };

  const handleToggleNotifications = async () => {
    if (!notificationsEnabled && notificationPermission === 'default') {
      await requestNotificationPermission();
    }
    setNotificationsEnabled(!notificationsEnabled);
  };

  // Auto-dismiss after timeout (except critical)
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    visibleAlerts.forEach((alert) => {
      if (alert.severity !== 'max_alert') {
        const timer = setTimeout(() => {
          handleDismiss(alert.id);
        }, 30000); // 30 seconds
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [visibleAlerts]);

  if (visibleAlerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2 mb-1">
        <button
          onClick={handleToggleSound}
          className={`p-2 rounded-full transition-colors ${
            soundEnabled
              ? 'bg-accent/20 text-accent'
              : 'bg-background-tertiary text-text-muted'
          }`}
          title={soundEnabled ? 'Desativar som' : 'Ativar som'}
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={handleToggleNotifications}
          className={`p-2 rounded-full transition-colors ${
            notificationsEnabled
              ? 'bg-accent/20 text-accent'
              : 'bg-background-tertiary text-text-muted'
          }`}
          title={
            notificationsEnabled
              ? 'Desativar notificações'
              : 'Ativar notificações'
          }
        >
          {notificationsEnabled ? (
            <Bell className="w-4 h-4" />
          ) : (
            <BellOff className="w-4 h-4" />
          )}
        </button>
        {visibleAlerts.length > 1 && (
          <button
            onClick={handleDismissAll}
            className="text-xs text-text-muted hover:text-text px-2 py-1 rounded bg-background-tertiary"
          >
            Dispensar todos
          </button>
        )}
      </div>

      {/* Alert toasts */}
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className={`relative p-4 rounded-lg border shadow-lg cursor-pointer transition-all hover:scale-[1.02] ${
            SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.attention
          }`}
          onClick={() => handleClick(alert)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss(alert.id);
            }}
            className="absolute top-2 right-2 p-1 rounded hover:bg-black/10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="pr-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase">
                {SEVERITY_LABELS[alert.severity] || alert.severity}
              </span>
              {alert.municipality?.name && (
                <span className="text-xs opacity-75">
                  • {alert.municipality.name}
                </span>
              )}
            </div>
            <h4 className="font-medium text-sm">{alert.title}</h4>
            {alert.description && (
              <p className="text-xs opacity-75 mt-1 line-clamp-2">
                {alert.description}
              </p>
            )}
            <p className="text-xs opacity-50 mt-2">
              {new Date(alert.startedAt).toLocaleTimeString('pt-BR')}
            </p>
          </div>
        </div>
      ))}

      {/* Connection indicator */}
      <div
        className={`text-xs text-center py-1 rounded ${
          isConnected
            ? 'text-green-500/50'
            : 'text-red-500/50 bg-red-500/10'
        }`}
      >
        {isConnected ? '● Conectado' : '○ Desconectado'}
      </div>
    </div>
  );
}
