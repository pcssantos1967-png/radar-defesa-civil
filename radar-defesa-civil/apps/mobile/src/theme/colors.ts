export const colors = {
  // Background
  background: '#0F172A',
  backgroundSecondary: '#1E293B',
  backgroundElevated: '#334155',

  // Text
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Accent
  accent: '#00E5FF',
  accentHover: '#00B8D4',

  // Severity
  severity: {
    observation: '#4CAF50',
    attention: '#FFD600',
    alert: '#FF9800',
    maxAlert: '#FF1744',
  },

  // Border
  border: '#334155',
  borderHover: '#475569',

  // Status
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#FF1744',
  info: '#00E5FF',

  // Common
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const severityColors: Record<string, string> = {
  observation: colors.severity.observation,
  attention: colors.severity.attention,
  alert: colors.severity.alert,
  max_alert: colors.severity.maxAlert,
};
