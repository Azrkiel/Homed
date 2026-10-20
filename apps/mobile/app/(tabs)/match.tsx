// Match: swipe deck of listings the user has not swiped yet. Right saves, left passes. Pass, Details and Save buttons do the same.
import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { getMatchQueue, postSwipe } from '../../src/api';
import type { ListingDTO } from '../../src/api-types';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { SwipeCard, type CardAction } from '../../src/components/SwipeCard';
import { ErrorState, LoadingState } from '../../src/components/States';
import { errorText, useLoad } from '../../src/hooks/useLoad';
import { commitDistance, decideSwipe, flickTarget, rotationRange, type SwipeDirection } from '../../src/swipe';
import { radius, spacing, type, useTheme } from '../../src/theme';

// The native driver only exists on native. Web runs the same animations on the JS thread.
const NATIVE_DRIVER = Platform.OS !== 'web';
/** Cards visible in the stack, top card included. */
const DECK_SIZE = 3;
const FLY_MS = 220;
/** Movement under this (px) on both axes counts as a tap, not a drag. */
const TAP_SLOP = 6;

export default function MatchScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data, error, loading, reload, setData } = useLoad(() => getMatchQueue());
  /** Cards already decided this load. Drives the "3 of 24" progress text. */
  const [seen, setSeen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const queue = data ?? [];
  const top = queue[0];
  const visible = queue.slice(0, DECK_SIZE);

  const commit = commitDistance(width);
  const rotation = useMemo(
    () => pan.x.interpolate({ ...rotationRange(width), extrapolate: 'clamp' }),
    [pan, width],
  );
  const saveOpacity = useMemo(
    () => pan.x.interpolate({ inputRange: [0, commit], outputRange: [0, 1], extrapolate: 'clamp' }),
    [pan, commit],
  );
  const passOpacity = useMemo(
    () => pan.x.interpolate({ inputRange: [-commit, 0], outputRange: [1, 0], extrapolate: 'clamp' }),
    [pan, commit],
  );

  const reloadDeck = useCallback(() => {
    setSeen(0);
    reload();
  }, [reload]);

  function openDetail(card: ListingDTO) {
    router.push(`/listing/${encodeURIComponent(card.floorPlanId)}`);
  }

  function springBack() {
    busyRef.current = true;
    setBusy(true);
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      friction: 7,
      tension: 80,
      useNativeDriver: NATIVE_DRIVER,
    }).start(() => {
      busyRef.current = false;
      setBusy(false);
    });
  }

  /** Optimistic advance: the card leaves the deck, then the swipe is sent in the background. */
  function finishSwipe(card: ListingDTO, direction: SwipeDirection) {
    setData((rows) => (rows ? rows.filter((r) => r.floorPlanId !== card.floorPlanId) : rows));
    setSeen((s) => s + 1);
    pan.setValue({ x: 0, y: 0 });
    busyRef.current = false;
    setBusy(false);
    void sendSwipe(card, direction);
  }

  async function sendSwipe(card: ListingDTO, direction: SwipeDirection) {
    try {
      await postSwipe(card.floorPlanId, direction);
    } catch (e) {
      // Put the card back on top so the swipe can be retried.
      setSeen((s) => Math.max(0, s - 1));
      setData((rows) => [card, ...(rows ?? []).filter((r) => r.floorPlanId !== card.floorPlanId)]);
      const verb = direction === 'right' ? 'save' : 'pass';
      setSendError(`Could not record the ${verb} for ${card.propertyName}. ${errorText(e)} It is back on top.`);
    }
  }

  /** Animated swipe in a direction. Used by drag release, the buttons and accessibility actions. */
  function swipe(direction: SwipeDirection) {
    if (!top || busyRef.current) return;
    const card = top;
    busyRef.current = true;
    setBusy(true);
    setSendError(null);
    Animated.timing(pan, {
      toValue: { x: flickTarget(direction, width), y: 0 },
      duration: FLY_MS,
      useNativeDriver: NATIVE_DRIVER,
    }).start(() => finishSwipe(card, direction));
  }

  function handleRelease(dx: number, dy: number, vx: number) {
    if (!top || busyRef.current) return;
    const direction = decideSwipe(dx, vx, width);
    if (direction) {
      swipe(direction);
      return;
    }
    if (Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP) openDetail(top);
    springBack();
  }

  function handleCardAction(action: CardAction) {
    if (!top) return;
    if (action === 'open') openDetail(top);
    else swipe(action === 'save' ? 'right' : 'left');
  }

  // PanResponder is created once. This ref keeps its release callback pointed at the latest render.
  const releaseRef = useRef(handleRelease);
  releaseRef.current = handleRelease;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !busyRef.current,
      onMoveShouldSetPanResponder: (_, g) =>
        !busyRef.current && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: NATIVE_DRIVER }),
      onPanResponderRelease: (_, g) => releaseRef.current(g.dx, g.dy, g.vx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => springBack(),
    }),
  ).current;

  const bannerStyle = { backgroundColor: colors.surface, borderColor: colors.border };

  if (data === null) {
    if (error) {
      return (
        <Screen>
          <ErrorState message={error} onRetry={reloadDeck} />
        </Screen>
      );
    }
    return <LoadingState label="Loading matches" />;
  }

  const banners = (
    <>
      {error ? (
        <View accessibilityRole="alert" style={[styles.banner, bannerStyle]}>
          <Text style={[styles.bannerText, { color: colors.danger }]}>{error}</Text>
          <Button label="Try again" variant="secondary" onPress={reloadDeck} disabled={loading} />
        </View>
      ) : null}
      {sendError ? (
        <View accessibilityRole="alert" style={[styles.banner, bannerStyle]}>
          <Text style={[styles.bannerText, { color: colors.danger }]}>{sendError}</Text>
          <Button label="Dismiss" variant="ghost" onPress={() => setSendError(null)} />
        </View>
      ) : null}
    </>
  );

  if (queue.length === 0) {
    return (
      <Screen>
        {banners}
        <View style={styles.caughtUp}>
          <Text style={[styles.caughtUpTitle, { color: colors.text }]} accessibilityRole="header">
            You are all caught up
          </Text>
          <Text style={[styles.caughtUpBody, { color: colors.muted }]}>
            No new listings to swipe right now. Listings you saved are in the Saved tab.
          </Text>
          <Button label="Reload" variant="secondary" onPress={reloadDeck} loading={loading} />
          <Button label="Go to Saved" variant="ghost" onPress={() => router.navigate('/saved')} />
        </View>
      </Screen>
    );
  }

  const position = seen + 1;
  const total = seen + queue.length;

  return (
    <Screen>
      <Text style={[styles.progress, { color: colors.muted }]} accessibilityLiveRegion="polite">
        {`${position} of ${total}`}
      </Text>
      {banners}
      <View style={styles.deck}>
        {visible
          .map((listing, index) => ({ listing, index }))
          .reverse()
          .map(({ listing, index }) => {
            const isTop = index === 0;
            return (
              <SwipeCard
                key={listing.floorPlanId}
                listing={listing}
                top={isTop}
                style={
                  isTop
                    ? { transform: [{ translateX: pan.x }, { rotate: rotation }] }
                    : { transform: [{ scale: 1 - 0.04 * index }, { translateY: 12 * index }] }
                }
                panHandlers={isTop ? panResponder.panHandlers : undefined}
                saveOpacity={isTop ? saveOpacity : undefined}
                passOpacity={isTop ? passOpacity : undefined}
                onAction={isTop ? handleCardAction : undefined}
              />
            );
          })}
      </View>
      <View style={styles.actions}>
        <Button
          label="Pass"
          variant="secondary"
          disabled={!top || busy}
          accessibilityHint="Passes on this listing and shows the next one"
          style={styles.action}
          onPress={() => swipe('left')}
        />
        <Button
          label="Details"
          variant="ghost"
          disabled={!top || busy}
          accessibilityHint="Opens the full listing"
          style={styles.action}
          onPress={() => {
            if (top) openDetail(top);
          }}
        />
        <Button
          label="Save"
          variant="primary"
          disabled={!top || busy}
          accessibilityHint="Saves this listing and shows the next one"
          style={styles.action}
          onPress={() => swipe('right')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { fontSize: type.small, textAlign: 'center' },
  deck: { flex: 1, minHeight: 360, position: 'relative' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: { flex: 1, fontSize: type.small },
  caughtUp: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  caughtUpTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  caughtUpBody: { fontSize: type.body, textAlign: 'center' },
});
