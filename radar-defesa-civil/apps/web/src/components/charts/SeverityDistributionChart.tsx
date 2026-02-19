'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

interface SeverityData {
  severity: 'observation' | 'attention' | 'alert' | 'max_alert';
  count: number;
  percentage: number;
}

interface SeverityDistributionChartProps {
  data: SeverityData[];
  showPercentage?: boolean;
}

const SEVERITY_CONFIG = {
  observation: { color: '#4CAF50', label: 'Observação' },
  attention: { color: '#FFD600', label: 'Atenção' },
  alert: { color: '#FF9800', label: 'Alerta' },
  max_alert: { color: '#FF1744', label: 'Alerta Máximo' },
};

export function SeverityDistributionChart({
  data,
  showPercentage = true,
}: SeverityDistributionChartProps) {
  const chartData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      name: SEVERITY_CONFIG[item.severity].label,
      color: SEVERITY_CONFIG[item.severity].color,
    }));
  }, [data]);

  const total = useMemo(() => {
    return data.reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  const CustomTooltip = ({ active, payload }: {
    active?: boolean;
    payload?: Array<{ payload: SeverityData & { name: string; color: string } }>;
  }) => {
    if (!active || !payload || !payload.length) return null;

    const item = payload[0].payload;
    return (
      <div className="bg-background-elevated border border-border rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-text font-medium">{item.name}</span>
        </div>
        <p className="text-text-secondary text-sm">
          Quantidade: <span className="text-text font-medium">{item.count}</span>
        </p>
        <p className="text-text-secondary text-sm">
          Percentual: <span className="text-text font-medium">{item.percentage.toFixed(1)}%</span>
        </p>
      </div>
    );
  };

  const renderCustomLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight="bold"
      >
        {showPercentage ? `${(percent * 100).toFixed(0)}%` : ''}
      </text>
    );
  };

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-text-secondary">
        Nenhum dado disponível
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          innerRadius={40}
          dataKey="count"
          strokeWidth={2}
          stroke="#0F172A"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span className="text-text-secondary text-sm">{value}</span>}
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
