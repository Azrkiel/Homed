// Matches: ranked listings for the signed-in student. Pull to refresh.
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getListings } from '../../src/api';
import { ListingCard } from '../../src/components/ListingCard';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/States';
import { useLoad } from '../../src/hooks/useLoad';
import { spacing, useTheme } from '../../src/theme';

export default function MatchesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data, error, loading, reload } = useLoad(() => getListings());

  if (data === null) {
    if (error) return <ErrorState message={error} onRetry={reload} />;
    return <LoadingState label="Loading listings" />;
  }

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      data={data}
      keyExtractor={(item) => item.floorPlanId}
      renderItem={({ item }) => (
        <ListingCard
          listing={item}
          onPress={() => router.push(`/listing/${encodeURIComponent(item.floorPlanId)}`)}
        />
      )}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.accent} />}
      ListHeaderComponent={
        error ? <ErrorState message={error} onRetry={reload} /> : undefined
      }
      ListEmptyComponent={
        <EmptyState
          title="No listings yet"
          body="Listings that match your search will show up here. Pull down to refresh."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
});
