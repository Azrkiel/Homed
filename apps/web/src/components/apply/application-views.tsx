// Presentational pieces for the tracker pages. Server-rendered: MemberList only renders what the viewer may see.
import type { ReactNode } from 'react';
import {
  memberStatusViews,
  statusLabel,
  type Application,
  type ApplicationMember,
  type ApplicationStatus,
  type FeeQuote,
  type Listing,
} from '@homed/core';
import { Alert, Badge } from '@/components/ui';
import { inviteUrl, trackerView } from '@/lib/apply/tracker';
import { moneyPrecise, plural, localDate, shortDate } from '@/lib/format';
import { applicationStatusTone } from './application-logic';

export function placeName(listing: Listing | null | undefined): string {
  return listing ? `${listing.property.name} ${listing.floorPlan.name}` : 'No longer listed';
}

export function StatusChip({ status }: { status: ApplicationStatus }) {
  return <Badge tone={applicationStatusTone(status)}>{statusLabel(status).label}</Badge>;
}

const KIND_LABELS: Record<ApplicationMember['kind'], string> = {
  leader: 'Leader',
  roommate: 'Roommate',
  guarantor: 'Guarantor',
};

/**
 * Members as done / not done. Roommates get names and done only. The leader view also shows invite links
 * for unfinished invitees (the only place emails and tokens are rendered). origin '' gives relative links.
 */
export function MemberList({
  members,
  leaderView,
  origin,
}: {
  members: readonly ApplicationMember[];
  leaderView: boolean;
  origin: string;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <ul className="grid gap-3">
      {memberStatusViews([...members]).map((v) => {
        const row = byId.get(v.memberId);
        const showInvite = leaderView && row !== undefined && row.kind !== 'leader' && !v.done;
        return (
          <li key={v.memberId} className="grid gap-2 rounded-sm border border-line bg-surface-2 px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium text-ink">
                {v.name} <span className="font-normal text-ink-2">· {KIND_LABELS[v.kind]}</span>
              </span>
              <Badge tone={v.done ? 'good' : 'warn'}>{v.done ? 'Done' : 'Not done'}</Badge>
            </div>
            {showInvite && row && (
              <div className="grid gap-1.5">
                <p className="text-sm text-ink-2">Send this link to {row.email}. It is their own link, so keep it private.</p>
                <label htmlFor={`invite-${row.id}`} className="text-sm font-medium text-ink">
                  Invite link for {v.name}
                </label>
                <input
                  id={`invite-${row.id}`}
                  readOnly
                  value={inviteUrl(origin, row.inviteToken)}
                  className="h-10 w-full rounded-sm border border-line bg-surface px-3 font-mono text-xs text-ink"
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Lines per person, total for the people on the application, and Virginia fee warnings. */
export function FeeSummary({ fees }: { fees: FeeQuote }) {
  return (
    <div className="grid gap-3 text-sm">
      {fees.perPerson.length === 0 ? (
        <p className="text-ink-2">No application fees for this place.</p>
      ) : (
        <ul className="grid gap-1.5">
          {fees.perPerson.map((line) => (
            <li key={line.label} className="flex justify-between gap-3">
              <span className="text-ink-2">
                {line.label} <span className="text-ink-3">({line.refundable ? 'refundable' : 'nonrefundable'})</span>
              </span>
              <span className="font-medium text-ink">{moneyPrecise(line.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-ink-2">
        {moneyPrecise(fees.perPersonTotal)} per person for {plural(fees.people, 'person', 'people')} ={' '}
        <strong className="text-ink">{moneyPrecise(fees.applicationTotal)}</strong>
      </p>
      {fees.complianceIssues.map((message) => (
        <Alert key={message} tone="warn">
          {message}
        </Alert>
      ))}
    </div>
  );
}

/** Progress through TRACKER_STEPS for one application. */
export function TrackerSteps({ app }: { app: Application }): ReactNode {
  const { steps, terminal } = trackerView(app);
  return (
    <div className="grid gap-4">
      <ol className="grid gap-3 sm:grid-cols-5">
        {steps.map((step, i) => (
          <li
            key={step.status}
            aria-current={step.state === 'current' ? 'step' : undefined}
            className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-1.5"
          >
            <span
              className={
                step.state === 'done'
                  ? 'grid size-7 shrink-0 place-items-center rounded-full bg-good text-xs font-semibold text-accent-ink'
                  : step.state === 'current'
                    ? 'grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-ink'
                    : 'grid size-7 shrink-0 place-items-center rounded-lg border border-line bg-surface text-xs font-semibold text-ink-2'
              }
            >
              {i + 1}
            </span>
            <span className="grid">
              <span className={step.state === 'upcoming' ? 'text-sm text-ink-2' : 'text-sm font-medium text-ink'}>
                {step.label}
              </span>
              <span className="text-xs text-ink-2">
                {step.state === 'done' ? 'Done' : step.state === 'current' ? 'Now' : ''}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {terminal && <Alert tone={terminal === 'denied' ? 'bad' : 'info'} title={statusLabel(app.status).label}>{statusLabel(app.status).detail}</Alert>}
    </div>
  );
}

/** Every status change with its date (calendar day only). */
export function StatusTimeline({ history }: { history: Application['statusHistory'] }) {
  return (
    <ol className="grid gap-2 text-sm">
      {history.map((h, i) => (
        <li key={`${h.status}-${h.at}-${i}`} className="flex flex-wrap justify-between gap-2 border-b border-line pb-2 last:border-0">
          <span className="font-medium text-ink">{statusLabel(h.status).label}</span>
          <time dateTime={h.at} className="text-ink-2">
            {shortDate(localDate(h.at))}
          </time>
        </li>
      ))}
    </ol>
  );
}
