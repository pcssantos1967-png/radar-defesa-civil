'use client';

import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Clock, MapPin, ChevronRight } from 'lucide-react';

interface Alert {
  id: string;
  severity: 'observation' | 'attention' | 'alert' | 'max_alert';
  type: string;
  title: string;
  status: string;
  startedAt: string;
  municipality?: {
    id: string;
    name: string;
  };
}

interface AlertListProps {
  alerts: Alert[];
  onSelect: (alert: Alert) => void;
  onAcknowledge?: (alertId: string) => void;
  onResolve?: (alertId: string) => void;
  compact?: boolean;
}

export function AlertList({
  alerts,
  onSelect,
  onAcknowledge,
  onResolve,
  compact = false,
}: AlertListProps) {
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

  if (alerts.length === 0) {
    return (
      <div className="p-8 text-center text-text-secondary">
        <AlertTriangle className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum alerta encontrado</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`hover:bg-background-tertiary transition-colors cursor-pointer ${
            compact ? 'p-3' : 'p-4'
          }`}
          onClick={() => onSelect(alert)}
        >
          <div className="flex items-start gap-3">
            <SeverityBadge severity={alert.severity} size={compact ? 'sm' : 'md'} showLabel={!compact} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(alert.status)}
                <h3 className={`font-medium text-text truncate ${compact ? 'text-sm' : ''}`}>
                  {alert.title}
                </h3>
              </div>

              {alert.municipality && (
                <div className="flex items-center gap-1 mt-1 text-xs text-text-secondary">
                  <MapPin className="w-3 h-3" />
                  {alert.municipality.name}
                </div>
              )}

              {!compact && (
                <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
                  <span>
                    {format(new Date(alert.startedAt), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(alert.startedAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              )}
            </div>

            <ChevronRight className={`text-text-muted ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </div>
        </div>
      ))}
    </div>
  );
}
