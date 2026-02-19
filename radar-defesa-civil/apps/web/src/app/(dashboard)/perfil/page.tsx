'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/services/api';
import { ROLE_LABELS, type UserRole } from '@/types/user';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  consortiumId?: string;
  phone?: string;
  avatarUrl?: string;
  notificationPreferences?: {
    email?: boolean;
    sms?: boolean;
    whatsapp?: boolean;
    severityFilter?: string[];
  };
  lastLoginAt?: string;
}

export default function PerfilPage() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get<{ success: boolean; data: { user: UserProfile } }>('/auth/me');
        setProfile(response.data.user);
        setFormData({
          name: response.data.user.name,
          phone: response.data.user.phone || '',
        });
      } catch (err) {
        setError('Erro ao carregar perfil');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.put<{ success: boolean; data: { user: UserProfile } }>('/auth/me', {
        name: formData.name,
        phone: formData.phone || undefined,
      });

      setProfile(response.data.user);
      setSuccess('Perfil atualizado com sucesso');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-text-secondary">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Meu Perfil</h1>
        <p className="text-text-secondary mt-1">
          Visualize e edite suas informações pessoais
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-background-secondary border border-border rounded-lg p-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center text-accent text-3xl font-bold">
              {profile?.name.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-text">{profile?.name}</h2>
            <p className="text-text-secondary">{profile?.email}</p>

            <div className="flex items-center gap-4 mt-3">
              <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-accent/20 text-accent">
                {ROLE_LABELS[profile?.role || 'viewer']}
              </span>

              {profile?.lastLoginAt && (
                <span className="text-sm text-text-secondary">
                  Último acesso: {format(new Date(profile.lastLoginAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-severity-observation/10 border border-severity-observation/30 rounded-lg">
          <p className="text-severity-observation">{success}</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-severity-max_alert/10 border border-severity-max_alert/30 rounded-lg">
          <p className="text-severity-max_alert">{error}</p>
        </div>
      )}

      {/* Edit Form */}
      <div className="bg-background-secondary border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-text mb-4">Informações Pessoais</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Nome
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-3 py-2 bg-background-elevated border border-border rounded-lg text-text-secondary cursor-not-allowed"
              />
              <p className="text-xs text-text-muted mt-1">
                O email não pode ser alterado
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Perfil
              </label>
              <input
                type="text"
                value={ROLE_LABELS[profile?.role || 'viewer']}
                disabled
                className="w-full px-3 py-2 bg-background-elevated border border-border rounded-lg text-text-secondary cursor-not-allowed"
              />
              <p className="text-xs text-text-muted mt-1">
                Entre em contato com um administrador para alterar
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/configuracoes"
          className="bg-background-secondary border border-border rounded-lg p-4 hover:border-accent transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-text">Configurações</p>
              <p className="text-sm text-text-secondary">Alterar senha e preferências</p>
            </div>
          </div>
        </a>

        <a
          href="/alertas"
          className="bg-background-secondary border border-border rounded-lg p-4 hover:border-accent transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-severity-alert/20 flex items-center justify-center text-severity-alert">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-text">Meus Alertas</p>
              <p className="text-sm text-text-secondary">Ver alertas atribuídos a você</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
