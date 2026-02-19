'use client';

import { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { format, subMinutes, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeSliderProps {
  currentTime: Date;
  onChange: (time: Date) => void;
}

const TIME_STEP_MINUTES = 10;
const MAX_HISTORY_HOURS = 2;

export function TimeSlider({ currentTime, onChange }: TimeSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sliderValue, setSliderValue] = useState(100);

  const now = new Date();
  const minTime = subMinutes(now, MAX_HISTORY_HOURS * 60);
  const totalMinutes = MAX_HISTORY_HOURS * 60;

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setSliderValue((prev) => {
        const next = prev + (TIME_STEP_MINUTES / totalMinutes) * 100;
        if (next >= 100) {
          setIsPlaying(false);
          return 100;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, totalMinutes]);

  useEffect(() => {
    const minutesFromStart = (sliderValue / 100) * totalMinutes;
    const newTime = addMinutes(minTime, minutesFromStart);
    onChange(newTime);
  }, [sliderValue, minTime, totalMinutes, onChange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(e.target.value));
    setIsPlaying(false);
  };

  const handleSkipBack = () => {
    setSliderValue((prev) => Math.max(0, prev - (TIME_STEP_MINUTES / totalMinutes) * 100));
    setIsPlaying(false);
  };

  const handleSkipForward = () => {
    setSliderValue((prev) => Math.min(100, prev + (TIME_STEP_MINUTES / totalMinutes) * 100));
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (sliderValue >= 100) {
      setSliderValue(0);
    }
    setIsPlaying(!isPlaying);
  };

  const isLive = sliderValue >= 99;

  return (
    <div className="bg-background-elevated/95 border border-border rounded-lg p-3">
      <div className="flex items-center gap-3">
        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleSkipBack}>
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant={isPlaying ? 'secondary' : 'primary'}
            size="sm"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSkipForward}>
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        {/* Slider */}
        <div className="flex-1 flex items-center gap-3">
          <span className="text-xs text-text-secondary w-12">
            {format(minTime, 'HH:mm')}
          </span>
          <input
            type="range"
            min="0"
            max="100"
            step="0.5"
            value={sliderValue}
            onChange={handleSliderChange}
            className="flex-1 h-2 rounded-full appearance-none bg-background-tertiary cursor-pointer
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-accent
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:shadow-glow"
          />
          <span className="text-xs text-text-secondary w-12 text-right">
            {format(now, 'HH:mm')}
          </span>
        </div>

        {/* Current time display */}
        <div className="flex items-center gap-2">
          <div className="text-sm font-mono text-text">
            {format(currentTime, "dd/MM HH:mm", { locale: ptBR })}
          </div>
          {isLive && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-accent-error/20 text-accent-error rounded text-xs font-medium">
              <span className="w-1.5 h-1.5 bg-accent-error rounded-full animate-pulse" />
              AO VIVO
            </span>
          )}
        </div>
      </div>

      {/* Time marks */}
      <div className="flex justify-between mt-2 px-20">
        {[0, 30, 60, 90, 120].map((minutes) => (
          <div
            key={minutes}
            className="text-[10px] text-text-muted cursor-pointer hover:text-text"
            onClick={() => setSliderValue((minutes / totalMinutes) * 100)}
          >
            -{MAX_HISTORY_HOURS * 60 - minutes}min
          </div>
        ))}
      </div>
    </div>
  );
}
