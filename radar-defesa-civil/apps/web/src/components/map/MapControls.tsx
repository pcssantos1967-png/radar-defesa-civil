'use client';

import { useState } from 'react';
import type { Map } from 'maplibre-gl';
import { Button } from '@/components/ui/Button';
import { Plus, Minus, Maximize, Layers, Home } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface MapControlsProps {
  map: Map | null;
}

const layers = [
  { id: 'radar', label: 'Refletividade Radar', enabled: true },
  { id: 'precipitation', label: 'Precipitação', enabled: false },
  { id: 'lightning', label: 'Raios', enabled: false },
  { id: 'municipalities', label: 'Municípios', enabled: true },
  { id: 'risk-areas', label: 'Áreas de Risco', enabled: false },
  { id: 'stations', label: 'Estações', enabled: false },
];

export function MapControls({ map }: MapControlsProps) {
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>(
    Object.fromEntries(layers.map((l) => [l.id, l.enabled]))
  );

  const handleZoomIn = () => {
    map?.zoomIn();
  };

  const handleZoomOut = () => {
    map?.zoomOut();
  };

  const handleResetView = () => {
    map?.flyTo({
      center: [-45.8869, -23.1896],
      zoom: 8,
    });
  };

  const handleFullscreen = () => {
    const container = map?.getContainer();
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  };

  const toggleLayer = (layerId: string) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerId]: !prev[layerId],
    }));
    // Here you would actually toggle the layer visibility on the map
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Zoom controls */}
      <div className="bg-background-elevated border border-border rounded-lg overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-none border-b border-border"
          onClick={handleZoomIn}
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-none"
          onClick={handleZoomOut}
        >
          <Minus className="w-4 h-4" />
        </Button>
      </div>

      {/* Other controls */}
      <div className="bg-background-elevated border border-border rounded-lg overflow-hidden">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-none border-b border-border"
          onClick={handleResetView}
          title="Voltar ao início"
        >
          <Home className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="rounded-none border-b border-border"
          onClick={handleFullscreen}
          title="Tela cheia"
        >
          <Maximize className="w-4 h-4" />
        </Button>

        {/* Layers dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="ghost" size="sm" className="rounded-none" title="Camadas">
              <Layers className="w-4 h-4" />
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="bg-background-elevated border border-border rounded-lg p-2 shadow-lg min-w-[200px] z-50"
              sideOffset={5}
              align="end"
            >
              <div className="text-xs font-medium text-text-secondary px-2 pb-2 border-b border-border mb-2">
                Camadas do Mapa
              </div>
              {layers.map((layer) => (
                <DropdownMenu.CheckboxItem
                  key={layer.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm text-text rounded cursor-pointer hover:bg-background-tertiary outline-none"
                  checked={activeLayers[layer.id]}
                  onCheckedChange={() => toggleLayer(layer.id)}
                >
                  <div
                    className={`w-4 h-4 rounded border ${
                      activeLayers[layer.id]
                        ? 'bg-accent border-accent'
                        : 'border-border'
                    } flex items-center justify-center`}
                  >
                    {activeLayers[layer.id] && (
                      <svg
                        className="w-3 h-3 text-background"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  {layer.label}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
