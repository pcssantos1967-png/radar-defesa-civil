'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  X,
  Plus,
  Trash2,
  Save,
  AlertTriangle,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
} from 'lucide-react';

interface Condition {
  id: string;
  source: string;
  field: string;
  operator: string;
  value: number;
  timeWindow?: string;
}

interface AlertRule {
  id?: string;
  name: string;
  description?: string;
  type: string;
  conditions: {
    logic?: 'AND' | 'OR';
    conditions?: Condition[];
  } | Condition;
  actions: {
    notify: boolean;
    channels?: string[];
    escalate?: boolean;
    escalateAfterMinutes?: number;
  };
  severityMapping?: {
    attention: number;
    alert: number;
    maxAlert: number;
  };
  cooldownMinutes: number;
  priority: number;
  isActive: boolean;
  municipalityId?: string;
}

interface RuleEditorProps {
  rule?: AlertRule | null;
  onClose: () => void;
  onSave: () => void;
}

interface Municipality {
  id: string;
  name: string;
}

const SOURCES = [
  { value: 'precipitation_accumulated', label: 'Precipitação Acumulada' },
  { value: 'precipitation_rate', label: 'Taxa de Precipitação' },
  { value: 'radar_reflectivity', label: 'Refletividade Radar' },
  { value: 'station_precipitation', label: 'Precipitação Estação' },
  { value: 'station_wind', label: 'Velocidade Vento' },
  { value: 'convective_cell', label: 'Célula Convectiva' },
  { value: 'risk_area_overlap', label: 'Área de Risco' },
];

const OPERATORS = [
  { value: 'gt', label: '> (maior que)' },
  { value: 'gte', label: '>= (maior ou igual)' },
  { value: 'lt', label: '< (menor que)' },
  { value: 'lte', label: '<= (menor ou igual)' },
  { value: 'eq', label: '= (igual)' },
];

const TIME_WINDOWS = [
  { value: '10m', label: '10 minutos' },
  { value: '30m', label: '30 minutos' },
  { value: '1h', label: '1 hora' },
  { value: '3h', label: '3 horas' },
  { value: '6h', label: '6 horas' },
  { value: '12h', label: '12 horas' },
  { value: '24h', label: '24 horas' },
];

const TYPES = [
  { value: 'precipitation_1h', label: 'Precipitação 1h' },
  { value: 'precipitation_24h', label: 'Precipitação 24h' },
  { value: 'reflectivity', label: 'Refletividade' },
  { value: 'wind', label: 'Vento' },
  { value: 'convective', label: 'Células Convectivas' },
  { value: 'flood_risk', label: 'Risco de Alagamento' },
];

