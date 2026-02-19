export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer' | 'api_user';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  consortiumId?: string;
  consortiumName?: string;
  municipalityIds?: string[];
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  emailVerifiedAt?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  consortiumId?: string;
  municipalityIds?: string[];
  phone?: string;
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  role?: UserRole;
  consortiumId?: string;
  municipalityIds?: string[];
  phone?: string;
  avatarUrl?: string;
}

export interface UsersResponse {
  success: boolean;
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserResponse {
  success: boolean;
  data: {
    user: User;
  };
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
  viewer: 'Visualizador',
  api_user: 'Usuário API',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-severity-max_alert/20 text-severity-max_alert',
  manager: 'bg-severity-alert/20 text-severity-alert',
  operator: 'bg-severity-attention/20 text-severity-attention',
  viewer: 'bg-accent/20 text-accent',
  api_user: 'bg-text-secondary/20 text-text-secondary',
};
