import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, severityColors, spacing, borderRadius, fontSize } from '../../theme';
import { type AlertSeverity, SEVERITY_LABELS } from '../../types';

interface SeverityBadgeProps {
  severity: AlertSeverity;
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, size = 'md' }: SeverityBadgeProps) {
  const color = severityColors[severity];

  return (
    <View style={[styles.badge, styles[size], { backgroundColor: color + '20' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, styles[`text_${size}`], { color }]}>
        {SEVERITY_LABELS[severity]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  sm: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  md: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  text: {
    fontWeight: '600',
  },
  text_sm: {
    fontSize: fontSize.xs,
  },
  text_md: {
    fontSize: fontSize.sm,
  },
});
