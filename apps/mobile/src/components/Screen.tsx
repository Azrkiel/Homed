// Page wrapper: themed background, 16px side gutter, optional scrolling.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
}

export function Screen({ children, scroll = false }: ScreenProps) {
  const { colors } = useTheme();
  if (scroll) {
    return (
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.flex, styles.content, { backgroundColor: colors.background }]}>{children}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
});
