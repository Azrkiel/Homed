// Drawn stand-in for places with no real photo yet. Three archetypes (house, apartment building,
// brick-and-columns on-Grounds hall), varied per property so the list doesn't look like one building
// repeated. Always labelled as an illustration: it must never pass for a photo of the real unit.
import type { PropertyKind } from '@homed/core';
import { cx } from '@/components/ui';

/** Small stable hash, so one property always gets the same drawing. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Index into `list` with any integer (signed shifts of the hash can be negative). */
function pick<T>(list: readonly T[], n: number): T {
  const i = ((n % list.length) + list.length) % list.length;
  return list[i]!;
}

const SKIES = [
  ['#cfe3f2', '#eef5fa'],
  ['#f6dcc6', '#fbefe4'],
  ['#d7e7dc', '#f1f7f2'],
  ['#dcd9ef', '#f3f2fa'],
] as const;
const ROOFS = ['#4a4f5c', '#5b3a2e', '#3f4b3f', '#5a4a5e'] as const;
const DOORS = ['#b9471f', '#2f5d50', '#2c4a7a', '#7a2f3b', '#c08a2b'] as const;
const SIDING = ['#c9d6c3', '#c7d3e0', '#efe3c8', '#d8c3a5', '#f1efe9', '#e2c9c0'] as const;
const FACADES = ['#d9d4c7', '#a9b4c2', '#c9ad8d', '#8e9aa8', '#e6ddd0', '#b7c4b5'] as const;
const ACCENTS = ['#b9471f', '#2f5d50', '#38506e', '#8a5a2b'] as const;

function Trees({ seed }: { seed: number }) {
  const left = 30 + (seed % 25);
  const right = 345 + ((seed >>> 3) % 25);
  const greens = ['#6f9a63', '#5f8a5a', '#7ea86a'];
  return (
    <g>
      {[left, right].map((x, i) => (
        <g key={x}>
          <rect x={x - 3} y={222} width={6} height={30} fill="#6b4f3a" />
          <circle cx={x} cy={212} r={22 + ((seed >>> (i + 2)) % 6)} fill={pick(greens, seed + i)} />
          <circle cx={x - 9} cy={204} r={12} fill={pick(greens, seed + i + 1)} opacity={0.9} />
        </g>
      ))}
    </g>
  );
}

function Window({ x, y, w = 22, h = 26, shutter }: { x: number; y: number; w?: number; h?: number; shutter?: string }) {
  return (
    <g>
      {shutter && <rect x={x - 7} y={y} width={6} height={h} fill={shutter} />}
      {shutter && <rect x={x + w + 1} y={y} width={6} height={h} fill={shutter} />}
      <rect x={x - 2} y={y - 2} width={w + 4} height={h + 4} fill="#ffffff" />
      <rect x={x} y={y} width={w} height={h} fill="#9cc3dd" />
      <rect x={x} y={y} width={w} height={h / 2.4} fill="#c9e1ef" />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke="#ffffff" strokeWidth={2} />
      <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} stroke="#ffffff" strokeWidth={2} />
    </g>
  );
}

function House({ seed }: { seed: number }) {
  const siding = pick(SIDING, seed);
  const roof = pick(ROOFS, seed >>> 2);
  const door = pick(DOORS, seed >>> 4);
  const dormer = (seed >>> 6) % 2 === 0;
  return (
    <g>
      <rect x={110} y={140} width={180} height={112} fill={siding} />
      {Array.from({ length: 10 }, (_, i) => (
        <line key={i} x1={110} y1={150 + i * 10} x2={290} y2={150 + i * 10} stroke="#000" strokeOpacity={0.06} />
      ))}
      <rect x={250} y={78} width={18} height={44} fill={roof} />
      <polygon points="96,146 200,76 304,146" fill={roof} />
      {dormer && (
        <g>
          <polygon points="178,122 200,104 222,122" fill={roof} />
          <rect x={184} y={120} width={32} height={20} fill={siding} />
          <Window x={191} y={123} w={18} h={14} />
        </g>
      )}
      <Window x={128} y={162} />
      <Window x={250} y={162} />
      <Window x={128} y={206} />
      <Window x={250} y={206} />
      <rect x={176} y={196} width={48} height={8} fill="#ffffff" />
      <rect x={186} y={204} width={28} height={48} fill={door} />
      <circle cx={208} cy={229} r={2} fill="#f5d27a" />
      <rect x={170} y={252} width={60} height={6} fill="#d6d1c6" />
    </g>
  );
}

