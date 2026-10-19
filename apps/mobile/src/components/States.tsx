// Shared loading, empty and error states. ErrorState always offers a retry button.
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, useTheme } from '../theme';
import { Button } from './Button';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={[styles.body, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {body ? <Text style={[styles.body, { color: colors.muted }]}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Text style={[styles.title, { color: colors.danger }]}>Something went wrong</Text>
      <Text style={[styles.body, { color: colors.text }]}>{message}</Text>
      <Button label="Try again" onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, textAlign: 'center' },
});
