import { clsx } from 'clsx';

interface RadarLogoProps {
  className?: string;
}

export function RadarLogo({ className }: RadarLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={clsx('text-accent', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer ring */}
      <circle
        cx="50"
        cy="50"
        r="45"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="8 4"
        className="opacity-30"
      />

      {/* Middle rings */}
      <circle
        cx="50"
        cy="50"
        r="35"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-50"
      />
      <circle
        cx="50"
        cy="50"
        r="25"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-50"
      />
      <circle
        cx="50"
        cy="50"
        r="15"
        stroke="currentColor"
        strokeWidth="1.5"
        className="opacity-50"
      />

      {/* Center dot */}
      <circle cx="50" cy="50" r="4" fill="currentColor" />

      {/* Radar sweep */}
      <path
        d="M50 50 L50 5 A45 45 0 0 1 92.68 72.5 Z"
        fill="currentColor"
        className="opacity-20 origin-center animate-radar-sweep"
      />

      {/* Cross hairs */}
      <line
        x1="50"
        y1="5"
        x2="50"
        y2="95"
        stroke="currentColor"
        strokeWidth="0.5"
        className="opacity-30"
      />
      <line
        x1="5"
        y1="50"
        x2="95"
        y2="50"
        stroke="currentColor"
        strokeWidth="0.5"
        className="opacity-30"
      />

      {/* Detected points */}
      <circle cx="65" cy="35" r="3" fill="#FF4444" className="animate-pulse" />
      <circle cx="30" cy="60" r="2" fill="#FFD600" />
      <circle cx="75" cy="65" r="2.5" fill="#FF9800" />
    </svg>
  );
}
