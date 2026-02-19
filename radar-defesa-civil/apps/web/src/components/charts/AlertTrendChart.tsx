'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertTrendData {
  period: string;
  observation: number;
  attention: number;
  alert: number;
  max_alert: number;
  total: number;
}

interface AlertTrendChartProps {
  data: AlertTrendData[];
  interval?: 'hour' | 'day' | 'week' | 'month';
  showTotal?: boolean;
}

const SEVERITY_COLORS = {
  observation: '#4CAF50',
  attention: '#FFD600',
  alert: '#FF9800',
  max_alert: '#FF1744',
  total: '#00E5FF',
};

const SEVERITY_LABELS = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
  total: 'Total',
};

export function AlertTrendChart({
  data,
  interval = 'day',
  showTotal = false,
}: AlertTrendChartProps) {
  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      formattedPeriod: formatPeriod(item.period, interval),
    }));
  }, [data, interval]);

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

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
  }) => {
    if (!active || !payload) return null;

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
              {SEVERITY_LABELS[entry.name as keyof typeof SEVERITY_LABELS] || entry.name}:
            </span>
            <span className="text-text font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          {Object.entries(SEVERITY_COLORS).map(([key, color]) => (
            <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          ))}
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
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => SEVERITY_LABELS[value as keyof typeof SEVERITY_LABELS] || value}
          wrapperStyle={{ fontSize: 12 }}
        />

        {showTotal ? (
          <Area
            type="monotone"
            dataKey="total"
            stroke={SEVERITY_COLORS.total}
            fill={`url(#gradient-total)`}
            strokeWidth={2}
          />
        ) : (
          <>
            <Area
              type="monotone"
              dataKey="max_alert"
              stackId="1"
              stroke={SEVERITY_COLORS.max_alert}
              fill={`url(#gradient-max_alert)`}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="alert"
              stackId="1"
              stroke={SEVERITY_COLORS.alert}
              fill={`url(#gradient-alert)`}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="attention"
              stackId="1"
              stroke={SEVERITY_COLORS.attention}
              fill={`url(#gradient-attention)`}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="observation"
              stackId="1"
              stroke={SEVERITY_COLORS.observation}
              fill={`url(#gradient-observation)`}
              strokeWidth={2}
            />
          </>
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
