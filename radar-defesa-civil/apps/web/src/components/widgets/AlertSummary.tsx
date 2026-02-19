'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/contexts/websocket-context';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface AlertSummaryData {
  maxAlert: number;
  alert: number;
  attention: number;
  observation: number;
  total: number;
}

interface Alert {
  id: string;
  severity: 'observation' | 'attention' | 'alert' | 'max_alert';
  title: string;
  municipality?: { name: string };
  startedAt: string;
}

export function AlertSummary() {
  const { socket } = useWebSocket();
  const [summary, setSummary] = useState<AlertSummaryData | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = () => {
      loadAlerts();
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:end', handleNewAlert);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:end', handleNewAlert);
    };
  }, [socket]);

  const loadAlerts = async () => {
    try {
      const response = await api.get<{ data: { alerts: Alert[]; summary: AlertSummaryData } }>(
        '/alerts/active'
      );
      setSummary(response.data.summary);
      setRecentAlerts(response.data.alerts.slice(0, 5));
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-background-tertiary rounded w-1/2" />
            <div className="h-8 bg-background-tertiary rounded" />
            <div className="h-8 bg-background-tertiary rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-4 h-4 text-accent" />
          Alertas Ativos
        </CardTitle>
        <Link
          href="/alertas"
          className="text-xs text-accent hover:underline flex items-center gap-1"
        >
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Summary badges */}
        {summary && summary.total > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {summary.maxAlert > 0 && (
                <SeverityBadge severity="max_alert" size="sm" />
              )}
              {summary.alert > 0 && (
                <span className="text-xs text-text-secondary">
                  {summary.alert} alerta{summary.alert > 1 ? 's' : ''}
                </span>
              )}
              {summary.attention > 0 && (
                <span className="text-xs text-text-secondary">
                  {summary.attention} atenção
                </span>
              )}
            </div>

            {/* Recent alerts list */}
            <div className="space-y-2">
              {recentAlerts.map((alert) => (
                <Link
                  key={alert.id}
                  href={`/alertas/${alert.id}`}
                  className="flex items-start gap-2 p-2 rounded hover:bg-background-tertiary transition-colors"
                >
                  <SeverityBadge severity={alert.severity} size="sm" showLabel={false} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text truncate">{alert.title}</div>
                    {alert.municipality && (
                      <div className="text-xs text-text-muted">{alert.municipality.name}</div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-text-secondary">
            <div className="text-2xl mb-2">✓</div>
            <div className="text-sm">Nenhum alerta ativo</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
