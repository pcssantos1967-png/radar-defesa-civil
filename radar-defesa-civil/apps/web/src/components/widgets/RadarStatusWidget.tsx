'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/contexts/websocket-context';
import { api } from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Radio, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RadarStatus {
  id: string;
  code: string;
  name: string;
  status: string;
  lastScanAt: string | null;
}

export function RadarStatusWidget() {
  const { socket } = useWebSocket();
  const [radars, setRadars] = useState<RadarStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRadars();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleRadarStatus = (data: RadarStatus) => {
      setRadars((prev) =>
        prev.map((r) => (r.id === data.id ? { ...r, ...data } : r))
      );
    };

    socket.on('radar:status', handleRadarStatus);

    return () => {
      socket.off('radar:status', handleRadarStatus);
    };
  }, [socket]);

  const loadRadars = async () => {
    try {
      const response = await api.get<{ data: { radars: RadarStatus[] } }>('/radar/sites');
      setRadars(response.data.radars);
    } catch (error) {
      console.error('Failed to load radars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="w-4 h-4 text-accent-success" />;
      case 'maintenance':
        return <Clock className="w-4 h-4 text-accent-warning" />;
      default:
        return <AlertCircle className="w-4 h-4 text-accent-error" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'operational':
        return 'Operacional';
      case 'maintenance':
        return 'Manutenção';
      default:
        return 'Offline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-background-tertiary rounded w-1/2" />
            <div className="h-12 bg-background-tertiary rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className="w-4 h-4 text-accent" />
          Status dos Radares
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {radars.map((radar) => (
            <div
              key={radar.id}
              className="flex items-center justify-between p-2 rounded bg-background-tertiary"
            >
              <div className="flex items-center gap-2">
                {getStatusIcon(radar.status)}
                <div>
                  <div className="text-sm font-medium text-text">{radar.code}</div>
                  <div className="text-xs text-text-muted">{radar.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-text-secondary">
                  {getStatusLabel(radar.status)}
                </div>
                {radar.lastScanAt && (
                  <div className="text-xs text-text-muted">
                    {formatDistanceToNow(new Date(radar.lastScanAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {radars.length === 0 && (
            <div className="text-center py-4 text-text-secondary text-sm">
              Nenhum radar configurado
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
