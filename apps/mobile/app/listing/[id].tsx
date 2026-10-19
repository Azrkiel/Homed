// Listing detail: photos, score breakdown, all-in cost, commute, lease, amenities, save toggle, website link.
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { addSave, getListing, removeSave } from '../../src/api';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { PhotoCarousel } from '../../src/components/detail/PhotoCarousel';
import {
  AmenitiesSection,
  CommuteSection,
  CostSection,
  LeaseSection,
  Section,
} from '../../src/components/detail/Sections';
import { Screen } from '../../src/components/Screen';
import { ScoreBar } from '../../src/components/ScoreBar';
import { ScorePill } from '../../src/components/ScorePill';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/States';
import { errorText, useLoad } from '../../src/hooks/useLoad';
import { perMonth, safeHttpUrl } from '../../src/format';
import { spacing, type, useTheme } from '../../src/theme';

export default function ListingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const floorPlanId = typeof id === 'string' ? id : '';
  const { colors } = useTheme();
  const { data, error, loading, reload, setData } = useLoad(() => getListing(floorPlanId), [floorPlanId]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (data === null) {
    if (error) return <ErrorState message={error} onRetry={reload} />;
    if (loading) return <LoadingState label="Loading listing" />;
    return <EmptyState title="Listing not found" />;
  }

  async function toggleSave() {
    if (!data || saving) return;
    const wasSaved = data.saved;
    setSaving(true);
    setSaveError(null);
    setData((d) => (d ? { ...d, saved: !wasSaved } : d));
    try {
      if (wasSaved) await removeSave(data.floorPlanId);
      else await addSave(data.floorPlanId);
    } catch (e) {
      setData((d) => (d ? { ...d, saved: wasSaved } : d));
      setSaveError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const website = safeHttpUrl(data.website);
  const looksNote =
    data.score.looksBasis === 'age_only' ? 'Based on building age. No real photos yet.' : 'From photos and building age.';

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: data.propertyName }} />
      <PhotoCarousel photos={data.photos} fallbackAlt={data.propertyName} />

      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {data.propertyName}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {data.floorPlanName} · {data.bedBath}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>
            {data.address} · {data.neighborhood}
          </Text>
        </View>
        <ScorePill score={data.scoreTotal} />
      </View>

      <Text style={[styles.price, { color: colors.text }]}>{perMonth(data.totalMonthly)}</Text>
      <Text style={[styles.meta, { color: colors.muted }]}>All-in per person</Text>
      {data.why ? <Text style={[styles.why, { color: colors.text }]}>{data.why}</Text> : null}

      {data.badges.length > 0 ? (
        <View style={styles.badges}>
          {data.badges.map((badge) => (
            <Badge key={badge} badge={badge} />
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={data.saved ? 'Unsave' : 'Save'}
          variant={data.saved ? 'secondary' : 'primary'}
          onPress={() => void toggleSave()}
          loading={saving}
          accessibilityHint={data.saved ? 'Removes this listing from saved' : 'Adds this listing to saved'}
        />
        {website ? (
          <Button label="Open website" variant="secondary" onPress={() => void Linking.openURL(website)} />
        ) : null}
        {saveError ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
            {saveError}
          </Text>
        ) : null}
      </View>

      <Section title="Best Match score">
        <ScoreBar label="Price" value={data.score.price} />
        <ScoreBar label="Location" value={data.score.location} />
        <ScoreBar label="Looks" value={data.score.looks} note={looksNote} />
      </Section>

      <CostSection cost={data.cost} />
      <CommuteSection commute={data.commute} walkTimes={data.walkTimes} />
      <LeaseSection listing={data} />
      <AmenitiesSection amenities={data.amenities} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: type.title, fontWeight: '700' },
  meta: { fontSize: type.small },
  price: { fontSize: 24, fontWeight: '700' },
  why: { fontSize: type.body },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actions: { gap: spacing.sm },
  error: { fontSize: type.body },
});
