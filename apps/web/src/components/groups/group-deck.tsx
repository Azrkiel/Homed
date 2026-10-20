'use client';

// Group Match deck: one card at a time, shared by the group. Swipe by pointer drag, Pass/Yes buttons, or
// Left/Right keys. No undo. Server calls are optimistic: the deck advances at once and a failed call
// restores the snapshot. A right swipe that completes the group's agreement shows the match banner.
import Link from 'next/link';
import {
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { MatchCardView } from '@/components/match/match-card-view';
import { Alert, Button } from '@/components/ui';
import { groupSwipeAction } from '@/lib/groups/actions';
import { groupMatchMessage } from '@/lib/groups/browse';
import {
  SWIPE_THRESHOLD_PX,
  deckReducer,
  dragOutcome,
  listingName,
  swipeMessage,
  type DeckDirection,
  type DeckState,
  type MatchCard,
} from '@/lib/search/match';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeReduced(onChange: () => void): () => void {
  const mql = window.matchMedia(REDUCED_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Keys typed into a field must not swipe. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function GroupDeck({
  groupId,
  cards,
  today,
  empty,
}: {
  groupId: string;
  cards: MatchCard[];
  today: string;
  /** Shown once the queue is used up. */
  empty: ReactNode;
}) {
  const [state, dispatch] = useReducer(deckReducer<MatchCard>, cards, (queue): DeckState<MatchCard> => ({ queue, last: null }));
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const busy = useRef(false);
  const reduced = usePrefersReducedMotion();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x0: number; t0: number; dx: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);

  const top = state.queue[0];
  const next = state.queue[1];

  function swipe(direction: DeckDirection) {
    const card = top;
    if (busy.current || card === undefined) return;
    const snapshot = state;
    // The buttons leave with the last card; keep focus inside the deck so keys still work.
    if (state.queue.length === 1) sectionRef.current?.focus();
    setError(null);
    setDx(0);
    setMatchedName(null);
    setMessage(swipeMessage(direction, listingName(card)));
    dispatch({ type: 'swipe', direction });
    busy.current = true;
    startTransition(async () => {
      try {
        const res = await groupSwipeAction(groupId, card.floorPlanId, direction);
        if (res.ok) {
          if (res.matched && direction === 'right') setMatchedName(listingName(card));
        } else {
          dispatch({ type: 'restore', state: snapshot });
          setError(res.message || 'Could not record your swipe. Please try again.');
          setMessage('');
        }
      } catch {
        dispatch({ type: 'restore', state: snapshot });
        setError('Could not record your swipe. Please try again.');
        setMessage('');
      } finally {
        busy.current = false;
      }
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      swipe('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      swipe('right');
    }
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (busy.current || e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { id: e.pointerId, x0: e.clientX, t0: performance.now(), dx: 0, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.dx = e.clientX - d.x0;
    if (Math.abs(d.dx) > 6) d.moved = true;
    setDx(d.dx);
  }

  function endDrag(e: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
    // A drag must not also follow the "Open full listing" link.
    suppressClick.current = d.moved;
    const outcome = cancelled ? null : dragOutcome(d.dx, performance.now() - d.t0);
    if (outcome) swipe(outcome);
    else setDx(0);
  }

  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  const topStyle: CSSProperties = {
    transform: `translate3d(${dx}px,0,0) rotate(${dx / 20}deg)`,
    transition: dragging || reduced ? 'none' : 'transform 200ms ease-out',
    touchAction: 'pan-y',
  };
  const cue = Math.min(1, Math.abs(dx) / SWIPE_THRESHOLD_PX);

  return (
    <div className="grid gap-5">
      {matchedName && (
        <div role="status" aria-live="polite" className="grid gap-2 rounded-card border border-good bg-good-soft p-4">
          <p className="font-semibold text-good">{groupMatchMessage(matchedName)}</p>
          <Link href={`/groups/${groupId}`} className="text-sm font-medium text-ink underline underline-offset-2">
            Back to the group
          </Link>
        </div>
      )}

      <section
        ref={sectionRef}
        tabIndex={0}
        aria-label="Group match deck"
        aria-describedby="group-deck-hint"
        onKeyDown={onKeyDown}
        className="grid gap-5 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <p id="group-deck-hint" className="sr-only">
          Keyboard: focus this area, Left arrow passes, Right arrow says yes.
        </p>

        {top !== undefined && (
          <div className="relative mx-auto w-full max-w-md">
            {next && (
              <div aria-hidden="true" inert className="pointer-events-none absolute inset-x-3 top-3">
                <MatchCardView card={next} today={today} />
              </div>
            )}
            <div
              key={top.floorPlanId}
              className="relative cursor-grab select-none active:cursor-grabbing"
              style={topStyle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => endDrag(e, false)}
              onPointerCancel={(e) => endDrag(e, true)}
              onClickCapture={onClickCapture}
            >
              <MatchCardView card={top} today={today} showLink />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-4 rounded-md border-2 border-bad bg-surface px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-bad"
                style={{ opacity: dx < 0 ? cue : 0 }}
              >
                Pass
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-4 rounded-md border-2 border-good bg-surface px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-good"
                style={{ opacity: dx > 0 ? cue : 0 }}
              >
                Yes
              </span>
            </div>
          </div>
        )}

        {top ? (
          <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3">
            <Button variant="secondary" size="lg" className="w-full" onClick={() => swipe('left')} aria-label={`Pass ${listingName(top)}`}>
              Pass
            </Button>
            <Button variant="primary" size="lg" className="w-full" onClick={() => swipe('right')} aria-label={`Yes to ${listingName(top)}`}>
              Yes
            </Button>
          </div>
        ) : (
          empty
        )}

        <p role="status" aria-live="polite" className="sr-only">
          {message}
        </p>
        {error && <Alert tone="bad" title="Something went wrong">{error}</Alert>}
      </section>
    </div>
  );
}
