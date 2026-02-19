'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { COLORS } from '@/constants/colors';

interface AccumulatedData {
  time: string;
  accumulated: number;
}

interface AccumulatedChartProps {
  data: AccumulatedData[];
  threshold?: number;
  height?: number;
  color?: string;
}

export function AccumulatedChart({
  data,
  threshold,
  height = 200,
  color = COLORS.accent.primary,
}: AccumulatedChartProps) {
  const chartData = useMemo(() => {
    let cumulative = 0;
    return data.map((d) => {
      cumulative += d.accumulated;
      return {
        time: format(new Date(d.time), 'HH:mm', { locale: ptBR }),
        fullTime: d.time,
        accumulated: cumulative,
        increment: d.accumulated,
      };
    });
  }, [data]);

  const maxValue = useMemo(() => {
    const dataMax = chartData.length > 0
      ? Math.max(...chartData.map((d) => d.accumulated))
      : 0;
    return Math.max(dataMax, threshold || 0) * 1.1;
  }, [chartData, threshold]);

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="accumulatedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.border.default}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: COLORS.text.muted, fontSize: 11 }}
            axisLine={{ stroke: COLORS.border.default }}
            tickLine={false}
          />
          <YAxis
            domain={[0, maxValue]}
            tick={{ fill: COLORS.text.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value.toFixed(0)}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: COLORS.bg.elevated,
              border: `1px solid ${COLORS.border.default}`,
              borderRadius: 8,
            }}
            labelStyle={{ color: COLORS.text.primary }}
            formatter={(value: number, name: string) => [
              `${value.toFixed(1)} mm`,
              name === 'accumulated' ? 'Acumulado' : 'Incremento',
            ]}
            labelFormatter={(label, payload) => {
              if (payload?.[0]?.payload?.fullTime) {
                return format(new Date(payload[0].payload.fullTime), "dd/MM HH:mm", { locale: ptBR });
              }
              return label;
            }}
          />

          {threshold && (
            <ReferenceLine
              y={threshold}
              stroke={COLORS.severity.alert}
              strokeDasharray="5 5"
              label={{
                value: `Limiar: ${threshold} mm`,
                fill: COLORS.severity.alert,
                fontSize: 10,
                position: 'right',
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="accumulated"
            stroke={color}
            strokeWidth={2}
            fill="url(#accumulatedGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
