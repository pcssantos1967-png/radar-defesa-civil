'use client';

import { useState } from 'react';
import { type UserRole, type User, type CreateUserInput, type UpdateUserInput, ROLE_LABELS } from '@/types/user';

interface UserFormProps {
  user?: User;
  onSubmit: (data: CreateUserInput | UpdateUserInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UserForm({ user, onSubmit, onCancel, isLoading = false }: UserFormProps) {
  const isEditing = !!user;

  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    confirmPassword: '',
    name: user?.name || '',
    role: user?.role || 'viewer' as UserRole,
    phone: user?.phone || '',
    consortiumId: user?.consortiumId || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!isEditing && !formData.password) {
      newErrors.password = 'Senha é obrigatória';
    } else if (formData.password && formData.password.length < 8) {
      newErrors.password = 'Senha deve ter no mínimo 8 caracteres';
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Senhas não conferem';
    }

    if (!formData.name) {
      newErrors.name = 'Nome é obrigatório';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Nome deve ter no mínimo 2 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const data: CreateUserInput | UpdateUserInput = isEditing
      ? {
          email: formData.email,
          name: formData.name,
          role: formData.role,
          phone: formData.phone || undefined,
          consortiumId: formData.consortiumId || undefined,
        }
      : {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: formData.role,
          phone: formData.phone || undefined,
          consortiumId: formData.consortiumId || undefined,
        };

    await onSubmit(data);
  };

  const roles: UserRole[] = ['admin', 'manager', 'operator', 'viewer', 'api_user'];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Nome *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`w-full px-3 py-2 bg-background border rounded-lg text-text focus:outline-none focus:border-accent ${
            errors.name ? 'border-severity-max_alert' : 'border-border'
          }`}
          placeholder="Nome completo"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-severity-max_alert">{errors.name}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Email *
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className={`w-full px-3 py-2 bg-background border rounded-lg text-text focus:outline-none focus:border-accent ${
            errors.email ? 'border-severity-max_alert' : 'border-border'
          }`}
          placeholder="email@exemplo.com"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-severity-max_alert">{errors.email}</p>
        )}
      </div>

      {/* Password fields - only for new users or when changing password */}
      {!isEditing && (
        <>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Senha *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={`w-full px-3 py-2 bg-background border rounded-lg text-text focus:outline-none focus:border-accent ${
                errors.password ? 'border-severity-max_alert' : 'border-border'
              }`}
              placeholder="Mínimo 8 caracteres"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-severity-max_alert">{errors.password}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Confirmar Senha *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className={`w-full px-3 py-2 bg-background border rounded-lg text-text focus:outline-none focus:border-accent ${
                errors.confirmPassword ? 'border-severity-max_alert' : 'border-border'
              }`}
              placeholder="Repita a senha"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-severity-max_alert">{errors.confirmPassword}</p>
            )}
          </div>
        </>
      )}

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Perfil *
        </label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Telefone
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
          placeholder="(00) 00000-0000"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-text-secondary hover:text-text transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isEditing ? 'Salvar Alterações' : 'Criar Usuário'}
        </button>
      </div>
    </form>
  );
}
