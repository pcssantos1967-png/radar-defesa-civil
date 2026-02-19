'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/services/api';
import {
  AlertTrendChart,
  SeverityDistributionChart,
  PrecipitationHistoryChart,
  MunicipalityComparisonChart,
} from '@/components/charts';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OverviewStats {
  total_alerts: number;
  active_alerts: number;
  resolved_alerts: number;
  avg_resolution_time_minutes: number;
  total_municipalities_affected: number;
  period: {
    start: string;
    end: string;
  };
}

interface AlertStats {
  by_severity: Array<{
    severity: 'observation' | 'attention' | 'alert' | 'max_alert';
    count: number;
    percentage: number;
  }>;
  by_type: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  trends: {
    current_period: number;
    previous_period: number;
    change_percentage: number;
  };
}

interface TimeSeriesData {
  period: string;
  observation: number;
  attention: number;
  alert: number;
  max_alert: number;
  total: number;
}

interface PrecipitationData {
  period: string;
  total_mm: number;
  avg_mm: number;
  max_mm: number;
  readings_count: number;
}

interface MunicipalityData {
  municipality_id: string;
  municipality_name: string;
  total_alerts: number;
  critical_alerts: number;
  avg_precipitation_mm: number;
  max_precipitation_mm: number;
}

type TimeRange = '24h' | '7d' | '30d' | '90d';
type ChartInterval = 'hour' | 'day' | 'week' | 'month';

