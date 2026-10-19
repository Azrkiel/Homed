import type { OnGroundsInfo } from '@homed/core';
import { Alert } from '@/components/ui';
import { shortDate } from '@/lib/format';

/** On-Grounds housing box: eligibility, application dates and the HRL page. */
export function OnGroundsBox({ info }: { info: OnGroundsInfo | undefined }) {
  return (
    <Alert tone="info" title="On-Grounds housing">
      {info ? (
        <div className="grid gap-1">
          <p>{info.eligibility}</p>
          <p>
            {info.applicationOpens ? `Applications open ${shortDate(info.applicationOpens)}. ` : ''}
            {info.applicationDeadline ? `Deadline ${shortDate(info.applicationDeadline)}.` : 'No deadline listed.'}
          </p>
          <p>
            <a href={info.hrlUrl} className="font-medium text-info underline underline-offset-2" target="_blank" rel="noreferrer">
              Housing &amp; Residence Life page
            </a>
          </p>
        </div>
      ) : (
        <p>This is on-Grounds housing run by UVA Housing &amp; Residence Life. Check HRL for eligibility and dates.</p>
      )}
    </Alert>
  );
}