function Apartments({ seed }: { seed: number }) {
  const facade = pick(FACADES, seed);
  const accent = pick(ACCENTS, seed >>> 3);
  const floors = 3 + ((seed >>> 5) % 3);
  const top = 252 - floors * 40 - 6;
  const cols = 5;
  return (
    <g>
      <rect x={92} y={top} width={216} height={252 - top} fill={facade} />
      <rect x={88} y={top - 8} width={224} height={10} fill="#5e6470" />
      <rect x={250} y={top} width={36} height={252 - top} fill={accent} opacity={0.85} />
      {Array.from({ length: floors }, (_, f) =>
        Array.from({ length: cols }, (_, c) => {
          const x = 104 + c * 38;
          const y = top + 12 + f * 40;
          if (f === floors - 1 && c === 2) return null;
          return (
            <g key={`${f}-${c}`}>
              <Window x={x} y={y} w={22} h={22} />
              {(c + f + seed) % 3 === 0 && <rect x={x - 4} y={y + 22} width={30} height={4} fill="#4b505b" />}
            </g>
          );
        }),
      )}
      <rect x={176} y={216} width={48} height={8} fill={accent} />
      <rect x={186} y={224} width={28} height={28} fill="#2e3440" />
      <rect x={190} y={228} width={20} height={20} fill="#9cc3dd" opacity={0.6} />
    </g>
  );
}

function GroundsHall({ seed }: { seed: number }) {
  const brick = pick(['#a8432f', '#9b3d2b', '#b04a33'], seed);
  const shutters = (seed >>> 2) % 2 === 0 ? '#2b2f35' : '#3d4a3d';
  return (
    <g>
      <rect x={84} y={128} width={232} height={124} fill={brick} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={84} y1={136 + i * 10} x2={316} y2={136 + i * 10} stroke="#000" strokeOpacity={0.07} />
      ))}
      <rect x={80} y={120} width={240} height={10} fill="#f4f1ea" />
      <Window x={100} y={146} shutter={shutters} />
      <Window x={100} y={200} shutter={shutters} />
      <Window x={278} y={146} shutter={shutters} />
      <Window x={278} y={200} shutter={shutters} />
      {/* Portico: pediment and four columns */}
      <polygon points="146,124 200,92 254,124" fill="#f4f1ea" />
      <polygon points="158,120 200,98 242,120" fill="#e6e1d6" />
      <rect x={146} y={124} width={108} height={8} fill="#f4f1ea" />
      {[154, 178, 214, 238].map((x) => (
        <g key={x}>
          <rect x={x} y={132} width={9} height={112} fill="#fbfaf6" />
          <rect x={x - 2} y={132} width={13} height={4} fill="#e6e1d6" />
        </g>
      ))}
      <rect x={188} y={206} width={24} height={38} fill="#2b2f35" />
      <rect x={140} y={244} width={120} height={8} fill="#e6e1d6" />
    </g>
  );
}

/** A drawn picture of a place with no photo yet. `seed` (e.g. the property name) picks colors and details. */
export function PropertyIllustration({
  kind,
  seed,
  name,
  className,
  showLabel = true,
}: {
  kind: PropertyKind;
  seed: string;
  name: string;
  className?: string;
  showLabel?: boolean;
}) {
  const h = hash(seed);
  const [skyTop, skyBottom] = pick(SKIES, h >>> 7);
  const id = `sky-${h.toString(36)}`;
  return (
    <div className={cx('relative size-full', className)}>
      <svg
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        role="img"
        aria-label={`Illustration of ${name}. No photo yet.`}
        className="size-full"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={skyTop} />
            <stop offset="1" stopColor={skyBottom} />
          </linearGradient>
        </defs>
        <rect width={400} height={300} fill={`url(#${id})`} />
        <circle cx={60 + (h % 280)} cy={48} r={16} fill="#fff6d9" opacity={0.8} />
        <rect y={250} width={400} height={50} fill="#9cbf86" />
        <rect y={258} width={400} height={10} fill="#d6d1c6" />
        <Trees seed={h} />
        {kind === 'house' ? <House seed={h} /> : kind === 'on_grounds' ? <GroundsHall seed={h} /> : <Apartments seed={h} />}
      </svg>
      {showLabel && (
        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white">
          Illustration
        </span>
      )}
    </div>
  );
}

/** Seed photos and landlord placeholders point at /placeholder/*.svg: treat those as "no photo". */
export function isPlaceholderPhoto(url: string): boolean {
  return url.startsWith('/placeholder/');
}
