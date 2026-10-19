// Horizontal paging photo strip for the listing detail. Falls back to the placeholder with no photos.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { PhotoDTO } from '../../api-types';
import { spacing, useTheme } from '../../theme';
import { ListingPhoto } from '../ListingPhoto';

export function PhotoCarousel({ photos, fallbackAlt }: { photos: PhotoDTO[]; fallbackAlt: string }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  // Screen adds a 16px gutter on each side, so pages are that much narrower than the window.
  const pageWidth = Math.max(0, width - spacing.lg * 2);

  if (photos.length === 0) {
    return <ListingPhoto uri={null} isRendering={false} alt={fallbackAlt} />;
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const next = pageWidth > 0 ? Math.round(e.nativeEvent.contentOffset.x / pageWidth) : 0;
          setIndex(Math.min(Math.max(next, 0), photos.length - 1));
        }}
        style={styles.strip}
      >
        {photos.map((photo, i) => (
          <View key={`${photo.url}-${i}`} style={{ width: pageWidth }}>
            <ListingPhoto uri={photo.url} isRendering={photo.isRendering} alt={photo.alt || fallbackAlt} />
          </View>
        ))}
      </ScrollView>
      <Text style={[styles.counter, { color: colors.muted }]} accessibilityLiveRegion="polite">
        Photo {index + 1} of {photos.length}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  strip: { borderRadius: 16, overflow: 'hidden' },
  counter: { fontSize: 13, textAlign: 'right' },
});
