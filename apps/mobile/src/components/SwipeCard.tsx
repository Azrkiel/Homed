// One card in the Match deck. Visual only: the Match screen owns the pan value, gesture handlers and stamp opacities.
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type GestureResponderHandlers,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ListingDTO } from '../api-types';
import { badgeLabel, perMonth } from '../format';
import { radius, spacing, useTheme } from '../theme';
import { Badge } from './Badge';
import { ListingPhoto } from './ListingPhoto';
import { ScorePill } from './ScorePill';

export type CardAction = 'open' | 'save' | 'pass';

interface SwipeCardProps {
  listing: ListingDTO;
  /** Only the top card takes gestures and accessibility actions. */
  top: boolean;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
  panHandlers?: GestureResponderHandlers;
  saveOpacity?: Animated.AnimatedInterpolation<number>;
  passOpacity?: Animated.AnimatedInterpolation<number>;
  onAction?: (action: CardAction) => void;
}

const ACTIONS = [
  { name: 'open', label: 'Open details' },
  { name: 'save', label: 'Save' },
  { name: 'pass', label: 'Pass' },
];

export function SwipeCard({ listing, top, style, panHandlers, saveOpacity, passOpacity, onAction }: SwipeCardProps) {
  const { colors } = useTheme();
  const badges = listing.badges.map(badgeLabel).join(', ');
  const summary = [
    listing.propertyName,
    listing.floorPlanName,
    listing.bedBath,
    `${perMonth(listing.totalMonthly)} all-in per person`,
    `score ${Math.round(listing.scoreTotal)}`,
    badges,
  ]
    .filter((part) => part !== '')
    .join('. ');

  function handleAccessibilityAction(name: string) {
    if (!onAction) return;
    if (name === 'activate' || name === 'open') onAction('open');
    else if (name === 'save') onAction('save');
    else if (name === 'pass') onAction('pass');
  }

  return (
    <Animated.View
      {...panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={summary}
      accessibilityHint="Swipe right to save, left to pass, or tap to open details"
      accessibilityActions={top ? ACTIONS : undefined}
      onAccessibilityAction={(event) => handleAccessibilityAction(event.nativeEvent.actionName)}
      accessibilityElementsHidden={!top}
      importantForAccessibility={top ? 'yes' : 'no-hide-descendants'}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}
    >
      <ListingPhoto uri={listing.photoUrl} isRendering={listing.photoIsRendering} alt={listing.propertyName} style={styles.photo} />
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
        {listing.why ? (
          <Text style={[styles.why, { color: colors.text }]} numberOfLines={3}>
            {listing.why}
          </Text>
        ) : null}
        {listing.badges.length > 0 ? (
          <View style={styles.badges}>
            {listing.badges.map((badge) => (
              <Badge key={badge} badge={badge} />
            ))}
          </View>
        ) : null}
      </View>

      {saveOpacity ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          style={[styles.stamp, styles.stampLeft, { borderColor: colors.good, opacity: saveOpacity }]}
        >
          <Text style={[styles.stampText, { color: colors.good }]}>SAVE</Text>
        </Animated.View>
      ) : null}
      {passOpacity ? (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          style={[styles.stamp, styles.stampRight, { borderColor: colors.danger, opacity: passOpacity }]}
        >
          <Text style={[styles.stampText, { color: colors.danger }]}>PASS</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  photo: { height: 160 },
  content: { padding: spacing.lg, gap: spacing.xs, flex: 1 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.md },
  titleText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '700' },
  meta: { fontSize: 13 },
  price: { fontSize: 20, fontWeight: '700', marginTop: spacing.sm },
  why: { fontSize: 14, marginTop: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 'auto' },
  stamp: {
    position: 'absolute',
    top: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 3,
    borderRadius: radius.sm,
  },
  stampLeft: { left: spacing.lg, transform: [{ rotate: '-12deg' }] },
  stampRight: { right: spacing.lg, transform: [{ rotate: '12deg' }] },
  stampText: { fontSize: 24, fontWeight: '800', letterSpacing: 1 },
});
