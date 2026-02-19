import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { Card, SeverityBadge } from '../../src/components/ui';
import { colors, spacing, fontSize, borderRadius } from '../../src/theme';
import type { Alert, AlertSeverity, AlertStatus } from '../../src/types';
import { SEVERITY_LABELS, STATUS_LABELS } from '../../src/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type FilterType = 'all' | AlertSeverity;

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active', limit: '50' });
      if (filter !== 'all') {
        params.append('severity', filter);
      }

      const response = await api.get<{ success: boolean; data: Alert[] }>(
        `/alerts?${params}`
      );
      setAlerts(response.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const filters: { key: FilterType; label: string; color?: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'max_alert', label: 'Máximo', color: colors.severity.maxAlert },
    { key: 'alert', label: 'Alerta', color: colors.severity.alert },
    { key: 'attention', label: 'Atenção', color: colors.severity.attention },
    { key: 'observation', label: 'Observação', color: colors.severity.observation },
  ];

  const renderAlertItem = ({ item }: { item: Alert }) => (
    <TouchableOpacity onPress={() => setSelectedAlert(item)}>
      <Card style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <SeverityBadge severity={item.severity} />
          <Text style={styles.alertTime}>
            {format(new Date(item.triggeredAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </Text>
        </View>

        <Text style={styles.alertTitle}>{item.title}</Text>

        {item.description && (
          <Text style={styles.alertDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.alertFooter}>
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.alertLocation}>{item.municipalityName}</Text>
          </View>
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: item.status === 'active' ? colors.success : colors.textMuted },
              ]}
            />
            <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setFilter(item.key)}
              style={[
                styles.filterButton,
                filter === item.key && styles.filterButtonActive,
              ]}
            >
              {item.color && (
                <View style={[styles.filterDot, { backgroundColor: item.color }]} />
              )}
              <Text
                style={[
                  styles.filterText,
                  filter === item.key && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Alerts List */}
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlertItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.success} />
            <Text style={styles.emptyTitle}>Nenhum alerta encontrado</Text>
            <Text style={styles.emptyText}>
              {filter !== 'all'
                ? `Não há alertas de ${SEVERITY_LABELS[filter as AlertSeverity]} no momento`
                : 'Não há alertas ativos no momento'}
            </Text>
          </View>
        }
      />

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <SeverityBadge severity={selectedAlert.severity} />
              <TouchableOpacity onPress={() => setSelectedAlert(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>{selectedAlert.title}</Text>

            {selectedAlert.description && (
              <Text style={styles.modalDescription}>{selectedAlert.description}</Text>
            )}

            <View style={styles.modalInfo}>
              <View style={styles.modalInfoRow}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.modalInfoText}>{selectedAlert.municipalityName}</Text>
              </View>

              <View style={styles.modalInfoRow}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.modalInfoText}>
                  {format(new Date(selectedAlert.triggeredAt), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR,
                  })}
                </Text>
              </View>

              <View style={styles.modalInfoRow}>
                <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.modalInfoText}>
                  Status: {STATUS_LABELS[selectedAlert.status]}
                </Text>
              </View>

              {selectedAlert.expiresAt && (
                <View style={styles.modalInfoRow}>
                  <Ionicons name="hourglass-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.modalInfoText}>
                    Expira: {format(new Date(selectedAlert.expiresAt), "dd/MM 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  filtersContainer: {
    backgroundColor: colors.backgroundSecondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filtersList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterButtonActive: {
    backgroundColor: colors.accent + '20',
    borderColor: colors.accent,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  filterText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  alertCard: {
    marginBottom: spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  alertTime: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  alertTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  alertDescription: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertLocation: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalDescription: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  modalInfo: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalInfoText: {
    fontSize: fontSize.md,
    color: colors.text,
    marginLeft: spacing.sm,
  },
});
