'use client';

// Match deck: one card at a time. Swipe by pointer drag, the Pass/Save buttons, or Left/Right (Z or Backspace undoes).
// Server calls are optimistic: the deck advances at once, and a failed call restores the snapshot.
import {
  useCallback,
  useEffect,
  useId,
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
import { Alert, Button } from '@/components/ui';
import { recordSwipeAction, undoSwipeAction, type ActionResult } from '@/lib/search/actions';
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
import { MatchCardView } from './match-card-view';

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

/** A card flying off after a swipe. Purely visual: the deck state has already moved on. */
interface FlightState {
  id: number;
  card: MatchCard;
  direction: DeckDirection;
  fromX: number;
}

function Flight({
  flight,
  today,
  onDone,
}: {
  flight: FlightState;
  today: string;
  onDone: (id: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { id, card, direction, fromX } = flight;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sign = direction === 'right' ? 1 : -1;
    const anim = el.animate(
      [
        { transform: `translate3d(${fromX}px,0,0) rotate(${fromX / 20}deg)`, opacity: 1 },
        { transform: `translate3d(${sign * window.innerWidth}px,0,0) rotate(${sign * 20}deg)`, opacity: 0 },
      ],
      { duration: 280, easing: 'ease-in', fill: 'forwards' },
    );
    anim.onfinish = () => onDone(id);
    return () => {
      anim.onfinish = null;
      anim.cancel();
    };
  }, [direction, fromX, id, onDone]);

  return (
    <div ref={ref} aria-hidden="true" inert className="pointer-events-none absolute inset-x-0 top-0">
      <MatchCardView card={card} today={today} />
    </div>
  );
}

export function MatchDeck({
  cards,
  today,
  empty,
}: {
  cards: MatchCard[];
  today: string;
  /** Shown once the queue is used up. */
  empty: ReactNode;
}) {
  const [state, dispatch] = useReducer(deckReducer<MatchCard>, cards, (queue): DeckState<MatchCard> => ({ queue, last: null }));
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const busy = useRef(false);
  const reduced = usePrefersReducedMotion();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flights, setFlights] = useState<FlightState[]>([]);
  const flightId = useRef(0);
  const drag = useRef<{ id: number; x0: number; t0: number; dx: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const sectionRef = useRef<HTMLElement>(null);
  const hintId = useId();

  const top = state.queue[0];
  const next = state.queue[1];

  const removeFlight = useCallback((id: number) => setFlights((fs) => fs.filter((f) => f.id !== id)), []);

  /** Persists one action. Blocks further swipes until it settles; a failure restores `snapshot`. */
  function runServer<T extends object>(
    snapshot: DeckState<MatchCard>,
    call: () => Promise<ActionResult<T>>,
    onOk: (value: { ok: true } & T) => void,
    fallback: string,
  ) {
    busy.current = true;
    startTransition(async () => {
      try {
        const res = await call();
        if (res.ok) {
          onOk(res);
        } else {
          dispatch({ type: 'restore', state: snapshot });
          setError(res.message || fallback);
          setMessage('');
        }
      } catch {
        dispatch({ type: 'restore', state: snapshot });
        setError(fallback);
        setMessage('');
      } finally {
        busy.current = false;
      }
    });
  }

  function swipe(direction: DeckDirection, fromX = 0) {
    const card = top;
    if (busy.current || card === undefined) return;
    const snapshot = state;
    // The buttons leave with the last card; keep focus inside the deck so keys still work.
    if (state.queue.length === 1) sectionRef.current?.focus();
    setError(null);
    setDx(0);
    setMessage(swipeMessage(direction, listingName(card)));
    dispatch({ type: 'swipe', direction });
    if (!reduced) {
      const id = ++flightId.current;
      setFlights((fs) => [...fs, { id, card, direction, fromX }]);
    }
    runServer(
      snapshot,
      () => recordSwipeAction(card.floorPlanId, direction),
      (res) => dispatch({ type: 'confirm', floorPlanId: card.floorPlanId, addedSave: res.addedSave }),
      'Could not record your swipe. Please try again.',
    );
  }

  function undo() {
    const last = state.last;
    if (busy.current || last === null) return;
    const snapshot = state;
    setError(null);
    setMessage(`Undid ${listingName(last.card)}`);
    dispatch({ type: 'undo' });
    setFlights((fs) => fs.filter((f) => f.card.floorPlanId !== last.card.floorPlanId));
    runServer(
      snapshot,
      () => undoSwipeAction(last.card.floorPlanId, last.direction, last.addedSave),
      () => {},
      'Could not undo that swipe. Please try again.',
    );
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (isTypingTarget(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      swipe('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      swipe('right');
    } else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') {
      e.preventDefault();
      undo();
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
    if (outcome) swipe(outcome, d.dx);
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
    <section
      ref={sectionRef}
      tabIndex={0}
      aria-label="Match deck"
      aria-describedby={hintId}
      onKeyDown={onKeyDown}
      className="grid gap-5 rounded-card outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <p id={hintId} className="text-center text-sm text-ink-2">
        Keyboard: focus this area, Left arrow passes, Right arrow saves, Z undoes.
      </p>

      {(top !== undefined || flights.length > 0) && (
        <div className="relative mx-auto w-full max-w-md">
          {next && (
            <div aria-hidden="true" inert className="pointer-events-none absolute inset-x-3 top-3">
              <MatchCardView card={next} today={today} />
            </div>
          )}
          {top && (
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
                Save
              </span>
            </div>
          )}
          {flights.map((f) => (
            <Flight key={f.id} flight={f} today={today} onDone={removeFlight} />
          ))}
        </div>
      )}

      {top ? (
        <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-3">
          <Button variant="secondary" size="lg" className="w-full" onClick={() => swipe('left')} aria-label={`Pass ${listingName(top)}`}>
            Pass
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            onClick={undo}
            disabled={state.last === null}
            aria-label={state.last ? `Undo, ${listingName(state.last.card)}` : 'Undo, nothing to undo'}
          >
            Undo
          </Button>
          <Button variant="primary" size="lg" className="w-full" onClick={() => swipe('right')} aria-label={`Save ${listingName(top)}`}>
            Save
          </Button>
        </div>
      ) : (
        <>
          {empty}
          {state.last && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={undo}>
                Undo last swipe
              </Button>
            </div>
          )}
        </>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      {error && <Alert tone="bad" title="Something went wrong">{error}</Alert>}
    </section>
  );
}
