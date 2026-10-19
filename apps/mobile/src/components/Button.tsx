// Touch button with a 44pt minimum target and a text label (never icon-only).
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { MIN_TAP, radius, spacing, type Palette, useTheme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Overrides the accessibility label (defaults to the visible label). */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

function colorsFor(variant: Variant, c: Palette): { bg: string; fg: string; border: string } {
  switch (variant) {
    case 'primary':
      return { bg: c.accent, fg: c.onAccent, border: c.accent };
    case 'secondary':
      return { bg: c.surface, fg: c.accent, border: c.accent };
    case 'danger':
      return { bg: c.dangerSurface, fg: c.danger, border: c.danger };
    case 'ghost':
      return { bg: 'transparent', fg: c.accent, border: 'transparent' };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const palette = colorsFor(variant, colors);
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
});
