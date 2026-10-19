// Ranked-list card: photo, names, price, score, why line and badges. Tap body to open; footer is separate.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ListingDTO } from '../api-types';
import { badgeLabel, money, perMonth } from '../format';
import { radius, spacing, useTheme } from '../theme';
import { Badge } from './Badge';
import { ListingPhoto } from './ListingPhoto';
import { ScorePill } from './ScorePill';

interface ListingCardProps {
  listing: ListingDTO;
  onPress: () => void;
  /** Extra controls rendered below the tappable body (e.g. a remove button). */
  footer?: ReactNode;
}

export function ListingCard({ listing, onPress, footer }: ListingCardProps) {
  const { colors } = useTheme();
  const badges = listing.badges.map(badgeLabel).join(', ');
  const summary = [
    listing.propertyName,
    listing.floorPlanName,
    listing.bedBath,
    `${money(listing.totalMonthly)} all-in per person per month`,
    `score ${Math.round(listing.scoreTotal)}`,
    badges,
  ]
    .filter((part) => part !== '')
    .join('. ');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityHint="Opens listing details"
        onPress={onPress}
        style={({ pressed }) => [styles.body, { opacity: pressed ? 0.85 : 1 }]}
      >
        <ListingPhoto uri={listing.photoUrl} isRendering={listing.photoIsRendering} alt={listing.propertyName} />
        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                {listing.propertyName}
              </Text>
              <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
                {listing.floorPlanName} · {listing.bedBath}
              </Text>
              <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>
                {listing.neighborhood}
              </Text>
            </View>
            <ScorePill score={listing.scoreTotal} />
          </View>
          <Text style={[styles.price, { color: colors.text }]}>{perMonth(listing.totalMonthly)}</Text>
          <Text style={[styles.meta, { color: colors.muted }]}>All-in per person</Text>
          {listing.why ? <Text style={[styles.why, { color: colors.text }]}>{listing.why}</Text> : null}
          {listing.badges.length > 0 ? (
            <View style={styles.badges}>
              {listing.badges.map((badge) => (
                <Badge key={badge} badge={badge} />
              ))}
            </View>
          ) : null}
        </View>
      </Pressable>
      {footer ? <View style={[styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  body: { gap: 0 },
  content: { padding: spacing.lg, gap: spacing.xs },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  titleText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 13 },
  price: { fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
  why: { fontSize: 14, marginTop: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.sm },
});
