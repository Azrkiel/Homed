// Tabs in order: Ranked (sorted list), Match (swipe deck), Saved, Alerts. Sign-out lives in the Alerts header.
import { Pressable, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { useAuth } from '../../src/auth';
import { MIN_TAP, spacing, useTheme } from '../../src/theme';

function SignOutButton() {
  const { signOut } = useAuth();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      onPress={() => void signOut()}
      style={{ minHeight: MIN_TAP, minWidth: MIN_TAP, justifyContent: 'center', paddingHorizontal: spacing.md }}
    >
      <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '600' }}>Sign out</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ranked', tabBarLabel: 'Ranked' }} />
      <Tabs.Screen name="match" options={{ title: 'Match', tabBarLabel: 'Match' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarLabel: 'Saved' }} />
      <Tabs.Screen
        name="alerts"
        options={{ title: 'Alerts', tabBarLabel: 'Alerts', headerRight: () => <SignOutButton /> }}
      />
    </Tabs>
  );
}