export default function EstatisticasPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [alertStats, setAlertStats] = useState<AlertStats | null>(null);
  const [alertTimeSeries, setAlertTimeSeries] = useState<TimeSeriesData[]>([]);
  const [precipitationData, setPrecipitationData] = useState<PrecipitationData[]>([]);
  const [municipalityData, setMunicipalityData] = useState<MunicipalityData[]>([]);

  const getDateRange = useCallback((): { start: string; end: string; interval: ChartInterval } => {
    const end = new Date();
    let start: Date;
    let interval: ChartInterval;

    switch (timeRange) {
      case '24h':
        start = subDays(end, 1);
        interval = 'hour';
        break;
      case '7d':
        start = subDays(end, 7);
        interval = 'day';
        break;
      case '30d':
        start = subDays(end, 30);
        interval = 'day';
        break;
      case '90d':
        start = subMonths(end, 3);
        interval = 'week';
        break;
      default:
        start = subDays(end, 7);
        interval = 'day';
    }

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      interval,
    };
  }, [timeRange]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { start, end, interval } = getDateRange();

      try {
        const [overviewRes, alertStatsRes, timeSeriesRes, precipRes, munRes] = await Promise.all([
          api.get<OverviewStats>(`/statistics/overview?start=${start}&end=${end}`),
          api.get<AlertStats>(`/statistics/alerts?start=${start}&end=${end}`),
          api.get<{ data: TimeSeriesData[] }>(`/statistics/alerts/timeseries?start=${start}&end=${end}&interval=${interval}`),
          api.get<{ data: PrecipitationData[] }>(`/statistics/precipitation/timeseries?start=${start}&end=${end}&interval=${interval}`),
          api.get<{ data: MunicipalityData[] }>(`/statistics/municipalities?start=${start}&end=${end}&limit=10`),
        ]);

        setOverview(overviewRes);
        setAlertStats(alertStatsRes);
        setAlertTimeSeries(timeSeriesRes.data || []);
        setPrecipitationData(precipRes.data || []);
        setMunicipalityData(munRes.data || []);
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [getDateRange]);

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: '24h', label: 'Últimas 24h' },
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
  ];

  const formatTrendChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  const getTrendColor = (change: number) => {
    if (change > 10) return 'text-severity-alert';
    if (change > 0) return 'text-severity-attention';
    if (change < -10) return 'text-severity-observation';
    return 'text-text-secondary';
  };

  if (loading && !overview) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-text-secondary">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Estatísticas</h1>
          <p className="text-text-secondary mt-1">
            Análise detalhada de alertas e precipitação
          </p>
        </div>

        <div className="flex items-center gap-2">
          {timeRangeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeRange(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === option.value
                  ? 'bg-accent text-white'
                  : 'bg-background-secondary text-text-secondary hover:bg-background-elevated'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <p className="text-text-secondary text-sm">Total de Alertas</p>
          <p className="text-3xl font-bold text-text mt-1">
            {overview?.total_alerts.toLocaleString('pt-BR') || 0}
          </p>
          {alertStats?.trends && (
            <p className={`text-sm mt-2 ${getTrendColor(alertStats.trends.change_percentage)}`}>
              {formatTrendChange(alertStats.trends.change_percentage)} vs período anterior
            </p>
          )}
        </div>

        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <p className="text-text-secondary text-sm">Alertas Ativos</p>
          <p className="text-3xl font-bold text-severity-alert mt-1">
            {overview?.active_alerts.toLocaleString('pt-BR') || 0}
          </p>
          <p className="text-sm text-text-secondary mt-2">
            {overview?.resolved_alerts.toLocaleString('pt-BR') || 0} resolvidos
          </p>
        </div>

        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <p className="text-text-secondary text-sm">Tempo Médio de Resolução</p>
          <p className="text-3xl font-bold text-text mt-1">
            {overview?.avg_resolution_time_minutes
              ? `${Math.round(overview.avg_resolution_time_minutes)} min`
              : '-'}
          </p>
          <p className="text-sm text-text-secondary mt-2">
            Para alertas resolvidos
          </p>
        </div>

        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <p className="text-text-secondary text-sm">Municípios Afetados</p>
          <p className="text-3xl font-bold text-text mt-1">
            {overview?.total_municipalities_affected || 0}
          </p>
          <p className="text-sm text-text-secondary mt-2">
            No período selecionado
          </p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-background-secondary border border-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-text mb-4">Tendência de Alertas</h2>
          <AlertTrendChart
            data={alertTimeSeries}
            interval={getDateRange().interval}
          />
        </div>

        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-text mb-4">Distribuição por Severidade</h2>
          <SeverityDistributionChart data={alertStats?.by_severity || []} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-text mb-4">Histórico de Precipitação</h2>
          <PrecipitationHistoryChart
            data={precipitationData}
            interval={getDateRange().interval}
            showAverage
            showMax
          />
        </div>

        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-text mb-4">Top Municípios por Alertas</h2>
          <MunicipalityComparisonChart data={municipalityData} metric="alerts" />
        </div>
      </div>

      {/* Alert Types Table */}
      {alertStats?.by_type && alertStats.by_type.length > 0 && (
        <div className="bg-background-secondary border border-border rounded-lg p-4">
          <h2 className="text-lg font-semibold text-text mb-4">Alertas por Tipo</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-text-secondary font-medium">Tipo</th>
                  <th className="text-right py-3 px-4 text-text-secondary font-medium">Quantidade</th>
                  <th className="text-right py-3 px-4 text-text-secondary font-medium">Percentual</th>
                  <th className="text-left py-3 px-4 text-text-secondary font-medium w-1/3">Distribuição</th>
                </tr>
              </thead>
              <tbody>
                {alertStats.by_type.map((item) => (
                  <tr key={item.type} className="border-b border-border/50">
                    <td className="py-3 px-4 text-text">{item.type}</td>
                    <td className="py-3 px-4 text-text text-right">{item.count.toLocaleString('pt-BR')}</td>
                    <td className="py-3 px-4 text-text-secondary text-right">{item.percentage.toFixed(1)}%</td>
                    <td className="py-3 px-4">
                      <div className="h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer with period info */}
      {overview?.period && (
        <p className="text-center text-text-secondary text-sm">
          Dados de {format(new Date(overview.period.start), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} a{' '}
          {format(new Date(overview.period.end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}
