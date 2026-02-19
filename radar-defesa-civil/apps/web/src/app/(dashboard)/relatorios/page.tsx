'use client';

import { useState, useCallback } from 'react';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

type ReportType = 'alerts' | 'precipitation' | 'executive-summary';
type ExportFormat = 'pdf' | 'csv';

interface ReportConfig {
  type: ReportType;
  title: string;
  description: string;
  formats: ExportFormat[];
  icon: string;
}

const REPORT_TYPES: ReportConfig[] = [
  {
    type: 'alerts',
    title: 'Relatório de Alertas',
    description: 'Lista detalhada de alertas com severidade, tipo e status',
    formats: ['pdf', 'csv'],
    icon: '🚨',
  },
  {
    type: 'precipitation',
    title: 'Relatório de Precipitação',
    description: 'Histórico de precipitação por município e período',
    formats: ['pdf', 'csv'],
    icon: '🌧️',
  },
  {
    type: 'executive-summary',
    title: 'Resumo Executivo',
    description: 'Visão geral com indicadores e gráficos principais',
    formats: ['pdf'],
    icon: '📊',
  },
];

export default function RelatoriosPage() {
  const [selectedReport, setSelectedReport] = useState<ReportType>('alerts');
  const [startDate, setStartDate] = useState(() => {
    const date = subDays(new Date(), 7);
    return format(date, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [municipalityId, setMunicipalityId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAuthToken = () => {
    return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  };

  const downloadReport = useCallback(async (format: ExportFormat) => {
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      const params = new URLSearchParams({
        start: new Date(startDate).toISOString(),
        end: new Date(endDate).toISOString(),
        format,
      });

      if (severityFilter !== 'all') {
        params.append('severity', severityFilter);
      }

      if (municipalityId) {
        params.append('municipalityId', municipalityId);
      }

      let endpoint = '';
      switch (selectedReport) {
        case 'alerts':
          endpoint = `/reports/alerts?${params}`;
          break;
        case 'precipitation':
          endpoint = `/reports/precipitation?${params}`;
          break;
        case 'executive-summary':
          endpoint = `/reports/executive-summary?${params}`;
          break;
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar relatório');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const reportConfig = REPORT_TYPES.find(r => r.type === selectedReport);
      const fileName = `${reportConfig?.title || 'relatorio'}_${format(new Date(startDate), 'dd-MM-yyyy')}_${format(new Date(endDate), 'dd-MM-yyyy')}.${format}`;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  }, [selectedReport, startDate, endDate, severityFilter, municipalityId]);

  const quickDateRanges = [
    { label: 'Últimas 24h', start: subDays(new Date(), 1), end: new Date() },
    { label: 'Últimos 7 dias', start: subDays(new Date(), 7), end: new Date() },
    { label: 'Últimos 30 dias', start: subDays(new Date(), 30), end: new Date() },
    { label: 'Último trimestre', start: subMonths(new Date(), 3), end: new Date() },
  ];

  const selectedReportConfig = REPORT_TYPES.find(r => r.type === selectedReport);

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Relatórios</h1>
        <p className="text-text-secondary mt-1">
          Gere e exporte relatórios detalhados do sistema
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Type Selection */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-text">Tipo de Relatório</h2>
          <div className="space-y-2">
            {REPORT_TYPES.map((report) => (
              <button
                key={report.type}
                onClick={() => setSelectedReport(report.type)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  selectedReport === report.type
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-background-secondary hover:border-border-hover'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{report.icon}</span>
                  <div>
                    <p className="font-medium text-text">{report.title}</p>
                    <p className="text-sm text-text-secondary mt-1">
                      {report.description}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {report.formats.map((fmt) => (
                        <span
                          key={fmt}
                          className="text-xs px-2 py-0.5 rounded bg-background text-text-secondary uppercase"
                        >
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Report Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Date Range */}
          <div className="bg-background-secondary border border-border rounded-lg p-4">
            <h3 className="text-md font-semibold text-text mb-4">Período</h3>

            {/* Quick Date Ranges */}
            <div className="flex flex-wrap gap-2 mb-4">
              {quickDateRanges.map((range) => (
                <button
                  key={range.label}
                  onClick={() => {
                    setStartDate(format(range.start, 'yyyy-MM-dd'));
                    setEndDate(format(range.end, 'yyyy-MM-dd'));
                  }}
                  className="px-3 py-1.5 text-sm rounded-md bg-background hover:bg-background-elevated text-text-secondary border border-border transition-colors"
                >
                  {range.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Data Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          {selectedReport === 'alerts' && (
            <div className="bg-background-secondary border border-border rounded-lg p-4">
              <h3 className="text-md font-semibold text-text mb-4">Filtros</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Severidade
                  </label>
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
                  >
                    <option value="all">Todas</option>
                    <option value="observation">Observação</option>
                    <option value="attention">Atenção</option>
                    <option value="alert">Alerta</option>
                    <option value="max_alert">Alerta Máximo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Município (opcional)
                  </label>
                  <input
                    type="text"
                    value={municipalityId}
                    onChange={(e) => setMunicipalityId(e.target.value)}
                    placeholder="ID do município"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent placeholder:text-text-secondary/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Preview & Download */}
          <div className="bg-background-secondary border border-border rounded-lg p-4">
            <h3 className="text-md font-semibold text-text mb-4">Gerar Relatório</h3>

            <div className="p-4 bg-background rounded-lg border border-border/50 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{selectedReportConfig?.icon}</span>
                <div>
                  <p className="font-medium text-text">{selectedReportConfig?.title}</p>
                  <p className="text-sm text-text-secondary">
                    {format(new Date(startDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} até{' '}
                    {format(new Date(endDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
              {selectedReport === 'alerts' && severityFilter !== 'all' && (
                <p className="text-sm text-text-secondary">
                  Filtro: Severidade {severityFilter === 'observation' ? 'Observação' :
                    severityFilter === 'attention' ? 'Atenção' :
                    severityFilter === 'alert' ? 'Alerta' : 'Alerta Máximo'}
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-severity-max_alert/10 border border-severity-max_alert/30 rounded-lg mb-4">
                <p className="text-sm text-severity-max_alert">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              {selectedReportConfig?.formats.includes('pdf') && (
                <button
                  onClick={() => downloadReport('pdf')}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Baixar PDF
                </button>
              )}
              {selectedReportConfig?.formats.includes('csv') && (
                <button
                  onClick={() => downloadReport('csv')}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-background-elevated hover:bg-background border border-border text-text rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-text border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  Baixar CSV
                </button>
              )}
            </div>
          </div>

          {/* Recent Reports (placeholder) */}
          <div className="bg-background-secondary border border-border rounded-lg p-4">
            <h3 className="text-md font-semibold text-text mb-4">Relatórios Recentes</h3>
            <div className="text-center py-8 text-text-secondary">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Nenhum relatório gerado recentemente</p>
              <p className="text-sm mt-1">Os relatórios gerados aparecerão aqui</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
