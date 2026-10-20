// Root: auth provider, status bar, and the stack. Sends signed-out users to /signin and signed-in users off it.
import { useEffect } from 'react';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth';
import { LoadingState } from '../src/components/States';
import { useTheme } from '../src/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationReady = useRootNavigationState()?.key !== undefined;
  const { colors } = useTheme();
  const onSignIn = segments[0] === 'signin';

  useEffect(() => {
    if (loading || !navigationReady) return;
    if (!token && !onSignIn) router.replace('/signin');
    else if (token && onSignIn) router.replace('/');
  }, [loading, navigationReady, token, onSignIn, router]);

  if (loading) return <LoadingState label="Restoring session" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.accent,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="signin" options={{ title: 'Sign in', headerBackVisible: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="listing/[id]" options={{ title: 'Listing' }} />
    </Stack>
  );
}
