'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertSummary } from '@/components/widgets/AlertSummary';
import { RadarStatusWidget } from '@/components/widgets/RadarStatusWidget';
import { PrecipitationWidget } from '@/components/widgets/PrecipitationWidget';
import { NowcastWidget } from '@/components/widgets/NowcastWidget';
import { RadarProductSelector } from '@/components/radar/RadarProductSelector';
import { TimeSlider } from '@/components/map/TimeSlider';

// Dynamic import for map to avoid SSR issues
const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-background-secondary flex items-center justify-center">
      <div className="text-text-secondary">Carregando mapa...</div>
    </div>
  ),
});

export default function DashboardPage() {
  const [selectedProduct, setSelectedProduct] = useState('MAX-Z');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex">
      {/* Main map area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 relative">
          <MapContainer
            selectedProduct={selectedProduct}
            currentTime={currentTime}
          />

          {/* Map controls overlay */}
          <div className="absolute top-4 left-4 z-10">
            <RadarProductSelector
              selected={selectedProduct}
              onChange={setSelectedProduct}
            />
          </div>

          {/* Time slider at bottom */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <TimeSlider
              currentTime={currentTime}
              onChange={setCurrentTime}
            />
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-80 bg-background-secondary border-l border-border flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <AlertSummary />
          <RadarStatusWidget />
          <PrecipitationWidget />
          <NowcastWidget />
        </div>
      </div>
    </div>
  );
}
