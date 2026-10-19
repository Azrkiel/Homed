// One score dimension (price, location, looks) as a labelled bar with a numeric value.
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing, useTheme } from '../theme';

interface ScoreBarProps {
  label: string;
  /** 0-100. */
  value: number;
  note?: string;
}

export function ScoreBar({ label, value, note }: ScoreBarProps) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${pct} of 100${note ? `. ${note}` : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={styles.row}
    >
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.text }]}>{pct}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
      </View>
      {note ? <Text style={[styles.note, { color: colors.muted }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 15, fontWeight: '600' },
  value: { fontSize: 15, fontVariant: ['tabular-nums'] },
  track: { height: 8, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.sm },
  note: { fontSize: 13 },
});