const CHANNELS = [
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'sms', label: 'SMS', icon: Smartphone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'push', label: 'Push', icon: Bell },
];

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function RuleEditor({ rule, onClose, onSave }: RuleEditorProps) {
  const isEditing = !!rule?.id;

  // Form state
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [type, setType] = useState(rule?.type || 'precipitation_1h');
  const [municipalityId, setMunicipalityId] = useState(rule?.municipalityId || '');
  const [conditions, setConditions] = useState<Condition[]>(() => {
    if (rule?.conditions && 'conditions' in rule.conditions) {
      return (rule.conditions.conditions as Condition[]) || [];
    }
    if (rule?.conditions && 'source' in rule.conditions) {
      return [rule.conditions as Condition];
    }
    return [
      {
        id: generateId(),
        source: 'precipitation_accumulated',
        field: 'value',
        operator: 'gte',
        value: 30,
        timeWindow: '1h',
      },
    ];
  });
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>(
    rule?.conditions && 'logic' in rule.conditions
      ? rule.conditions.logic || 'AND'
      : 'AND'
  );
  const [channels, setChannels] = useState<string[]>(rule?.actions.channels || ['email']);
  const [escalate, setEscalate] = useState(rule?.actions.escalate || false);
  const [escalateAfterMinutes, setEscalateAfterMinutes] = useState(
    rule?.actions.escalateAfterMinutes || 30
  );
  const [cooldownMinutes, setCooldownMinutes] = useState(rule?.cooldownMinutes || 30);
  const [priority, setPriority] = useState(rule?.priority || 5);
  const [severityMapping, setSeverityMapping] = useState(
    rule?.severityMapping || { attention: 20, alert: 40, maxAlert: 60 }
  );

  // Load municipalities
  const { data: municipalities } = useQuery({
    queryKey: ['municipalities'],
    queryFn: async () => {
      const response = await api.get<{ data: { municipalities: Municipality[] } }>(
        '/municipalities'
      );
      return response.data.municipalities;
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Partial<AlertRule>) => {
      if (isEditing) {
        await api.put(`/alerts/rules/${rule!.id}`, data);
      } else {
        await api.post('/alerts/rules', data);
      }
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        id: generateId(),
        source: 'precipitation_accumulated',
        field: 'value',
        operator: 'gte',
        value: 0,
        timeWindow: '1h',
      },
    ]);
  };

  const handleRemoveCondition = (id: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter((c) => c.id !== id));
    }
  };

  const handleUpdateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(
      conditions.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleChannelToggle = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const handleSave = () => {
    const ruleData: Partial<AlertRule> = {
      name,
      description: description || undefined,
      type,
      municipalityId: municipalityId || undefined,
      conditions:
        conditions.length === 1
          ? conditions[0]
          : { logic: conditionLogic, conditions, severityMapping },
      actions: {
        notify: true,
        channels,
        escalate,
        escalateAfterMinutes: escalate ? escalateAfterMinutes : undefined,
      },
      cooldownMinutes,
      priority,
    };

    saveMutation.mutate(ruleData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex-row items-center justify-between border-b border-border">
          <CardTitle>
            {isEditing ? 'Editar Regra' : 'Nova Regra de Alerta'}
          </CardTitle>
          <button onClick={onClose} className="text-text-secondary hover:text-text">
            <X className="w-5 h-5" />
          </button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">
              Informações Básicas
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                  placeholder="Nome da regra"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Município (opcional)
                </label>
                <select
                  value={municipalityId}
                  onChange={(e) => setMunicipalityId(e.target.value)}
                  className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                >
                  <option value="">Todos os municípios</option>
                  {municipalities?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  Prioridade (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">
                Descrição (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text h-20 resize-none"
                placeholder="Descrição da regra..."
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-text-secondary">Condições</h3>
              {conditions.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Lógica:</span>
                  <button
                    onClick={() =>
                      setConditionLogic(conditionLogic === 'AND' ? 'OR' : 'AND')
                    }
                    className={`px-2 py-1 text-xs rounded ${
                      conditionLogic === 'AND'
                        ? 'bg-accent text-background'
                        : 'bg-background-tertiary text-text'
                    }`}
                  >
                    {conditionLogic}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div
                  key={condition.id}
                  className="flex items-center gap-2 p-3 bg-background-tertiary rounded"
                >
                  {index > 0 && (
                    <span className="text-xs text-text-muted w-8 text-center">
                      {conditionLogic}
                    </span>
                  )}
                  <select
                    value={condition.source}
                    onChange={(e) =>
                      handleUpdateCondition(condition.id, { source: e.target.value })
                    }
                    className="flex-1 bg-background-secondary border border-border rounded px-2 py-1.5 text-sm text-text"
                  >
                    {SOURCES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      handleUpdateCondition(condition.id, { operator: e.target.value })
                    }
                    className="w-36 bg-background-secondary border border-border rounded px-2 py-1.5 text-sm text-text"
                  >
                    {OPERATORS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={condition.value}
                    onChange={(e) =>
                      handleUpdateCondition(condition.id, {
                        value: Number(e.target.value),
                      })
                    }
                    className="w-20 bg-background-secondary border border-border rounded px-2 py-1.5 text-sm text-text"
                  />
                  <select
                    value={condition.timeWindow || '1h'}
                    onChange={(e) =>
                      handleUpdateCondition(condition.id, { timeWindow: e.target.value })
                    }
                    className="w-28 bg-background-secondary border border-border rounded px-2 py-1.5 text-sm text-text"
                  >
                    {TIME_WINDOWS.map((tw) => (
                      <option key={tw.value} value={tw.value}>
                        {tw.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemoveCondition(condition.id)}
                    className="p-1.5 text-text-secondary hover:text-severity-alert disabled:opacity-30"
                    disabled={conditions.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <Button variant="secondary" size="sm" onClick={handleAddCondition}>
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Condição
            </Button>
          </div>

          {/* Severity Mapping */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">
              Limiares de Severidade
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  <span className="inline-block w-3 h-3 rounded bg-severity-attention mr-2" />
                  Atenção
                </label>
                <input
                  type="number"
                  value={severityMapping.attention}
                  onChange={(e) =>
                    setSeverityMapping({
                      ...severityMapping,
                      attention: Number(e.target.value),
                    })
                  }
                  className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  <span className="inline-block w-3 h-3 rounded bg-severity-alert mr-2" />
                  Alerta
                </label>
                <input
                  type="number"
                  value={severityMapping.alert}
                  onChange={(e) =>
                    setSeverityMapping({
                      ...severityMapping,
                      alert: Number(e.target.value),
                    })
                  }
                  className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">
                  <span className="inline-block w-3 h-3 rounded bg-severity-max-alert mr-2" />
                  Alerta Máximo
                </label>
                <input
                  type="number"
                  value={severityMapping.maxAlert}
                  onChange={(e) =>
                    setSeverityMapping({
                      ...severityMapping,
                      maxAlert: Number(e.target.value),
                    })
                  }
                  className="w-full bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                />
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-text-secondary">Notificações</h3>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => {
                const Icon = channel.icon;
                const isSelected = channels.includes(channel.value);
                return (
                  <button
                    key={channel.value}
                    onClick={() => handleChannelToggle(channel.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
                      isSelected
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-background-tertiary text-text-secondary hover:text-text'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {channel.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Escalation */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="escalate"
                checked={escalate}
                onChange={(e) => setEscalate(e.target.checked)}
                className="w-4 h-4 rounded border-border bg-background-tertiary"
              />
              <label htmlFor="escalate" className="text-sm text-text">
                Escalonar se não reconhecido
              </label>
            </div>
            {escalate && (
              <div className="ml-7">
                <label className="block text-sm text-text-muted mb-1">
                  Escalonar após (minutos)
                </label>
                <input
                  type="number"
                  min={5}
                  value={escalateAfterMinutes}
                  onChange={(e) => setEscalateAfterMinutes(Number(e.target.value))}
                  className="w-32 bg-background-tertiary border border-border rounded px-3 py-2 text-text"
                />
              </div>
            )}
          </div>

          {/* Cooldown */}
          <div>
            <label className="block text-sm text-text-muted mb-1">
              Cooldown (minutos)
            </label>
            <input
              type="number"
              min={1}
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(Number(e.target.value))}
              className="w-32 bg-background-tertiary border border-border rounded px-3 py-2 text-text"
            />
            <p className="text-xs text-text-muted mt-1">
              Tempo mínimo entre alertas da mesma regra
            </p>
          </div>
        </CardContent>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-background-secondary">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name || saveMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending
              ? 'Salvando...'
              : isEditing
              ? 'Salvar Alterações'
              : 'Criar Regra'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
