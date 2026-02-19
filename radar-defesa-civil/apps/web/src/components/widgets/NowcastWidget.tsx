'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Zap, ArrowRight, Clock } from 'lucide-react';

export function NowcastWidget() {
  // This would typically fetch real data
  const nowcastData = {
    hasRainExpected: false,
    nextRainTime: null as string | null,
    activeCells: 0,
    cellsApproaching: 0,
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="w-4 h-4 text-accent" />
          Previsão 0-2h
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {nowcastData.hasRainExpected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-accent-warning/10 border border-accent-warning/20 rounded-lg">
              <Clock className="w-5 h-5 text-accent-warning" />
              <div>
                <div className="text-sm font-medium text-text">Chuva prevista</div>
                <div className="text-xs text-text-secondary">
                  Próximas 2 horas na região monitorada
                </div>
              </div>
            </div>

            {nowcastData.cellsApproaching > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Células se aproximando</span>
                <span className="text-accent font-medium">
                  {nowcastData.cellsApproaching}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-success/10 text-accent-success rounded-full text-sm">
              <span className="w-2 h-2 bg-accent-success rounded-full" />
              Sem chuva prevista
            </div>
            <div className="text-xs text-text-muted mt-2">
              Para as próximas 2 horas na região
            </div>
          </div>
        )}

        {nowcastData.activeCells > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Células convectivas ativas</span>
              <span className="text-text font-medium">{nowcastData.activeCells}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
