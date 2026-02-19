'use client';

import { SeverityBadge } from '@/components/ui/SeverityBadge';
import { Button } from '@/components/ui/Button';
import { SEVERITY_LABELS } from '@/constants/colors';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  User,
  Activity,
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

interface AlertDetailModalProps {
  alert: Alert;
  onClose: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
}

export function AlertDetailModal({
  alert,
  onClose,
  onAcknowledge,
  onResolve,
}: AlertDetailModalProps) {
  const duration = alert.endedAt
    ? formatDistanceToNow(new Date(alert.startedAt), { locale: ptBR })
    : formatDistanceToNow(new Date(alert.startedAt), { addSuffix: false, locale: ptBR });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-background-secondary border border-border rounded-lg shadow-xl z-50 max-h-[85vh] overflow-auto">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-border">
            <div className="flex items-start gap-4">
              <SeverityBadge severity={alert.severity} />
              <div>
                <Dialog.Title className="text-xl font-semibold text-text">
                  {alert.title}
                </Dialog.Title>
                <Dialog.Description className="text-sm text-text-secondary mt-1">
                  {alert.type} - ID: {alert.id.slice(0, 8)}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-text-muted hover:text-text p-1">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                  alert.status === 'active'
                    ? 'bg-accent-error/20 text-accent-error'
                    : alert.status === 'acknowledged'
                    ? 'bg-accent-warning/20 text-accent-warning'
                    : 'bg-accent-success/20 text-accent-success'
                }`}
              >
                {alert.status === 'active' && <AlertTriangle className="w-4 h-4" />}
                {alert.status === 'acknowledged' && <Clock className="w-4 h-4" />}
                {alert.status === 'resolved' && <CheckCircle className="w-4 h-4" />}
                <span className="font-medium capitalize">
                  {alert.status === 'active' && 'Ativo'}
                  {alert.status === 'acknowledged' && 'Confirmado'}
                  {alert.status === 'resolved' && 'Resolvido'}
                </span>
              </div>
              <span className="text-sm text-text-secondary">
                Duração: {duration}
              </span>
            </div>

            {/* Description */}
            {alert.description && (
              <div>
                <h4 className="text-sm font-medium text-text-secondary mb-2">
                  Descrição
                </h4>
                <p className="text-text">{alert.description}</p>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Location */}
              <div className="bg-background-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm font-medium">Localização</span>
                </div>
                <p className="text-text font-medium">
                  {alert.municipality?.name || 'Não especificado'}
                </p>
                {alert.municipality?.ibgeCode && (
                  <p className="text-xs text-text-muted">
                    IBGE: {alert.municipality.ibgeCode}
                  </p>
                )}
              </div>

              {/* Timestamps */}
              <div className="bg-background-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Horários</span>
                </div>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-text-muted">Início:</span>{' '}
                    <span className="text-text">
                      {format(new Date(alert.startedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </p>
                  {alert.acknowledgedAt && (
                    <p>
                      <span className="text-text-muted">Confirmado:</span>{' '}
                      <span className="text-text">
                        {format(new Date(alert.acknowledgedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </p>
                  )}
                  {alert.endedAt && (
                    <p>
                      <span className="text-text-muted">Fim:</span>{' '}
                      <span className="text-text">
                        {format(new Date(alert.endedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Trigger values */}
              {alert.triggerValue !== undefined && alert.thresholdValue !== undefined && (
                <div className="bg-background-tertiary rounded-lg p-4">
                  <div className="flex items-center gap-2 text-text-secondary mb-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">Valores</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-text-muted">Valor disparado</p>
                      <p className="text-lg font-bold text-accent-error">
                        {alert.triggerValue.toFixed(1)} mm
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-text-muted">Limiar</p>
                      <p className="text-text">{alert.thresholdValue.toFixed(1)} mm</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Severity info */}
              <div className="bg-background-tertiary rounded-lg p-4">
                <div className="flex items-center gap-2 text-text-secondary mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Severidade</span>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={alert.severity} size="sm" />
                  <span className="text-sm text-text-secondary">
                    {SEVERITY_LABELS[alert.severity]}
                  </span>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium text-text-secondary mb-3">
                Linha do Tempo
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-accent-error" />
                  <div>
                    <p className="text-sm text-text">Alerta emitido</p>
                    <p className="text-xs text-text-muted">
                      {format(new Date(alert.startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {alert.acknowledgedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-accent-warning" />
                    <div>
                      <p className="text-sm text-text">Alerta confirmado</p>
                      <p className="text-xs text-text-muted">
                        {format(new Date(alert.acknowledgedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}

                {alert.endedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-1.5 rounded-full bg-accent-success" />
                    <div>
                      <p className="text-sm text-text">Alerta resolvido</p>
                      <p className="text-xs text-text-muted">
                        {format(new Date(alert.endedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-background-tertiary">
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
            {alert.status === 'active' && (
              <Button variant="secondary" onClick={onAcknowledge}>
                Confirmar Recebimento
              </Button>
            )}
            {alert.status === 'acknowledged' && (
              <Button variant="primary" onClick={onResolve}>
                Resolver Alerta
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
