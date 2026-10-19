// Listing image with a labelled placeholder when there is no photo, and a "Rendering" tag for renderings.
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '../theme';

interface ListingPhotoProps {
  uri: string | null;
  isRendering: boolean;
  alt: string;
  style?: StyleProp<ViewStyle>;
}

export function ListingPhoto({ uri, isRendering, alt, style }: ListingPhotoProps) {
  const { colors } = useTheme();
  if (!uri) {
    return (
      <View
        accessible
        accessibilityLabel={`${alt}. No photo yet`}
        style={[styles.box, styles.placeholder, { backgroundColor: colors.placeholder }, style]}
      >
        <Text style={[styles.placeholderText, { color: colors.muted }]}>No photo yet</Text>
      </View>
    );
  }
  return (
    <View style={[styles.box, { backgroundColor: colors.placeholder }, style]}>
      <Image
        source={{ uri }}
        accessibilityLabel={isRendering ? `${alt}. Rendering` : alt}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {isRendering ? (
        <View style={[styles.tag, { backgroundColor: colors.surface }]} accessible={false}>
          <Text style={[styles.tagText, { color: colors.text }]}>Rendering</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', aspectRatio: 16 / 9, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 14 },
  tag: {
    position: 'absolute',
    left: spacing.sm,
    top: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  tagText: { fontSize: 12, fontWeight: '700' },
});
