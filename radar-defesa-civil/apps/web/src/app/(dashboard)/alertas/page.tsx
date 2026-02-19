'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/contexts/websocket-context';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { AlertDetailModal } from '@/components/alerts/AlertDetailModal';
import { AlertFilters } from '@/components/alerts/AlertFilters';
import { SEVERITY_LABELS } from '@/constants/colors';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

interface Alert {
  id: string;
  severity: 'observation' | 'attention' | 'alert' | 'max_alert';
  type: string;
  title: string;
  description?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  acknowledgedAt?: string;
  municipality?: {
    id: string;
    name: string;
    ibgeCode: string;
  };
  triggerValue?: number;
  thresholdValue?: number;
}

interface AlertSummary {
  maxAlert: number;
  alert: number;
  attention: number;
  observation: number;
  total: number;
}

interface Filters {
  status: string;
  severity: string;
  municipalityId: string;
}

export default function AlertasPage() {
  const { socket } = useWebSocket();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: 'active',
    severity: '',
    municipalityId: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadAlerts();
  }, [filters, page]);

  useEffect(() => {
    if (!socket) return;

    const handleNewAlert = (alert: Alert) => {
      setAlerts((prev) => [alert, ...prev]);
      loadSummary();
    };

    const handleAlertUpdate = (alert: Alert) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, ...alert } : a))
      );
      loadSummary();
    };

    const handleAlertEnd = (data: { id: string }) => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === data.id ? { ...a, status: 'resolved', endedAt: new Date().toISOString() } : a
        )
      );
      loadSummary();
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:update', handleAlertUpdate);
    socket.on('alert:end', handleAlertEnd);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:update', handleAlertUpdate);
      socket.off('alert:end', handleAlertEnd);
    };
  }, [socket]);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (filters.status) params.append('status', filters.status);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.municipalityId) params.append('municipalityId', filters.municipalityId);

      const response = await api.get<{
        data: { alerts: Alert[] };
        pagination: { totalPages: number };
      }>(`/alerts?${params}`);

      setAlerts(response.data.alerts);
      setTotalPages(response.pagination.totalPages);
      loadSummary();
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await api.get<{ data: { summary: AlertSummary } }>('/alerts/active');
      setSummary(response.data.summary);
    } catch (error) {
      console.error('Failed to load summary:', error);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await api.post(`/alerts/${alertId}/acknowledge`);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, status: 'acknowledged', acknowledgedAt: new Date().toISOString() }
            : a
        )
      );
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await api.post(`/alerts/${alertId}/resolve`);
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? { ...a, status: 'resolved', endedAt: new Date().toISOString() }
            : a
        )
      );
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <AlertTriangle className="w-4 h-4 text-accent-error" />;
      case 'acknowledged':
        return <Clock className="w-4 h-4 text-accent-warning" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-accent-success" />;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Alertas</h1>
          <p className="text-text-secondary">
            Gerenciamento e monitoramento de alertas meteorológicos
          </p>
        </div>
        <Button onClick={loadAlerts} variant="secondary" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-severity-max-alert/10 border-severity-max-alert/30">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-severity-max-alert">
                {summary.maxAlert}
              </div>
              <div className="text-sm text-text-secondary">Alerta Máximo</div>
            </CardContent>
          </Card>
          <Card className="bg-severity-alert/10 border-severity-alert/30">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-severity-alert">
                {summary.alert}
              </div>
              <div className="text-sm text-text-secondary">Alerta</div>
            </CardContent>
          </Card>
          <Card className="bg-severity-attention/10 border-severity-attention/30">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-severity-attention">
                {summary.attention}
              </div>
              <div className="text-sm text-text-secondary">Atenção</div>
            </CardContent>
          </Card>
          <Card className="bg-severity-observation/10 border-severity-observation/30">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-severity-observation">
                {summary.observation}
              </div>
              <div className="text-sm text-text-secondary">Observação</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-text">{summary.total}</div>
              <div className="text-sm text-text-secondary">Total Ativos</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <AlertFilters filters={filters} onChange={setFilters} />

      {/* Alert list */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alertas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full mx-auto" />
              <p className="mt-2 text-text-secondary">Carregando alertas...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum alerta encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 hover:bg-background-tertiary transition-colors cursor-pointer"
                  onClick={() => setSelectedAlert(alert)}
                >
                  <div className="flex items-start gap-4">
                    <SeverityBadge severity={alert.severity} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(alert.status)}
                        <h3 className="font-medium text-text truncate">
                          {alert.title}
                        </h3>
                      </div>

                      {alert.municipality && (
                        <div className="flex items-center gap-1 mt-1 text-sm text-text-secondary">
                          <MapPin className="w-3 h-3" />
                          {alert.municipality.name}
                        </div>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                        <span>
                          Início:{' '}
                          {format(new Date(alert.startedAt), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(alert.startedAt), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        {alert.triggerValue && alert.thresholdValue && (
                          <span>
                            {alert.triggerValue.toFixed(1)} / {alert.thresholdValue.toFixed(1)} mm
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {alert.status === 'active' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcknowledge(alert.id);
                          }}
                        >
                          Confirmar
                        </Button>
                      )}
                      {alert.status === 'acknowledged' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResolve(alert.id);
                          }}
                        >
                          Resolver
                        </Button>
                      )}
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-text-secondary">
                Página {page} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert detail modal */}
      {selectedAlert && (
        <AlertDetailModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onAcknowledge={() => handleAcknowledge(selectedAlert.id)}
          onResolve={() => handleResolve(selectedAlert.id)}
        />
      )}
    </div>
  );
}
