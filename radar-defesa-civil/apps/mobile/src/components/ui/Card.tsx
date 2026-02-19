import React from 'react';
import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme';

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated';
}

export function Card({ variant = 'default', style, children, ...props }: CardProps) {
  return (
    <View style={[styles.card, styles[variant], style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  default: {
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors.backgroundElevated,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
