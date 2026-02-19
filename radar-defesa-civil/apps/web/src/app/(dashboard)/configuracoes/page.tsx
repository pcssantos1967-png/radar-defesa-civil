'use client';

import { useState, useEffect } from 'react';
import { api } from '@/services/api';

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  severityFilter: string[];
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  notificationPreferences?: NotificationPreferences;
}

const SEVERITY_OPTIONS = [
  { value: 'observation', label: 'Observação', color: 'bg-severity-observation' },
  { value: 'attention', label: 'Atenção', color: 'bg-severity-attention' },
  { value: 'alert', label: 'Alerta', color: 'bg-severity-alert' },
  { value: 'max_alert', label: 'Alerta Máximo', color: 'bg-severity-max_alert' },
];

export default function ConfiguracoesPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification preferences
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email: true,
    sms: false,
    whatsapp: false,
    severityFilter: ['attention', 'alert', 'max_alert'],
  });
  const [notificationsSaving, setNotificationsSaving] = useState(false);
  const [notificationsSuccess, setNotificationsSuccess] = useState<string | null>(null);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get<{ success: boolean; data: { user: UserProfile } }>('/auth/me');
        setProfile(response.data.user);

        if (response.data.user.notificationPreferences) {
          setNotifications({
            email: response.data.user.notificationPreferences.email ?? true,
            sms: response.data.user.notificationPreferences.sms ?? false,
            whatsapp: response.data.user.notificationPreferences.whatsapp ?? false,
            severityFilter: response.data.user.notificationPreferences.severityFilter ?? ['attention', 'alert', 'max_alert'],
          });
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const validatePassword = () => {
    const errors: Record<string, string> = {};

    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Senha atual é obrigatória';
    }

    if (!passwordForm.newPassword) {
      errors.newPassword = 'Nova senha é obrigatória';
    } else if (passwordForm.newPassword.length < 8) {
      errors.newPassword = 'Senha deve ter no mínimo 8 caracteres';
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Senhas não conferem';
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!validatePassword()) return;

    setPasswordSaving(true);

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordSuccess('Senha alterada com sucesso');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });

      setTimeout(() => setPasswordSuccess(null), 3000);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Erro ao alterar senha');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNotificationsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotificationsError(null);
    setNotificationsSuccess(null);
    setNotificationsSaving(true);

    try {
      await api.put('/auth/me', {
        notificationPreferences: notifications,
      });

      setNotificationsSuccess('Preferências salvas com sucesso');
      setTimeout(() => setNotificationsSuccess(null), 3000);
    } catch (err) {
      setNotificationsError(err instanceof Error ? err.message : 'Erro ao salvar preferências');
    } finally {
      setNotificationsSaving(false);
    }
  };

  const toggleSeverity = (severity: string) => {
    setNotifications((prev) => ({
      ...prev,
      severityFilter: prev.severityFilter.includes(severity)
        ? prev.severityFilter.filter((s) => s !== severity)
        : [...prev.severityFilter, severity],
    }));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-text-secondary">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Configurações</h1>
        <p className="text-text-secondary mt-1">
          Gerencie sua conta e preferências de notificação
        </p>
      </div>

      {/* Password Change */}
      <div className="bg-background-secondary border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-text mb-4">Alterar Senha</h3>

        {passwordSuccess && (
          <div className="mb-4 p-4 bg-severity-observation/10 border border-severity-observation/30 rounded-lg">
            <p className="text-severity-observation">{passwordSuccess}</p>
          </div>
        )}

        {passwordError && (
          <div className="mb-4 p-4 bg-severity-max_alert/10 border border-severity-max_alert/30 rounded-lg">
            <p className="text-severity-max_alert">{passwordError}</p>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              Senha Atual
            </label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className={`w-full px-3 py-2 bg-background border rounded-lg text-text focus:outline-none focus:border-accent ${
                passwordErrors.currentPassword ? 'border-severity-max_alert' : 'border-border'
              }`}
              placeholder="Digite sua senha atual"
            />
            {passwordErrors.currentPassword && (
              <p className="mt-1 text-sm text-severity-max_alert">{passwordErrors.currentPassword}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Nova Senha
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className={`w-full px-3 py-2 bg-background border rounded-lg text-text focus:outline-none focus:border-accent ${
                  passwordErrors.newPassword ? 'border-severity-max_alert' : 'border-border'
                }`}
                placeholder="Mínimo 8 caracteres"
              />
              {passwordErrors.newPassword && (
                <p className="mt-1 text-sm text-severity-max_alert">{passwordErrors.newPassword}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className={`w-full px-3 py-2 bg-background border rounded-lg text-text focus:outline-none focus:border-accent ${
                  passwordErrors.confirmPassword ? 'border-severity-max_alert' : 'border-border'
                }`}
                placeholder="Repita a nova senha"
              />
              {passwordErrors.confirmPassword && (
                <p className="mt-1 text-sm text-severity-max_alert">{passwordErrors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {passwordSaving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Alterar Senha
            </button>
          </div>
        </form>
      </div>

      {/* Notification Preferences */}
      <div className="bg-background-secondary border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-text mb-4">Preferências de Notificação</h3>

        {notificationsSuccess && (
          <div className="mb-4 p-4 bg-severity-observation/10 border border-severity-observation/30 rounded-lg">
            <p className="text-severity-observation">{notificationsSuccess}</p>
          </div>
        )}

        {notificationsError && (
          <div className="mb-4 p-4 bg-severity-max_alert/10 border border-severity-max_alert/30 rounded-lg">
            <p className="text-severity-max_alert">{notificationsError}</p>
          </div>
        )}

        <form onSubmit={handleNotificationsSubmit} className="space-y-6">
          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Canais de Notificação
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.email}
                  onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                  className="w-5 h-5 rounded border-border bg-background text-accent focus:ring-accent focus:ring-offset-0"
                />
                <div>
                  <span className="text-text">Email</span>
                  <p className="text-sm text-text-secondary">Receber notificações por email</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.sms}
                  onChange={(e) => setNotifications({ ...notifications, sms: e.target.checked })}
                  className="w-5 h-5 rounded border-border bg-background text-accent focus:ring-accent focus:ring-offset-0"
                />
                <div>
                  <span className="text-text">SMS</span>
                  <p className="text-sm text-text-secondary">Receber notificações por SMS</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifications.whatsapp}
                  onChange={(e) => setNotifications({ ...notifications, whatsapp: e.target.checked })}
                  className="w-5 h-5 rounded border-border bg-background text-accent focus:ring-accent focus:ring-offset-0"
                />
                <div>
                  <span className="text-text">WhatsApp</span>
                  <p className="text-sm text-text-secondary">Receber notificações por WhatsApp</p>
                </div>
              </label>
            </div>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-3">
              Filtro de Severidade
            </label>
            <p className="text-sm text-text-muted mb-3">
              Selecione os níveis de alerta que deseja receber notificações
            </p>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleSeverity(option.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                    notifications.severityFilter.includes(option.value)
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-background hover:border-border-hover'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full ${option.color}`} />
                  <span className={notifications.severityFilter.includes(option.value) ? 'text-text' : 'text-text-secondary'}>
                    {option.label}
                  </span>
                  {notifications.severityFilter.includes(option.value) && (
                    <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              disabled={notificationsSaving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {notificationsSaving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Salvar Preferências
            </button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-background-secondary border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-text mb-4">Informações da Conta</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-secondary">Email:</span>
            <span className="ml-2 text-text">{profile?.email}</span>
          </div>
          <div>
            <span className="text-text-secondary">Nome:</span>
            <span className="ml-2 text-text">{profile?.name}</span>
          </div>
          {profile?.phone && (
            <div>
              <span className="text-text-secondary">Telefone:</span>
              <span className="ml-2 text-text">{profile.phone}</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <a
            href="/perfil"
            className="text-accent hover:text-accent-hover transition-colors text-sm"
          >
            Editar informações do perfil →
          </a>
        </div>
      </div>
    </div>
  );
}
