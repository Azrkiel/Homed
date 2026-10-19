// Alerts: events from saved searches and property watches, newest first. Tap a listing event to open it.
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAlerts } from '../../src/api';
import type { AlertEventDTO } from '../../src/api-types';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/States';
import { useLoad } from '../../src/hooks/useLoad';
import { alertLabel, dateTimeLabel } from '../../src/format';
import { MIN_TAP, radius, spacing, type, useTheme } from '../../src/theme';

export default function AlertsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, error, loading, reload } = useLoad(() => getAlerts());

  if (data === null) {
    if (error) return <ErrorState message={error} onRetry={reload} />;
    return <LoadingState label="Loading alerts" />;
  }

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      ListHeaderComponent={error ? <ErrorState message={error} onRetry={reload} /> : undefined}
      ListEmptyComponent={
        <EmptyState
          title="No alerts yet"
          body="When a listing you watch gets a new price, opens up or is nearly full, it shows up here."
        />
      }
      renderItem={({ item }) => (
        <AlertRow
          event={item}
          onOpen={item.floorPlanId ? () => router.push(`/listing/${encodeURIComponent(item.floorPlanId ?? '')}`) : undefined}
        />
      )}
    />
  );
}

function AlertRow({ event, onOpen }: { event: AlertEventDTO; onOpen?: () => void }) {
  const { colors } = useTheme();
  const status = event.read ? 'Read' : 'New';
  const label = `${status}. ${alertLabel(event.trigger)}. ${event.message}. ${dateTimeLabel(event.createdAt)}`;
  const body = (
    <View style={styles.rowBody}>
      <View style={styles.rowHead}>
        <Text style={[styles.trigger, { color: colors.accent }]}>{alertLabel(event.trigger)}</Text>
        {event.read ? null : (
          <Text style={[styles.newTag, { backgroundColor: colors.accent, color: colors.onAccent }]}>New</Text>
        )}
      </View>
      <Text style={[styles.message, { color: colors.text }]}>{event.message}</Text>
      <Text style={[styles.time, { color: colors.muted }]}>{dateTimeLabel(event.createdAt)}</Text>
    </View>
  );
  const shell = [styles.row, { backgroundColor: colors.surface, borderColor: colors.border }];
  if (!onOpen) {
    return <View accessible accessibilityLabel={label} style={shell}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the listing"
      onPress={onOpen}
      style={({ pressed }) => [...shell, { opacity: pressed ? 0.85 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  row: {
    minHeight: MIN_TAP,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
  },
  rowBody: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trigger: { fontSize: type.small, fontWeight: '700' },
  newTag: { fontSize: 12, fontWeight: '700', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  message: { fontSize: type.body },
  time: { fontSize: type.caption },
});
