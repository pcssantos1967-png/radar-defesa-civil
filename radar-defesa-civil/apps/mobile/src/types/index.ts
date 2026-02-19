export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer' | 'api_user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  consortiumId?: string;
  phone?: string;
  avatarUrl?: string;
}

export type AlertSeverity = 'observation' | 'attention' | 'alert' | 'max_alert';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'expired';

export interface Alert {
  id: string;
  type: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description?: string;
  municipalityId: string;
  municipalityName: string;
  latitude?: number;
  longitude?: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  expiresAt?: string;
}

export interface Municipality {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  population?: number;
}

export interface RadarStation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'online' | 'offline' | 'maintenance';
  lastUpdate?: string;
}

export const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  observation: 'Observação',
  attention: 'Atenção',
  alert: 'Alerta',
  max_alert: 'Alerta Máximo',
};

export const STATUS_LABELS: Record<AlertStatus, string> = {
  active: 'Ativo',
  acknowledged: 'Reconhecido',
  resolved: 'Resolvido',
  expired: 'Expirado',
};
