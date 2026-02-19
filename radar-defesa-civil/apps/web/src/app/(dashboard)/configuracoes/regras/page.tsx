'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RuleEditor } from '@/components/alerts/RuleEditor';
import { RuleList } from '@/components/alerts/RuleList';
import { Plus, Settings2, AlertTriangle } from 'lucide-react';

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

export default function RegrasAlertaPage() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Load rules
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const response = await api.get<{ data: { rules: AlertRule[] } }>('/alerts/rules');
      return response.data.rules;
    },
  });

  // Toggle rule active status
  const toggleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await api.patch(`/alerts/rules/${ruleId}/toggle`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      await api.delete(`/alerts/rules/${ruleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
    },
  });

  const handleCreateNew = () => {
    setEditingRule(null);
    setShowEditor(true);
  };

  const handleEdit = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingRule(null);
    queryClient.invalidateQueries({ queryKey: ['alert-rules'] });
  };

  const handleToggle = (ruleId: string) => {
    toggleMutation.mutate(ruleId);
  };

  const handleDelete = (ruleId: string) => {
    if (confirm('Tem certeza que deseja excluir esta regra?')) {
      deleteMutation.mutate(ruleId);
    }
  };

  // Stats
  const activeRules = rulesData?.filter((r) => r.isActive).length || 0;
  const totalRules = rulesData?.length || 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Regras de Alerta</h1>
          <p className="text-text-secondary">
            Configure regras automáticas para geração de alertas
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Regra
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Settings2 className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text">{totalRules}</div>
                <div className="text-sm text-text-muted">Total de Regras</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text">{activeRules}</div>
                <div className="text-sm text-text-muted">Regras Ativas</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-text">
                  {totalRules - activeRules}
                </div>
                <div className="text-sm text-text-muted">Regras Inativas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>Regras Configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
            </div>
          ) : rulesData?.length ? (
            <RuleList
              rules={rulesData}
              onEdit={handleEdit}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ) : (
            <div className="text-center py-12 text-text-secondary">
              <Settings2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma regra configurada</p>
              <p className="text-sm mt-1">Clique em "Nova Regra" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule Editor Modal */}
      {showEditor && (
        <RuleEditor
          rule={editingRule}
          onClose={handleEditorClose}
          onSave={handleEditorClose}
        />
      )}
    </div>
  );
}
