import Link from 'next/link';
import { isStale, type CompareRow, type ISODate, type RankedListing } from '@homed/core';
import { ScoreRing, cx } from '@/components/ui';
import { PhotoOrPlaceholder } from '@/components/listing/photo-or-placeholder';
import { SaveToggle } from '@/components/listing/save-toggle';
import { compareHref, withoutId } from '@/lib/search/compare';

/** Side-by-side table. Best cells carry a token background, a check mark and hidden "(best)" text. */
export function CompareTable({
  items,
  rows,
  ids,
  savedIds,
  today,
  nextPath,
}: {
  items: RankedListing[];
  rows: CompareRow[];
  ids: string[];
  savedIds: ReadonlySet<string>;
  today: ISODate;
  nextPath: string;
}) {
  return (
    <div
      role="region"
      aria-label="Comparison table, scrolls sideways on small screens"
      tabIndex={0}
      className="overflow-x-auto rounded-card border border-line bg-surface shadow-card focus-visible:outline-2 focus-visible:outline-focus"
    >
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="px-4 py-3 text-left text-base font-semibold text-ink">
          Side-by-side comparison
          <span className="block text-sm font-normal text-ink-2">
            Best values in each row are marked with a check and a green background.
          </span>
        </caption>
        <thead>
          <tr>
            <td className="sticky left-0 z-10 w-28 min-w-28 border-t border-line bg-surface sm:w-40 sm:min-w-40" />
            {items.map(({ listing, score }) => {
              const { property, floorPlan, photos } = listing;
              const name = `${property.name} ${floorPlan.name}`;
              const stale = isStale(floorPlan.lastVerified, today);
              return (
                <th
                  key={floorPlan.id}
                  scope="col"
                  className="min-w-40 border-l border-t border-line bg-surface p-3 align-top font-normal"
                >
                  <div className="grid gap-2">
                    <PhotoOrPlaceholder photos={photos} name={property.name} dimmed={stale} className="rounded-sm" />
                    <Link
                      href={`/listings/${floorPlan.id}`}
                      className="font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {property.name}
                      <span className="block font-normal text-ink-2">{floorPlan.name}</span>
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                      <ScoreRing score={score.total} size="sm" />
                      <SaveToggle
                        floorPlanId={floorPlan.id}
                        name={name}
                        saved={savedIds.has(floorPlan.id)}
                        signedIn
                        nextPath={nextPath}
                      />
                    </div>
                    <Link
                      href={compareHref(withoutId(ids, floorPlan.id))}
                      className="text-xs text-ink-2 underline underline-offset-2 hover:text-ink"
                    >
                      Remove from compare<span className="sr-only">: {name}</span>
                    </Link>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-t border-line bg-surface p-3 text-left font-medium text-ink-2"
              >
                {row.label}
              </th>
              {row.cells.map((cell, i) => (
                <td
                  key={items[i]?.listing.floorPlan.id ?? i}
                  className={cx(
                    'border-l border-t border-line p-3 tabular-nums',
                    cell.best ? 'bg-good-soft font-semibold text-ink' : 'text-ink',
                  )}
                >
                  {cell.best && (
                    <span aria-hidden="true" className="mr-1 text-good">
                      &#10003;
                    </span>
                  )}
                  {cell.display}
                  {cell.best && <span className="sr-only"> (best)</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
