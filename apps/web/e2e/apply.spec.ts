import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createLandlordListing, fillApplicantProfile, landlordSignIn, signIn, studentEmail } from './helpers';

const BASE = 'http://localhost:3020';

/** A small one-page PDF, written once per run. */
function samplePdf(): string {
  const path = join(tmpdir(), 'homed-e2e-proof-of-income.pdf');
  writeFileSync(
    path,
    '%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n',
  );
  return path;
}

/** Every "Invite link for ..." field on the page, as absolute URLs. */
async function inviteLinks(page: Page): Promise<string[]> {
  return page.locator('input[readonly][id^="invite-"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
}

/** Ticks every item in the lease checklist by clicking its label, the way a student would. */
async function tickLeaseChecklist(page: Page) {
  const section = page.locator('section').filter({ hasText: 'Sign the lease' });
  const boxes = section.getByRole('checkbox');
  const n = await boxes.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const id = (await boxes.nth(i).getAttribute('id'))!;
    await page.locator(`label[for="${id}"]`).click();
  }
}

test('apply: profile, 2-place batch with roommate and guarantor, submit, landlord approves one, withdraw the other, sign lease', async ({ browser }) => {
  test.setTimeout(420_000);
  const contexts: BrowserContext[] = [];
  const open = async () => {
    const c = await browser.newContext({ baseURL: BASE });
    contexts.push(c);
    return c;
  };
  try {
    // Landlord owns both places.
    const ll = await (await open()).newPage();
    await landlordSignIn(ll, `landlord.apply.${Date.now().toString(36)}@example.com`);
    await ll.getByRole('textbox', { name: 'Business or landlord name' }).fill('Apply Rentals');
    await ll.getByRole('button', { name: 'Create landlord profile' }).click();
    await expect(ll.getByRole('heading', { level: 1, name: 'Landlord dashboard' })).toBeVisible();
    const a = await createLandlordListing(ll, { propertyName: 'Apply Test House A', planName: '2BR / 2BA', rent: '1500' });
    const b = await createLandlordListing(ll, { propertyName: 'Apply Test House B', planName: '3BR / 2BA', rent: '1200' });

    // Leader (Pat): profile with rental history and a reference.
    const leader = await (await open()).newPage();
    await signIn(leader, { email: studentEmail('leader'), name: 'Pat Leader', next: '/profile/applicant' });
    await fillApplicantProfile(leader, 'Pat Leader');

    const rental = leader.getByRole('group', { name: /Rental history/ });
    await rental.getByRole('textbox', { name: 'Address' }).first().fill('12 Rugby Rd, Charlottesville');
    await rental.getByRole('textbox', { name: 'Landlord name' }).first().fill('Old Landlord');
    await rental.getByRole('textbox', { name: 'Start date' }).first().fill('2024-08-01');
    const refs = leader.getByRole('group', { name: /References/ });
    await refs.getByRole('textbox', { name: 'Name' }).first().fill('Dr. Ref Person');
    await refs.getByRole('textbox', { name: 'Phone or email' }).first().fill('ref@example.com');
    await refs.getByRole('textbox', { name: 'How you know them' }).first().fill('Former supervisor');
    await leader.getByRole('button', { name: 'Save profile' }).click();
    await expect(leader.getByText('Your applicant profile is up to date.')).toBeVisible();

    // Roommate (Bo) needs an account and a profile of their own.
    const booEmail = studentEmail('roommate');
    const boo = await (await open()).newPage();
    await signIn(boo, { email: booEmail, name: 'Bo Roommate', next: '/' });
    await fillApplicantProfile(boo, 'Bo Roommate');

    // Leader builds a 2-place batch: both places, a roommate, a guarantor.
    const guarantorEmail = 'gina.guarantor@example.com';
    await leader.goto(`/apply/new?fp=${a.floorPlanId}&fp=${b.floorPlanId}`);
    await leader.getByRole('textbox', { name: 'Roommate 1 email' }).fill(booEmail);
    await leader.getByRole('textbox', { name: 'Guarantor 1 email' }).fill(guarantorEmail);
    await leader.getByRole('textbox', { name: 'Name', exact: true }).nth(0).fill('Gina Guarantor');
    await leader.getByRole('combobox', { name: 'Guarantees' }).first().selectOption({ index: 1 });
    await leader.getByRole('button', { name: 'Send 2 applications' }).click();
    await leader.waitForURL(/\/applications\/batch\/[^/?#]+$/);
    const batchPath = new URL(leader.url()).pathname;

    // Documents unlock once the leader has started an application: upload a small PDF.
    await leader.goto('/profile/applicant');
    await leader.locator('#document-file').setInputFiles(samplePdf());
    await leader.getByRole('button', { name: 'Upload document' }).click();
    await expect(leader.getByText('Your file is stored encrypted.')).toBeVisible();

    // Back to the batch: the leader attaches their own profile, then the invites are finished.
    await leader.goto(batchPath);
    await leader.getByRole('button', { name: 'Attach my profile and mark my part done' }).click();
    await leader.reload();
    const links = await inviteLinks(leader);
    expect(links.length).toBeGreaterThanOrEqual(2);

    for (const link of links) {
      const path = new URL(link).pathname;
      // Guarantors get a public page; roommates are sent to sign-in first.
      // One completion covers the person's rows on every application in the batch, so the second
      // link for the same roommate or guarantor already shows "Your part is done."
      const probe = await (await open()).newPage();
      await probe.goto(path);
      const isGuarantor = await probe.getByRole('heading', { name: 'Guarantor agreement' }).isVisible().catch(() => false);
      if (isGuarantor && (await probe.getByText('Your part is done.').isVisible())) {
        // Already signed through the guarantor's first link.
      } else if (isGuarantor) {
        await probe.getByRole('textbox', { name: 'Your full name', exact: true }).fill('Gina Guarantor');
        await probe.getByRole('textbox', { name: /How you are related/ }).fill('Parent');
        await probe.getByRole('textbox', { name: 'Type your full name to sign' }).fill('Gina Guarantor');
        const consentId = (await probe.getByRole('checkbox', { name: /I agree to guarantee/ }).getAttribute('id'))!;
        await probe.locator(`label[for="${consentId}"]`).click();
        await probe.getByRole('button', { name: 'Sign and mark my part done' }).click();
        await expect(probe.getByText('Your part is done.')).toBeVisible();
      } else {
        await boo.goto(path);
        const done = boo.getByText('Your part is done.');
        if (!(await done.isVisible())) {
          await boo.getByRole('button', { name: 'Attach my profile and mark my part done' }).click();
        }
        await expect(done).toBeVisible();
      }
      await probe.close();
    }

    // Leader submits both applications.
    await leader.reload();
    await leader.getByRole('button', { name: 'Submit 2 applications' }).click();
    await expect(leader.getByRole('button', { name: 'Submit 2 applications' })).toHaveCount(0);

    // Application ids for each place, from the batch page links.
    const hrefs = await leader.locator('a[href^="/applications/"]:not([href*="batch"])').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href') ?? ''),
    );
    const ids = [...new Set(hrefs.map((h) => h.split('/')[2]!).filter(Boolean))];
    expect(ids.length).toBe(2);

    // Landlord moves the first application to lease_sent through the inbox.
    const approvedId = ids[0]!;
    const otherId = ids[1]!;
    await ll.goto(`/landlord/applications/${approvedId}`);
    await ll.getByRole('button', { name: 'Start review' }).click();
    await ll.getByRole('button', { name: 'Approve' }).click();
    await ll.getByRole('button', { name: 'Send lease' }).click();
    await expect(ll.getByRole('button', { name: 'Send lease' })).toHaveCount(0);

    // Leader: withdraw the other place (confirm dialog accepted).
    await leader.goto(`/applications/${otherId}`);
    await expect(leader.getByRole('heading', { name: 'Withdraw' })).toBeVisible();
    leader.once('dialog', (d) => d.accept());
    await leader.getByRole('button', { name: 'Withdraw this application' }).click();
    await expect(leader.getByRole('button', { name: 'Withdraw this application' })).toHaveCount(0);

    // Sign the lease: tick every item, then sign.
    await leader.goto(`/applications/${approvedId}`);
    const signButton = leader.getByRole('button', { name: 'I signed the lease' });
    await expect(signButton).toBeDisabled();
    await tickLeaseChecklist(leader);
    await expect(signButton).toBeEnabled();
    await signButton.click();
    await expect(leader.getByRole('button', { name: 'I signed the lease' })).toHaveCount(0);
  } finally {
    for (const c of contexts) await c.close();
  }
});
