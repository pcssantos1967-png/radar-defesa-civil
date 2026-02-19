'use client';

import { COLORS } from '@/constants/colors';

export function RadarColorScale() {
  return (
    <div className="bg-background-elevated/90 border border-border rounded-lg p-3">
      <div className="text-xs text-text-secondary mb-2 font-medium">
        Refletividade (dBZ)
      </div>
      <div className="flex flex-col-reverse gap-0.5">
        {COLORS.radarScale.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-6 h-3 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-text-secondary font-mono w-12">
              {item.value}+
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-border text-xs text-text-muted">
        <div className="flex justify-between">
          <span>Fraca</span>
          <span>Moderada</span>
          <span>Forte</span>
        </div>
      </div>
    </div>
  );
}
