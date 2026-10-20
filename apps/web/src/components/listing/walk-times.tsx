import Link from 'next/link';
import { Badge, Card, CardBody, Disclosure } from '@/components/ui';
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

/** Walk times: the student's classes, the key spots around Grounds, and the rest folded away. */
export function WalkTimes({
  classes,
  landmarks,
  hasClasses,
  signedIn,
  busNote,
  nextPath: _nextPath,
}: {
  classes: WalkRow[];
  landmarks: WalkRow[];
  /** The user has a schedule or major with class buildings. */
  hasClasses: boolean;
  signedIn: boolean;
  busNote: string;
  nextPath: string;
}) {
  const key = landmarks.filter((r) => r.highlight);
  const rest = landmarks.filter((r) => !r.highlight);
  const classesHref = signedIn ? '/classes' : '/signin?next=%2Fclasses';
  return (
    <Card as="section">
      <CardBody className="grid gap-4">
        <h2 className="text-lg font-semibold text-ink">Walk times</h2>

        {classes.length > 0 ? (
          <WalkList rows={classes} label="Walk times to your classes" />
        ) : hasClasses ? (
          <p className="text-sm text-ink-2">No walk data for your class buildings yet.</p>
        ) : (
          <Link href={classesHref} className="w-fit text-sm font-medium text-navy underline underline-offset-2">
            Add your classes
          </Link>
        )}

        {key.length > 0 && <WalkList rows={key} label="Walk times to places around Grounds" />}
        {rest.length > 0 && (
          <Disclosure title="More places" meta={rest.length} className="-mb-4">
            <WalkList rows={rest} label="Walk times to more places" />
          </Disclosure>
        )}
        <p className="text-xs text-ink-3">{busNote}</p>
      </CardBody>
    </Card>
  );
}
