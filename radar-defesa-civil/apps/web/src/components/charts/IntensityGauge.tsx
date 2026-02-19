'use client';

import { useMemo } from 'react';
import { COLORS } from '@/constants/colors';

interface IntensityGaugeProps {
  value: number;
  maxValue?: number;
  thresholds?: {
    attention: number;
    alert: number;
    maxAlert: number;
  };
  label?: string;
  unit?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function IntensityGauge({
  value,
  maxValue = 100,
  thresholds = { attention: 20, alert: 40, maxAlert: 60 },
  label = 'Intensidade',
  unit = 'mm/h',
  size = 'md',
}: IntensityGaugeProps) {
  const dimensions = {
    sm: { width: 120, height: 80, strokeWidth: 8, fontSize: 14 },
    md: { width: 160, height: 100, strokeWidth: 10, fontSize: 18 },
    lg: { width: 200, height: 120, strokeWidth: 12, fontSize: 24 },
  }[size];

  const { color, severity } = useMemo(() => {
    if (value >= thresholds.maxAlert) {
      return { color: COLORS.severity.maxAlert, severity: 'Alerta Máximo' };
    }
    if (value >= thresholds.alert) {
      return { color: COLORS.severity.alert, severity: 'Alerta' };
    }
    if (value >= thresholds.attention) {
      return { color: COLORS.severity.attention, severity: 'Atenção' };
    }
    return { color: COLORS.accent.success, severity: 'Normal' };
  }, [value, thresholds]);

  const percentage = Math.min((value / maxValue) * 100, 100);
  const radius = (dimensions.width - dimensions.strokeWidth) / 2;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage / 100);

  return (
    <div className="flex flex-col items-center">
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      >
        {/* Background arc */}
        <path
          d={`M ${dimensions.strokeWidth / 2} ${dimensions.height - 5}
              A ${radius} ${radius} 0 0 1 ${dimensions.width - dimensions.strokeWidth / 2} ${dimensions.height - 5}`}
          fill="none"
          stroke={COLORS.bg.tertiary}
          strokeWidth={dimensions.strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        <path
          d={`M ${dimensions.strokeWidth / 2} ${dimensions.height - 5}
              A ${radius} ${radius} 0 0 1 ${dimensions.width - dimensions.strokeWidth / 2} ${dimensions.height - 5}`}
          fill="none"
          stroke={color}
          strokeWidth={dimensions.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease',
          }}
        />

        {/* Threshold markers */}
        {[thresholds.attention, thresholds.alert, thresholds.maxAlert].map((threshold, i) => {
          const thresholdPercentage = (threshold / maxValue) * 100;
          const angle = Math.PI * (1 - thresholdPercentage / 100);
          const x = dimensions.width / 2 + radius * Math.cos(angle);
          const y = dimensions.height - 5 - radius * Math.sin(angle);

          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={2}
              fill={
                i === 0
                  ? COLORS.severity.attention
                  : i === 1
                  ? COLORS.severity.alert
                  : COLORS.severity.maxAlert
              }
            />
          );
        })}

        {/* Value text */}
        <text
          x={dimensions.width / 2}
          y={dimensions.height - 30}
          textAnchor="middle"
          fill={color}
          fontSize={dimensions.fontSize}
          fontWeight="bold"
        >
          {value.toFixed(1)}
        </text>
        <text
          x={dimensions.width / 2}
          y={dimensions.height - 15}
          textAnchor="middle"
          fill={COLORS.text.muted}
          fontSize={dimensions.fontSize * 0.5}
        >
          {unit}
        </text>
      </svg>

      <div className="text-center mt-2">
        <div className="text-sm text-text-secondary">{label}</div>
        <div
          className="text-xs font-medium"
          style={{ color }}
        >
          {severity}
        </div>
      </div>
    </div>
  );
}
