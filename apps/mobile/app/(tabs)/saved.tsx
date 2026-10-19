// Saved: the student's shortlist. Remove with a button; missing listings show as "No longer listed".
import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getSaves, removeSave } from '../../src/api';
import type { SaveDTO } from '../../src/api-types';
import { Button } from '../../src/components/Button';
import { ListingCard } from '../../src/components/ListingCard';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/States';
import { errorText, useLoad } from '../../src/hooks/useLoad';
import { spacing, type, useTheme } from '../../src/theme';

export default function SavedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, error, loading, reload, setData } = useLoad(() => getSaves());
  const [actionError, setActionError] = useState<string | null>(null);

  async function remove(save: SaveDTO) {
    const previous = data;
    setActionError(null);
    setData((rows) => (rows ? rows.filter((r) => r.floorPlanId !== save.floorPlanId) : rows));
    try {
      await removeSave(save.floorPlanId);
    } catch (e) {
      setData(previous);
      setActionError(errorText(e));
    }
  }

  if (data === null) {
    if (error) return <ErrorState message={error} onRetry={reload} />;
    return <LoadingState label="Loading saved listings" />;
  }

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(item) => item.floorPlanId}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      ListHeaderComponent={
        <>
          {actionError ? (
            <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
              {actionError}
            </Text>
          ) : null}
          {error ? <ErrorState message={error} onRetry={reload} /> : null}
        </>
      }
      ListEmptyComponent={
        <EmptyState
          title="Nothing saved yet"
          body="Save a listing from its detail page, or swipe right in Matches, and it will be kept here."
        />
      }
      renderItem={({ item }) => {
        const removeButton = (
          <Button
            label="Remove"
            variant="ghost"
            onPress={() => void remove(item)}
            accessibilityHint={`Removes ${item.listing?.propertyName ?? 'this listing'} from saved`}
          />
        );
        if (!item.listing) {
          return (
            <View style={[styles.missing, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.missingTitle, { color: colors.text }]}>No longer listed</Text>
              <Text style={[styles.missingBody, { color: colors.muted }]}>
                This listing was taken down. You can remove it from your saved list.
              </Text>
              {removeButton}
            </View>
          );
        }
        const listing = item.listing;
        return (
          <ListingCard
            listing={listing}
            onPress={() => router.push(`/listing/${encodeURIComponent(listing.floorPlanId)}`)}
            footer={removeButton}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  error: { fontSize: type.body },
  missing: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  missingTitle: { fontSize: 17, fontWeight: '700' },
  missingBody: { fontSize: type.body },
});
