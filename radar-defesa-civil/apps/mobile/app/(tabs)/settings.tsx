import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/services/api';
import { Card } from '../../src/components/ui';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import { ROLE_LABELS, type UserRole } from '../../src/types';

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
  severityFilter: string[];
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: colors.severity.maxAlert,
  manager: colors.severity.alert,
  operator: colors.severity.attention,
  viewer: colors.accent,
  api_user: colors.textSecondary,
};

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email: true,
    sms: false,
    whatsapp: false,
    push: true,
    severityFilter: ['attention', 'alert', 'max_alert'],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
    checkNotificationPermissions();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { user: { notificationPreferences?: NotificationPreferences } };
      }>('/auth/me');

      if (response.data.user.notificationPreferences) {
        setNotifications({
          ...notifications,
          ...response.data.user.notificationPreferences,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      setNotifications((prev) => ({ ...prev, push: false }));
    }
  };

  const togglePushNotifications = async (enabled: boolean) => {
    if (enabled) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Habilite as notificações nas configurações do dispositivo.'
        );
        return;
      }
    }
    setNotifications((prev) => ({ ...prev, push: enabled }));
    savePreferences({ ...notifications, push: enabled });
  };

  const toggleSeverity = (severity: string) => {
    const newFilter = notifications.severityFilter.includes(severity)
      ? notifications.severityFilter.filter((s) => s !== severity)
      : [...notifications.severityFilter, severity];

    setNotifications((prev) => ({ ...prev, severityFilter: newFilter }));
    savePreferences({ ...notifications, severityFilter: newFilter });
  };

  const savePreferences = async (prefs: NotificationPreferences) => {
    setSaving(true);
    try {
      await api.put('/auth/me', { notificationPreferences: prefs });
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const severityOptions = [
    { key: 'max_alert', label: 'Alerta Máximo', color: colors.severity.maxAlert },
    { key: 'alert', label: 'Alerta', color: colors.severity.alert },
    { key: 'attention', label: 'Atenção', color: colors.severity.attention },
    { key: 'observation', label: 'Observação', color: colors.severity.observation },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      <Card style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View
              style={[
                styles.roleBadge,
                { backgroundColor: ROLE_COLORS[user?.role as UserRole] + '20' },
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  { color: ROLE_COLORS[user?.role as UserRole] },
                ]}
              >
                {ROLE_LABELS[user?.role as UserRole]}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Notification Settings */}
      <Text style={styles.sectionTitle}>Notificações</Text>
      <Card style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Notificações Push</Text>
            <Text style={styles.settingDescription}>
              Receba alertas em tempo real
            </Text>
          </View>
          <Switch
            value={notifications.push}
            onValueChange={togglePushNotifications}
            trackColor={{ false: colors.border, true: colors.accent + '50' }}
            thumbColor={notifications.push ? colors.accent : colors.textMuted}
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.settingLabel}>Filtrar por Severidade</Text>
        <Text style={styles.settingDescription}>
          Escolha quais alertas deseja receber
        </Text>
        <View style={styles.severityFilters}>
          {severityOptions.map((option) => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.severityButton,
                notifications.severityFilter.includes(option.key) &&
                  styles.severityButtonActive,
                { borderColor: option.color },
              ]}
              onPress={() => toggleSeverity(option.key)}
            >
              <View style={[styles.severityDot, { backgroundColor: option.color }]} />
              <Text
                style={[
                  styles.severityText,
                  notifications.severityFilter.includes(option.key) &&
                    styles.severityTextActive,
                ]}
              >
                {option.label}
              </Text>
              {notifications.severityFilter.includes(option.key) && (
                <Ionicons name="checkmark" size={16} color={colors.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* App Info */}
      <Text style={styles.sectionTitle}>Sobre</Text>
      <Card style={styles.settingsCard}>
        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.menuItemText}>Versão do App</Text>
          </View>
          <Text style={styles.menuItemValue}>1.0.0</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="document-text-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.menuItemText}>Termos de Uso</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.textSecondary} />
            <Text style={styles.menuItemText}>Política de Privacidade</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </Card>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color={colors.error} />
        <Text style={styles.logoutText}>Sair da Conta</Text>
      </TouchableOpacity>

      <Text style={styles.footerText}>
        Radar Defesa Civil v1.0.0{'\n'}
        Sistema de Monitoramento Meteorológico
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.accent,
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text,
  },
  profileEmail: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  roleText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  settingsCard: {
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
  },
  settingDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  severityFilters: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  severityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  severityButtonActive: {
    backgroundColor: colors.accent + '10',
    borderColor: colors.accent,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  severityText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  severityTextActive: {
    color: colors.text,
    fontWeight: '500',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  menuItemText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  menuItemValue: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error + '30',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.error,
  },
  footerText: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xl,
    lineHeight: 20,
  },
});
