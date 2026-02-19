'use client';

import { useMemo } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PrecipitationData {
  period: string;
  total_mm: number;
  avg_mm: number;
  max_mm: number;
  readings_count: number;
}

interface PrecipitationHistoryChartProps {
  data: PrecipitationData[];
  interval?: 'hour' | 'day' | 'week' | 'month';
  showAverage?: boolean;
  showMax?: boolean;
}

export function PrecipitationHistoryChart({
  data,
  interval = 'day',
  showAverage = true,
  showMax = false,
}: PrecipitationHistoryChartProps) {
  const formatPeriod = (period: string, interval: string) => {
    const date = parseISO(period);
    switch (interval) {
      case 'hour':
        return format(date, 'dd/MM HH:mm', { locale: ptBR });
      case 'day':
        return format(date, 'dd/MM', { locale: ptBR });
      case 'week':
        return format(date, "'Sem' w", { locale: ptBR });
      case 'month':
        return format(date, 'MMM/yy', { locale: ptBR });
      default:
        return format(date, 'dd/MM', { locale: ptBR });
    }
  };

  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      formattedPeriod: formatPeriod(item.period, interval),
    }));
  }, [data, interval]);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;

    const labels: Record<string, string> = {
      total_mm: 'Total',
      avg_mm: 'Média',
      max_mm: 'Máximo',
    };

    return (
      <div className="bg-background-elevated border border-border rounded-lg p-3 shadow-lg">
        <p className="text-text-secondary text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-text-secondary">
              {labels[entry.name] || entry.name}:
            </span>
            <span className="text-text font-medium">
              {entry.value.toFixed(1)} mm
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00B8D4" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#00B8D4" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
        <XAxis
          dataKey="formattedPeriod"
          stroke="#64748B"
          fontSize={11}
          tickLine={false}
        />
        <YAxis
          stroke="#64748B"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          label={{
            value: 'mm',
            angle: -90,
            position: 'insideLeft',
            style: { fill: '#64748B', fontSize: 11 },
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => {
            const labels: Record<string, string> = {
              total_mm: 'Total (mm)',
              avg_mm: 'Média (mm)',
              max_mm: 'Máximo (mm)',
            };
            return labels[value] || value;
          }}
          wrapperStyle={{ fontSize: 12 }}
        />

        <Bar
          dataKey="total_mm"
          fill="url(#precipGradient)"
          radius={[4, 4, 0, 0]}
        />

        {showAverage && (
          <Line
            type="monotone"
            dataKey="avg_mm"
            stroke="#FFD600"
            strokeWidth={2}
            dot={false}
          />
        )}

        {showMax && (
          <Line
            type="monotone"
            dataKey="max_mm"
            stroke="#FF1744"
            strokeWidth={2}
            dot={false}
            strokeDasharray="5 5"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
