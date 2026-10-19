// Best Match score as a labelled pill, e.g. "87 match". Colour band plus text, so it reads without colour.
import { StyleSheet, Text, View } from 'react-native';
import { radius, scoreTone, spacing, useTheme } from '../theme';

export function ScorePill({ score }: { score: number }) {
  const { colors } = useTheme();
  const tone = scoreTone(score, colors);
  const value = Math.round(score);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Best Match score ${value} of 100`}
      style={[styles.pill, { backgroundColor: tone.bg }]}
    >
      <Text style={[styles.value, { color: tone.fg }]}>{value}</Text>
      <Text style={[styles.label, { color: tone.fg }]}>match</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 56,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  value: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600' },
});
