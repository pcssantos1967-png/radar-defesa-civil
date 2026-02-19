'use client';

import { useState } from 'react';
import {
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  History,
  MapPin,
  Bell,
  Mail,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  type: string;
  conditions: object;
  actions: {
    notify: boolean;
    channels?: string[];
    escalate?: boolean;
  };
  cooldownMinutes: number;
  priority: number;
  isActive: boolean;
  municipalityId?: string;
  municipality?: { id: string; name: string };
  createdAt: string;
}

interface RuleListProps {
  rules: AlertRule[];
  onEdit: (rule: AlertRule) => void;
  onToggle: (ruleId: string) => void;
  onDelete: (ruleId: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  precipitation_1h: 'Precipitação 1h',
  precipitation_24h: 'Precipitação 24h',
  reflectivity: 'Refletividade Radar',
  wind: 'Vento',
  convective: 'Células Convectivas',
  flood_risk: 'Risco de Alagamento',
};

const CHANNEL_ICONS: Record<string, typeof Bell> = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageSquare,
  push: Bell,
};

export function RuleList({ rules, onEdit, onToggle, onDelete }: RuleListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ruleId: string;
    triggered: boolean;
    message: string;
  } | null>(null);

  // Test rule mutation
  const testMutation = useMutation({
    mutationFn: async ({ ruleId, municipalityId }: { ruleId: string; municipalityId: string }) => {
      const response = await api.post<{
        data: {
          evaluation: {
            triggered: boolean;
            message: string;
            severity?: string;
            triggerValue?: number;
          };
        };
      }>(`/alerts/rules/${ruleId}/test`, { municipalityId });
      return { ruleId, ...response.data.evaluation };
    },
    onSuccess: (data) => {
      setTestResult({
        ruleId: data.ruleId,
        triggered: data.triggered,
        message: data.message,
      });
      setTestingId(null);
    },
    onError: () => {
      setTestingId(null);
    },
  });

  const handleTest = (rule: AlertRule) => {
    if (!rule.municipalityId) {
      alert('Selecione um município para testar');
      return;
    }
    setTestingId(rule.id);
    testMutation.mutate({ ruleId: rule.id, municipalityId: rule.municipalityId });
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className={`border rounded-lg transition-colors ${
            rule.isActive
              ? 'border-border bg-background-secondary'
              : 'border-border/50 bg-background-tertiary/50 opacity-60'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-4 p-4">
            <button
              onClick={() => toggleExpanded(rule.id)}
              className="text-text-secondary hover:text-text"
            >
              {expandedId === rule.id ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-text truncate">{rule.name}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                  {TYPE_LABELS[rule.type] || rule.type}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-background-tertiary text-text-muted">
                  P{rule.priority}
                </span>
              </div>
              {rule.municipality && (
                <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
                  <MapPin className="w-3 h-3" />
                  {rule.municipality.name}
                </div>
              )}
            </div>

            {/* Channels */}
            <div className="flex items-center gap-1">
              {rule.actions.channels?.map((channel) => {
                const Icon = CHANNEL_ICONS[channel] || Bell;
                return (
                  <div
                    key={channel}
                    className="p-1.5 rounded bg-background-tertiary"
                    title={channel}
                  >
                    <Icon className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggle(rule.id)}
                className="text-text-secondary hover:text-text"
                title={rule.isActive ? 'Desativar' : 'Ativar'}
              >
                {rule.isActive ? (
                  <ToggleRight className="w-6 h-6 text-green-500" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </button>
              <button
                onClick={() => onEdit(rule)}
                className="p-1.5 rounded hover:bg-background-tertiary text-text-secondary hover:text-text"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(rule.id)}
                className="p-1.5 rounded hover:bg-background-tertiary text-text-secondary hover:text-severity-alert"
                title="Excluir"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expanded content */}
          {expandedId === rule.id && (
            <div className="border-t border-border px-4 py-3 space-y-4">
              {rule.description && (
                <p className="text-sm text-text-secondary">{rule.description}</p>
              )}

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-text-muted">Cooldown:</span>
                  <span className="ml-2 text-text">{rule.cooldownMinutes} minutos</span>
                </div>
                <div>
                  <span className="text-text-muted">Escalonamento:</span>
                  <span className="ml-2 text-text">
                    {rule.actions.escalate ? 'Sim' : 'Não'}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Criado em:</span>
                  <span className="ml-2 text-text">
                    {new Date(rule.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Conditions preview */}
              <div className="bg-background-tertiary rounded p-3">
                <div className="text-xs text-text-muted mb-2">Condições:</div>
                <pre className="text-xs text-text overflow-auto max-h-32">
                  {JSON.stringify(rule.conditions, null, 2)}
                </pre>
              </div>

              {/* Test result */}
              {testResult?.ruleId === rule.id && (
                <div
                  className={`p-3 rounded text-sm ${
                    testResult.triggered
                      ? 'bg-severity-attention/10 text-severity-attention'
                      : 'bg-green-500/10 text-green-500'
                  }`}
                >
                  <strong>{testResult.triggered ? 'Dispararia' : 'Não dispararia'}:</strong>{' '}
                  {testResult.message}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleTest(rule)}
                  disabled={testingId === rule.id || !rule.municipalityId}
                >
                  <PlayCircle className="w-4 h-4 mr-1" />
                  {testingId === rule.id ? 'Testando...' : 'Testar Regra'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.location.href = `/configuracoes/regras/${rule.id}/historico`}
                >
                  <History className="w-4 h-4 mr-1" />
                  Ver Histórico
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
