'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
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

interface PrecipitationData {
  time: string;
  precipitation: number;
  avgReflectivity?: number;
}

interface PrecipitationChartProps {
  data: PrecipitationData[];
  thresholds?: {
    attention?: number;
    alert?: number;
    maxAlert?: number;
  };
  height?: number;
  showReflectivity?: boolean;
}

export function PrecipitationChart({
  data,
  thresholds,
  height = 300,
  showReflectivity = false,
}: PrecipitationChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      time: format(new Date(d.time), 'HH:mm', { locale: ptBR }),
      fullTime: d.time,
    }));
  }, [data]);

  const maxPrecip = useMemo(() => {
    const dataMax = Math.max(...data.map((d) => d.precipitation), 0);
    const thresholdMax = Math.max(
      thresholds?.attention || 0,
      thresholds?.alert || 0,
      thresholds?.maxAlert || 0
    );
    return Math.max(dataMax, thresholdMax) * 1.1;
  }, [data, thresholds]);

  const getBarColor = (value: number): string => {
    if (thresholds?.maxAlert && value >= thresholds.maxAlert) {
      return COLORS.severity.maxAlert;
    }
    if (thresholds?.alert && value >= thresholds.alert) {
      return COLORS.severity.alert;
    }
    if (thresholds?.attention && value >= thresholds.attention) {
      return COLORS.severity.attention;
    }
    return COLORS.accent.primary;
  };

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
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
            domain={[0, maxPrecip]}
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
            itemStyle={{ color: COLORS.text.secondary }}
            formatter={(value: number) => [`${value.toFixed(1)} mm`, 'Precipitação']}
            labelFormatter={(label, payload) => {
              if (payload?.[0]?.payload?.fullTime) {
                return format(new Date(payload[0].payload.fullTime), "dd/MM HH:mm", { locale: ptBR });
              }
              return label;
            }}
          />

          {/* Threshold reference lines */}
          {thresholds?.attention && (
            <ReferenceLine
              y={thresholds.attention}
              stroke={COLORS.severity.attention}
              strokeDasharray="5 5"
              label={{
                value: 'Atenção',
                fill: COLORS.severity.attention,
                fontSize: 10,
                position: 'right',
              }}
            />
          )}
          {thresholds?.alert && (
            <ReferenceLine
              y={thresholds.alert}
              stroke={COLORS.severity.alert}
              strokeDasharray="5 5"
              label={{
                value: 'Alerta',
                fill: COLORS.severity.alert,
                fontSize: 10,
                position: 'right',
              }}
            />
          )}
          {thresholds?.maxAlert && (
            <ReferenceLine
              y={thresholds.maxAlert}
              stroke={COLORS.severity.maxAlert}
              strokeDasharray="5 5"
              label={{
                value: 'Máximo',
                fill: COLORS.severity.maxAlert,
                fontSize: 10,
                position: 'right',
              }}
            />
          )}

          <Bar
            dataKey="precipitation"
            fill={COLORS.accent.primary}
            radius={[4, 4, 0, 0]}
            // Dynamic color based on value
            // Note: For individual bar colors, we'd need a custom shape
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
