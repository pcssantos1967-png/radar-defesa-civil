'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MunicipalityData {
  municipality_id: string;
  municipality_name: string;
  total_alerts: number;
  critical_alerts: number;
  avg_precipitation_mm: number;
  max_precipitation_mm: number;
}

interface MunicipalityComparisonChartProps {
  data: MunicipalityData[];
  metric?: 'alerts' | 'precipitation';
  limit?: number;
}

export function MunicipalityComparisonChart({
  data,
  metric = 'alerts',
  limit = 10,
}: MunicipalityComparisonChartProps) {
  const chartData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      if (metric === 'alerts') {
        return b.total_alerts - a.total_alerts;
      }
      return b.max_precipitation_mm - a.max_precipitation_mm;
    });

    return sorted.slice(0, limit).map((item) => ({
      ...item,
      name: item.municipality_name.length > 15
        ? item.municipality_name.substring(0, 15) + '...'
        : item.municipality_name,
      fullName: item.municipality_name,
    }));
  }, [data, metric, limit]);

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: MunicipalityData & { fullName: string } }>;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const item = payload[0].payload;
    return (
      <div className="bg-background-elevated border border-border rounded-lg p-3 shadow-lg">
        <p className="text-text font-medium mb-2">{item.fullName}</p>
        <div className="space-y-1 text-sm">
          <p className="text-text-secondary">
            Total Alertas: <span className="text-text font-medium">{item.total_alerts}</span>
          </p>
          <p className="text-text-secondary">
            Alertas Críticos: <span className="text-severity-max_alert font-medium">{item.critical_alerts}</span>
          </p>
          <p className="text-text-secondary">
            Precip. Média: <span className="text-text font-medium">{item.avg_precipitation_mm.toFixed(1)} mm</span>
          </p>
          <p className="text-text-secondary">
            Precip. Máx: <span className="text-text font-medium">{item.max_precipitation_mm.toFixed(1)} mm</span>
          </p>
        </div>
      </div>
    );
  };

  if (metric === 'alerts') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 10, left: 80, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
          <XAxis
            type="number"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          <Bar
            dataKey="total_alerts"
            name="Total"
            fill="#00B8D4"
            radius={[0, 4, 4, 0]}
            stackId="alerts"
          />
          <Bar
            dataKey="critical_alerts"
            name="Críticos"
            fill="#FF1744"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 10, left: 80, bottom: 0 }}
      >
        <defs>
          <linearGradient id="precipBarGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00B8D4" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity={1} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" horizontal={false} />
        <XAxis
          type="number"
          stroke="#64748B"
          fontSize={11}
          tickLine={false}
          label={{
            value: 'mm',
            position: 'bottom',
            style: { fill: '#64748B', fontSize: 11 },
          }}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#64748B"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={75}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />

        <Bar
          dataKey="avg_precipitation_mm"
          name="Média"
          fill="url(#precipBarGradient)"
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="max_precipitation_mm"
          name="Máximo"
          fill="#FF9800"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
