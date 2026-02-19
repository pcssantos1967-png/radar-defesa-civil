'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PrecipitationChart } from '@/components/charts/PrecipitationChart';
import { AccumulatedChart } from '@/components/charts/AccumulatedChart';
import { IntensityGauge } from '@/components/charts/IntensityGauge';
import { CloudRain, Droplets, TrendingUp, MapPin, RefreshCw } from 'lucide-react';

interface Municipality {
  id: string;
  name: string;
  ibgeCode: string;
}

interface AccumulatedData {
  municipalityId: string;
  accumulated: {
    '1h': number;
    '3h': number;
    '6h': number;
    '12h': number;
    '24h': number;
  };
  thresholds: {
    '1h': { attention: number; alert: number; max_alert: number };
    '24h': { attention: number; alert: number; max_alert: number };
  };
}

interface HistoryData {
  observations: Array<{
    time: string;
    precipitation: number;
    avgReflectivity: number;
  }>;
}

export default function PrecipitacaoPage() {
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [period, setPeriod] = useState<'1h' | '3h' | '6h' | '24h'>('24h');

  // Load municipalities
  const { data: municipalitiesData } = useQuery({
    queryKey: ['municipalities'],
    queryFn: async () => {
      const response = await api.get<{ data: { municipalities: Municipality[] } }>(
        '/municipalities'
      );
      return response.data.municipalities;
    },
  });

  // Load accumulated data
  const { data: accumulatedData, refetch: refetchAccumulated } = useQuery({
    queryKey: ['precipitation', 'accumulated', selectedMunicipality],
    queryFn: async () => {
      if (!selectedMunicipality) return null;
      const response = await api.get<{ data: AccumulatedData }>(
        `/precipitation/accumulated/${selectedMunicipality}`
      );
      return response.data;
    },
    enabled: !!selectedMunicipality,
    refetchInterval: 60000,
  });

  // Load history data
  const { data: historyData, refetch: refetchHistory } = useQuery({
    queryKey: ['precipitation', 'history', selectedMunicipality, period],
    queryFn: async () => {
      if (!selectedMunicipality) return null;
      const periodHours = { '1h': 1, '3h': 3, '6h': 6, '24h': 24 }[period];
      const start = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

      const response = await api.get<{ data: HistoryData }>(
        `/precipitation/history/${selectedMunicipality}?start=${start}&interval=10m`
      );
      return response.data;
    },
    enabled: !!selectedMunicipality,
    refetchInterval: 60000,
  });

  // Select first municipality by default
  useEffect(() => {
    if (municipalitiesData?.length && !selectedMunicipality) {
      setSelectedMunicipality(municipalitiesData[0].id);
    }
  }, [municipalitiesData, selectedMunicipality]);

  const handleRefresh = () => {
    refetchAccumulated();
    refetchHistory();
  };

  const selectedMunName = municipalitiesData?.find(
    (m) => m.id === selectedMunicipality
  )?.name;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Precipitação</h1>
          <p className="text-text-secondary">
            Monitoramento de chuva em tempo real
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedMunicipality || ''}
            onChange={(e) => setSelectedMunicipality(e.target.value)}
            className="bg-background-tertiary border border-border rounded-md px-3 py-2 text-text"
          >
            {municipalitiesData?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Button onClick={handleRefresh} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Current location indicator */}
      {selectedMunName && (
        <div className="flex items-center gap-2 text-text-secondary">
          <MapPin className="w-4 h-4" />
          <span>Exibindo dados para: {selectedMunName}</span>
        </div>
      )}

      {/* Accumulated precipitation cards */}
      {accumulatedData && (
        <div className="grid grid-cols-5 gap-4">
          {(['1h', '3h', '6h', '12h', '24h'] as const).map((period) => {
            const value = accumulatedData.accumulated[period];
            const threshold = period === '1h'
              ? accumulatedData.thresholds['1h']
              : period === '24h'
              ? accumulatedData.thresholds['24h']
              : null;

            const isAlert = threshold && value >= threshold.alert;
            const isAttention = threshold && value >= threshold.attention;

            return (
              <Card
                key={period}
                className={`${
                  isAlert
                    ? 'border-severity-alert bg-severity-alert/10'
                    : isAttention
                    ? 'border-severity-attention bg-severity-attention/10'
                    : ''
                }`}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-secondary mb-2">
                    <Droplets className="w-4 h-4" />
                    <span className="text-sm">{period}</span>
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      isAlert
                        ? 'text-severity-alert'
                        : isAttention
                        ? 'text-severity-attention'
                        : 'text-text'
                    }`}
                  >
                    {value.toFixed(1)}
                  </div>
                  <div className="text-xs text-text-muted">mm</div>
                  {threshold && (
                    <div className="text-xs text-text-muted mt-1">
                      Limiar: {threshold.attention} mm
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Precipitation history chart */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudRain className="w-5 h-5 text-accent" />
              Histórico de Precipitação
            </CardTitle>
            <div className="flex gap-2">
              {(['1h', '3h', '6h', '24h'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 rounded text-xs ${
                    period === p
                      ? 'bg-accent text-background'
                      : 'bg-background-tertiary text-text-secondary hover:text-text'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {historyData?.observations ? (
              <PrecipitationChart
                data={historyData.observations}
                thresholds={
                  accumulatedData?.thresholds['1h']
                    ? {
                        attention: accumulatedData.thresholds['1h'].attention,
                        alert: accumulatedData.thresholds['1h'].alert,
                        maxAlert: accumulatedData.thresholds['1h'].max_alert,
                      }
                    : undefined
                }
                height={300}
              />
            ) : (
              <div className="h-[300px] flex items-center justify-center text-text-secondary">
                Selecione um município para ver os dados
              </div>
            )}
          </CardContent>
        </Card>

        {/* Intensity gauge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              Intensidade Atual
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <IntensityGauge
              value={accumulatedData?.accumulated['1h'] || 0}
              maxValue={100}
              thresholds={{
                attention: accumulatedData?.thresholds['1h']?.attention || 20,
                alert: accumulatedData?.thresholds['1h']?.alert || 40,
                maxAlert: accumulatedData?.thresholds['1h']?.max_alert || 60,
              }}
              label="Última hora"
              unit="mm"
              size="lg"
            />

            {/* Accumulated chart */}
            <div className="w-full mt-6">
              <h4 className="text-sm font-medium text-text-secondary mb-2">
                Acumulado 24h
              </h4>
              {historyData?.observations && (
                <AccumulatedChart
                  data={historyData.observations.map((o) => ({
                    time: o.time,
                    accumulated: o.precipitation,
                  }))}
                  threshold={accumulatedData?.thresholds['24h']?.alert}
                  height={150}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
