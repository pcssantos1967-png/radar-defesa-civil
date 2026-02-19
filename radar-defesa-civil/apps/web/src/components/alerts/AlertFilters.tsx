'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Search, Filter, X } from 'lucide-react';

interface Filters {
  status: string;
  severity: string;
  municipalityId: string;
}

interface AlertFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

interface Municipality {
  id: string;
  name: string;
}

export function AlertFilters({ filters, onChange }: AlertFiltersProps) {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);

  useEffect(() => {
    loadMunicipalities();
  }, []);

  const loadMunicipalities = async () => {
    try {
      const response = await api.get<{ data: { municipalities: Municipality[] } }>(
        '/municipalities'
      );
      setMunicipalities(response.data.municipalities);
    } catch (error) {
      console.error('Failed to load municipalities:', error);
    }
  };

  const handleChange = (key: keyof Filters, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onChange({ status: '', severity: '', municipalityId: '' });
  };

  const hasFilters = filters.status || filters.severity || filters.municipalityId;

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-background-secondary rounded-lg border border-border">
      <div className="flex items-center gap-2 text-text-secondary">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filtros</span>
      </div>

      {/* Status filter */}
      <select
        value={filters.status}
        onChange={(e) => handleChange('status', e.target.value)}
        className="bg-background-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Todos os status</option>
        <option value="active">Ativos</option>
        <option value="acknowledged">Confirmados</option>
        <option value="resolved">Resolvidos</option>
        <option value="expired">Expirados</option>
      </select>

      {/* Severity filter */}
      <select
        value={filters.severity}
        onChange={(e) => handleChange('severity', e.target.value)}
        className="bg-background-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Todas as severidades</option>
        <option value="max_alert">Alerta Máximo</option>
        <option value="alert">Alerta</option>
        <option value="attention">Atenção</option>
        <option value="observation">Observação</option>
      </select>

      {/* Municipality filter */}
      <select
        value={filters.municipalityId}
        onChange={(e) => handleChange('municipalityId', e.target.value)}
        className="bg-background-tertiary border border-border rounded-md px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Todos os municípios</option>
        {municipalities.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-2 py-1 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <X className="w-3 h-3" />
          Limpar
        </button>
      )}
    </div>
  );
}
