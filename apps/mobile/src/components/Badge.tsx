// Readable text pill for a listing badge. Renders the label as text, never as colour alone.
import { StyleSheet, Text, View } from 'react-native';
import type { ListingBadge } from '../api-types';
import { badgeLabel } from '../format';
import { radius, spacing, useTheme } from '../theme';

export function Badge({ badge }: { badge: ListingBadge }) {
  const { colors } = useTheme();
  const label = badgeLabel(badge);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[styles.pill, { backgroundColor: colors.badgeSurface, borderColor: colors.border }]}
    >
      <Text style={[styles.text, { color: colors.badgeText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { fontSize: 12, fontWeight: '600' },
});
