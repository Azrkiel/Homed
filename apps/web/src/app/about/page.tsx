import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { STALE_AFTER_DAYS, STUDENT_LEGAL_SERVICES } from '@homed/core';
import { loadSeed } from '@homed/data';
import { PageHeader } from '@/components/ui';
import { shortDate } from '@/lib/format';

export const metadata: Metadata = { title: 'About Homed | Homed' };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h2 id={id} className="text-xl font-semibold text-ink">
        {title}
      </h2>
      <div className="grid gap-2 text-ink-2">{children}</div>
    </section>
  );
}

const LINK = 'text-accent underline underline-offset-2';

export default function AboutPage() {
  const meta = loadSeed().meta as unknown as Record<string, unknown>;
  const notes = typeof meta.notes === 'string' ? meta.notes : null;
  const version = typeof meta.version === 'string' ? meta.version : null;
  const generatedAt = typeof meta.generatedAt === 'string' ? meta.generatedAt : null;
  // Render any extra string-ish fields the seed meta carries (e.g. sources), without assuming a shape.
  const extras = Object.entries(meta).filter(
    ([k, v]) => !['notes', 'version', 'generatedAt'].includes(k) && (typeof v === 'string' || Array.isArray(v)),
  );

  return (
    <div className="grid max-w-3xl gap-8">
      <PageHeader
        title="About Homed"
        subtitle="How the data is gathered, how listings are ranked, and what we will never do."
        className="pb-0"
      />

      <Section id="data" title="Where the data comes from">
        <p>{notes ?? 'This catalog is assembled by hand from public sources.'}</p>
        <p className="text-sm">
          {version && <>Dataset version {version}. </>}
          {generatedAt && <>Assembled {shortDate(generatedAt)}.</>}
        </p>
        {extras.map(([k, v]) => (
          <p key={k} className="text-sm">
            <span className="font-medium text-ink">{k}:</span> {Array.isArray(v) ? v.map(String).join(', ') : String(v)}
          </p>
        ))}
      </Section>

      <Section id="fresh" title="How fresh is it">
        <p>
          Every listing shows when it was last verified. Listings not re-verified in {STALE_AFTER_DAYS} days are dimmed and marked, so you
          know to confirm price and availability with the landlord.
        </p>
      </Section>

      <Section id="score" title="How Best Match works">
        <p>
          Best Match blends three things: all-in price per person, location (walk time to your classes and the places you care about), and
          looks (student ratings of real photos). You set the balance. Hard filters, like budget or bedrooms, remove places outright and are
          never traded off against the score.
        </p>
        <p className="font-medium text-ink">Paid placement never changes the Best Match score.</p>
      </Section>

      <Section id="fair" title="Fair housing">
        <p>
          No filters on protected classes. Homed does not let anyone search, sort or screen by race, religion, sex, disability status,
          family status, national origin or any other protected class.
        </p>
      </Section>

      <Section id="photos" title="Photos">
        <p>
          We do not copy landlord photos. Renderings are flagged as renderings, and any Wikimedia Commons images are credited to their
          authors.
        </p>
      </Section>

      <Section id="classes" title="Class data">
        <p>
          We do not scrape Lou&apos;s List or SIS. Your classes are entered by you, by hand, and used only to compute walk times for your
          results.
        </p>
      </Section>

      <Section id="maps" title="Maps">
        <p>
          Map data &copy;{' '}
          <a className={LINK} href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            OpenStreetMap
          </a>{' '}
          contributors.
        </p>
      </Section>

      <Section id="legal" title="Before you sign">
        <p>
          Applying is not signing, but a signed lease is binding. {STUDENT_LEGAL_SERVICES.blurb}{' '}
          <a className={LINK} href={STUDENT_LEGAL_SERVICES.url} target="_blank" rel="noopener noreferrer">
            {STUDENT_LEGAL_SERVICES.name}
          </a>
        </p>
      </Section>
    </div>
  );
}
