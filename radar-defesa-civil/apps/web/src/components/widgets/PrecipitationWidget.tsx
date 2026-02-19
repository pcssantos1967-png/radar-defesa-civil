'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { CloudRain, Droplets } from 'lucide-react';

export function PrecipitationWidget() {
  // This would typically fetch real data
  const precipitationData = {
    last1h: 0,
    last3h: 0,
    last6h: 0,
    last24h: 0,
  };

  const formatPrecipitation = (value: number) => {
    return value.toFixed(1);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CloudRain className="w-4 h-4 text-accent" />
          Precipitação Acumulada
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background-tertiary rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
              <Droplets className="w-3 h-3" />
              <span className="text-xs">1h</span>
            </div>
            <div className="text-lg font-bold text-text">
              {formatPrecipitation(precipitationData.last1h)}
              <span className="text-xs font-normal text-text-muted ml-1">mm</span>
            </div>
          </div>

          <div className="bg-background-tertiary rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
              <Droplets className="w-3 h-3" />
              <span className="text-xs">3h</span>
            </div>
            <div className="text-lg font-bold text-text">
              {formatPrecipitation(precipitationData.last3h)}
              <span className="text-xs font-normal text-text-muted ml-1">mm</span>
            </div>
          </div>

          <div className="bg-background-tertiary rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
              <Droplets className="w-3 h-3" />
              <span className="text-xs">6h</span>
            </div>
            <div className="text-lg font-bold text-text">
              {formatPrecipitation(precipitationData.last6h)}
              <span className="text-xs font-normal text-text-muted ml-1">mm</span>
            </div>
          </div>

          <div className="bg-background-tertiary rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-text-secondary mb-1">
              <Droplets className="w-3 h-3" />
              <span className="text-xs">24h</span>
            </div>
            <div className="text-lg font-bold text-text">
              {formatPrecipitation(precipitationData.last24h)}
              <span className="text-xs font-normal text-text-muted ml-1">mm</span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs text-text-muted text-center">
            Dados estimados por radar - Última atualização: agora
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
