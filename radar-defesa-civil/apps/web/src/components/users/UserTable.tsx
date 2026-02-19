'use client';

import { type User, ROLE_LABELS, ROLE_COLORS } from '@/types/user';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onToggleActive: (user: User) => void;
  isLoading?: boolean;
}

export function UserTable({ users, onEdit, onToggleActive, isLoading = false }: UserTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-text-secondary">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p>Nenhum usuário encontrado</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-4 text-text-secondary font-medium">Usuário</th>
            <th className="text-left py-3 px-4 text-text-secondary font-medium">Perfil</th>
            <th className="text-left py-3 px-4 text-text-secondary font-medium">Status</th>
            <th className="text-left py-3 px-4 text-text-secondary font-medium">Último Acesso</th>
            <th className="text-right py-3 px-4 text-text-secondary font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border/50 hover:bg-background-elevated/50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-text font-medium">{user.name}</p>
                    <p className="text-text-secondary text-sm">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
                  user.isActive
                    ? 'bg-severity-observation/20 text-severity-observation'
                    : 'bg-text-secondary/20 text-text-secondary'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    user.isActive ? 'bg-severity-observation' : 'bg-text-secondary'
                  }`} />
                  {user.isActive ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td className="py-3 px-4 text-text-secondary text-sm">
                {user.lastLoginAt
                  ? format(new Date(user.lastLoginAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                  : 'Nunca acessou'}
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(user)}
                    className="p-2 text-text-secondary hover:text-accent transition-colors"
                    title="Editar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onToggleActive(user)}
                    className={`p-2 transition-colors ${
                      user.isActive
                        ? 'text-text-secondary hover:text-severity-max_alert'
                        : 'text-text-secondary hover:text-severity-observation'
                    }`}
                    title={user.isActive ? 'Desativar' : 'Ativar'}
                  >
                    {user.isActive ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
