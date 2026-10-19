import Link from 'next/link';
import { Badge, Card, CardBody } from '@/components/ui';
import { minutes } from '@/lib/format';
import type { WalkRow } from '@/lib/search/listing-detail';

function WalkList({ rows, label }: { rows: WalkRow[]; label: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-line text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
          <span className={r.highlight ? 'font-medium text-ink' : 'text-ink'}>{r.name}</span>
          <span className="text-ink-2 tabular-nums">
            {minutes(r.walkMinutes)} walk
            {r.busMinutes !== null && r.busMinutes < r.walkMinutes ? `, ${minutes(r.busMinutes)} by bus` : ''}
            {r.estimated && <span className="ml-1.5"><Badge>estimated</Badge></span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Walk times to the student's class buildings and to landmarks, plus the bus note. */
export function WalkTimes({
  classes,
  landmarks,
  hasClasses,
  signedIn,
  busNote,
  nextPath,
}: {
  classes: WalkRow[];
  landmarks: WalkRow[];
  /** The user has a schedule or major with class buildings. */
  hasClasses: boolean;
  signedIn: boolean;
  busNote: string;
  nextPath: string;
}) {
  const unavailable = classes.length === 0 && landmarks.length === 0;
  return (
    <Card as="section">
      <CardBody className="grid gap-4">
        <h2 className="text-xl font-semibold text-ink">Walk times</h2>

        <div className="grid gap-1">
          <h3 className="font-semibold text-ink">To your classes</h3>
          {classes.length > 0 ? (
            <WalkList rows={classes} label="Walk times to your classes" />
          ) : hasClasses ? (
            <p className="text-sm text-ink-2">Walk times unavailable for your class buildings.</p>
          ) : signedIn ? (
            <p className="text-sm text-ink-2">
              <Link href="/settings" className="font-medium text-accent underline underline-offset-2">
                Add your classes
              </Link>{' '}
              to see the walk to each building.
            </p>
          ) : (
            <p className="text-sm text-ink-2">
              <Link
                href={`/signin?next=${encodeURIComponent(nextPath)}`}
                className="font-medium text-accent underline underline-offset-2"
              >
                Sign in and add your classes
              </Link>{' '}
              to see the walk to each building.
            </p>
          )}
        </div>

        <div className="grid gap-1">
          <h3 className="font-semibold text-ink">To landmarks</h3>
          {landmarks.length > 0 ? (
            <WalkList rows={landmarks} label="Walk times to landmarks" />
          ) : (
            <p className="text-sm text-ink-2">No landmark walk times for this building.</p>
          )}
        </div>

        {unavailable && <p className="text-sm font-medium text-warn">Walk times unavailable for this building.</p>}
        <p className="text-sm text-ink-2">{busNote}</p>
      </CardBody>
    </Card>
  );
}
