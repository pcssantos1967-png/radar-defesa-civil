'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';
import { UserTable, UserForm } from '@/components/users';
import { Modal } from '@/components/ui/Modal';
import { type User, type CreateUserInput, type UpdateUserInput, ROLE_LABELS, type UserRole } from '@/types/user';

interface UsersApiResponse {
  success: boolean;
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<{ user: User; action: 'activate' | 'deactivate' } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });

      if (search) params.append('search', search);
      if (roleFilter !== 'all') params.append('role', roleFilter);
      if (statusFilter !== 'all') params.append('isActive', statusFilter === 'active' ? 'true' : 'false');

      const response = await api.get<UsersApiResponse>(`/users?${params}`);
      setUsers(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateUser = () => {
    setEditingUser(undefined);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleToggleActive = (user: User) => {
    setConfirmAction({
      user,
      action: user.isActive ? 'deactivate' : 'activate',
    });
  };

  const handleSubmit = async (data: CreateUserInput | UpdateUserInput) => {
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, data);
      } else {
        await api.post('/users', data);
      }

      setIsModalOpen(false);
      setEditingUser(undefined);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!confirmAction) return;

    setIsSubmitting(true);
    try {
      if (confirmAction.action === 'activate') {
        await api.post(`/users/${confirmAction.user.id}/activate`);
      } else {
        await api.delete(`/users/${confirmAction.user.id}`);
      }

      setConfirmAction(null);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar status do usuário');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin';

  const roles: UserRole[] = ['admin', 'manager', 'operator', 'viewer', 'api_user'];

  return (
    <div className="p-6 space-y-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Usuários</h1>
          <p className="text-text-secondary mt-1">
            Gerencie os usuários do sistema
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleCreateUser}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Novo Usuário
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-background-secondary border border-border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm text-text-secondary mb-2">Buscar</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por nome ou email..."
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Perfil</label>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
            >
              <option value="all">Todos</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
            >
              <option value="all">Todos</option>
              <option value="active">Ativos</option>
              <option value="inactive">Inativos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-severity-max_alert/10 border border-severity-max_alert/30 rounded-lg">
          <p className="text-severity-max_alert">{error}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-background-secondary border border-border rounded-lg">
        <UserTable
          users={users}
          onEdit={handleEditUser}
          onToggleActive={handleToggleActive}
          isLoading={loading}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-text-secondary">
              Mostrando {users.length} de {total} usuários
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm bg-background border border-border rounded-md text-text-secondary hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="text-sm text-text-secondary">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm bg-background border border-border rounded-md text-text-secondary hover:text-text disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(undefined);
        }}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        size="lg"
      >
        <UserForm
          user={editingUser}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingUser(undefined);
          }}
          isLoading={isSubmitting}
        />
      </Modal>

      {/* Confirm Toggle Modal */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.action === 'activate' ? 'Ativar Usuário' : 'Desativar Usuário'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-text-secondary">
            {confirmAction?.action === 'activate'
              ? `Deseja reativar o usuário "${confirmAction?.user.name}"?`
              : `Deseja desativar o usuário "${confirmAction?.user.name}"? O usuário não poderá mais acessar o sistema.`}
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmAction(null)}
              disabled={isSubmitting}
              className="px-4 py-2 text-text-secondary hover:text-text transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirmToggle}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${
                confirmAction?.action === 'activate'
                  ? 'bg-severity-observation hover:bg-severity-observation/80 text-white'
                  : 'bg-severity-max_alert hover:bg-severity-max_alert/80 text-white'
              }`}
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {confirmAction?.action === 'activate' ? 'Ativar' : 'Desativar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
