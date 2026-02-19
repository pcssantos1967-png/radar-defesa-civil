export const COLORS = {
  // Backgrounds
  bg: {
    primary: '#0B1120',
    secondary: '#111B2E',
    tertiary: '#1A2744',
    elevated: '#1E3050',
  },

  // Borders
  border: {
    default: '#1E3050',
    hover: '#2A4060',
    active: '#00E5FF',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    secondary: '#94A3B8',
    muted: '#64748B',
  },

  // Accent
  accent: {
    primary: '#00E5FF',
    secondary: '#0EA5E9',
    success: '#4CAF50',
    warning: '#FFA726',
    error: '#FF4444',
  },

  // Alert Severities
  severity: {
    observation: '#4CAF50',
    attention: '#FFD600',
    alert: '#FF9800',
    maxAlert: '#FF1744',
  },

  // Radar Scale (dBZ)
  radarScale: [
    { value: 5, color: '#00FFFF', label: '5 dBZ' },
    { value: 10, color: '#00C8FF', label: '10 dBZ' },
    { value: 15, color: '#0096FF', label: '15 dBZ' },
    { value: 20, color: '#00FF00', label: '20 dBZ' },
    { value: 25, color: '#00C800', label: '25 dBZ' },
    { value: 30, color: '#009600', label: '30 dBZ' },
    { value: 35, color: '#FFFF00', label: '35 dBZ' },
    { value: 40, color: '#FFC800', label: '40 dBZ' },
    { value: 45, color: '#FF9600', label: '45 dBZ' },
    { value: 50, color: '#FF0000', label: '50 dBZ' },
    { value: 55, color: '#C80000', label: '55 dBZ' },
    { value: 60, color: '#FF00FF', label: '60 dBZ' },
    { value: 65, color: '#FFFFFF', label: '65+ dBZ' },
  ],
} as const;

export const SEVERITY_LABELS: Record<string, string> = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
};

export const SEVERITY_ORDER: Record<string, number> = {
  max_alert: 4,
  alert: 3,
  attention: 2,
  observation: 1,
};
