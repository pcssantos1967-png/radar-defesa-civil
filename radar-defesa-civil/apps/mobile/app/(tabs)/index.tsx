import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { api } from '../../src/services/api';
import { Card, SeverityBadge } from '../../src/components/ui';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { Alert, AlertSeverity } from '../../src/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertSummary {
  total: number;
  bySeverity: Record<AlertSeverity, number>;
  recent: Alert[];
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const [alertsRes] = await Promise.all([
        api.get<{ success: boolean; data: Alert[] }>('/alerts?status=active&limit=5'),
      ]);

      const alerts = alertsRes.data;
      const bySeverity: Record<AlertSeverity, number> = {
        observation: 0,
        attention: 0,
        alert: 0,
        max_alert: 0,
      };

      alerts.forEach((alert) => {
        bySeverity[alert.severity]++;
      });

      setSummary({
        total: alerts.length,
        bySeverity,
        recent: alerts.slice(0, 5),
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSummary();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{user?.name.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.text} />
          {summary && summary.total > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {summary.total > 9 ? '9+' : summary.total}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Alert Summary Cards */}
      <View style={styles.summaryGrid}>
        <Card style={[styles.summaryCard, { borderLeftColor: colors.severity.maxAlert }]}>
          <Text style={styles.summaryValue}>
            {summary?.bySeverity.max_alert || 0}
          </Text>
          <Text style={styles.summaryLabel}>Alerta Máximo</Text>
        </Card>

        <Card style={[styles.summaryCard, { borderLeftColor: colors.severity.alert }]}>
          <Text style={styles.summaryValue}>
            {summary?.bySeverity.alert || 0}
          </Text>
          <Text style={styles.summaryLabel}>Alerta</Text>
        </Card>

        <Card style={[styles.summaryCard, { borderLeftColor: colors.severity.attention }]}>
          <Text style={styles.summaryValue}>
            {summary?.bySeverity.attention || 0}
          </Text>
          <Text style={styles.summaryLabel}>Atenção</Text>
        </Card>

        <Card style={[styles.summaryCard, { borderLeftColor: colors.severity.observation }]}>
          <Text style={styles.summaryValue}>
            {summary?.bySeverity.observation || 0}
          </Text>
          <Text style={styles.summaryLabel}>Observação</Text>
        </Card>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Acesso Rápido</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/(tabs)/map')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name="map" size={24} color={colors.accent} />
          </View>
          <Text style={styles.quickActionText}>Mapa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.severity.alert + '20' }]}>
            <Ionicons name="warning" size={24} color={colors.severity.alert} />
          </View>
          <Text style={styles.quickActionText}>Alertas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/(tabs)/settings')}
        >
          <View style={[styles.quickActionIcon, { backgroundColor: colors.textSecondary + '20' }]}>
            <Ionicons name="settings" size={24} color={colors.textSecondary} />
          </View>
          <Text style={styles.quickActionText}>Ajustes</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Alerts */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Alertas Recentes</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/alerts')}>
          <Text style={styles.viewAll}>Ver todos</Text>
        </TouchableOpacity>
      </View>

      {summary?.recent && summary.recent.length > 0 ? (
        summary.recent.map((alert) => (
          <Card key={alert.id} style={styles.alertCard}>
            <View style={styles.alertHeader}>
              <SeverityBadge severity={alert.severity} size="sm" />
              <Text style={styles.alertTime}>
                {format(new Date(alert.triggeredAt), 'HH:mm', { locale: ptBR })}
              </Text>
            </View>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertLocation}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />{' '}
              {alert.municipalityName}
            </Text>
          </Card>
        ))
      ) : (
        <Card style={styles.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={styles.emptyText}>Nenhum alerta ativo</Text>
          <Text style={styles.emptySubtext}>
            Você será notificado quando houver novos alertas
          </Text>
        </Card>
      )}
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.severity.maxAlert,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
  },
  summaryValue: {
    fontSize: fontSize.xxxl,
    fontWeight: 'bold',
    color: colors.text,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  quickAction: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  quickActionText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  viewAll: {
    fontSize: fontSize.sm,
    color: colors.accent,
  },
  alertCard: {
    marginBottom: spacing.sm,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  alertTime: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  alertTitle: {
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  alertLocation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
