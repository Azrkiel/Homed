import { expect, test } from '@playwright/test';
import { applySolo, createLandlordListing, fillApplicantProfile, landlordSignIn, signIn, studentEmail } from './helpers';

test('landlord: onboarding, map-click property, floor plan, availability, inbox, application PDF', async ({ browser }) => {
  test.setTimeout(240_000);
  const landlordCtx = await browser.newContext({ baseURL: 'http://localhost:3020' });
  const studentCtx = await browser.newContext({ baseURL: 'http://localhost:3020' });
  try {
    const ll = await landlordCtx.newPage();
    const st = await studentCtx.newPage();

    // Onboarding: a new landlord lands on the profile form.
    await landlordSignIn(ll, `landlord.${Date.now().toString(36)}@example.com`);
    await ll.getByRole('textbox', { name: 'Business or landlord name' }).fill('Lee Rentals');
    await ll.getByRole('button', { name: 'Create landlord profile' }).click();
    await expect(ll.getByRole('heading', { level: 1, name: 'Landlord dashboard' })).toBeVisible();

    // Property with a map-click pin, plus its first floor plan.
    const { propertyId, floorPlanId } = await createLandlordListing(ll, {
      propertyName: 'Lee Test Flats',
      planName: '2BR / 2BA',
      rent: '1600',
    });
    expect(floorPlanId).toMatch(/^[0-9a-f-]{36}$/);

    // Availability: confirm units on the dashboard.
    await ll.goto('/landlord');
    await ll.getByRole('spinbutton', { name: 'Units available, 2BR / 2BA' }).fill('3');
    await ll.getByRole('button', { name: 'Confirm availability' }).click();
    await expect(ll.getByText(/ · 3 available$/)).toBeVisible();

    // A student applies to the new place.
    await signIn(st, { email: studentEmail('applicant'), name: 'Pat Applicant', next: '/' });
    await fillApplicantProfile(st, 'Pat Applicant');
    await applySolo(st, floorPlanId);

    // Landlord inbox: start review, approve, send lease.
    await ll.goto('/landlord/applications');
    await ll.locator('a[href^="/landlord/applications/"]').first().click();
    await ll.getByRole('button', { name: 'Start review' }).click();
    await ll.getByRole('button', { name: 'Approve' }).click();
    await ll.getByRole('button', { name: 'Send lease' }).click();
    await expect(ll.getByRole('button', { name: 'Send lease' })).toHaveCount(0);

    // Application PDF download.
    const pdfLink = ll.getByRole('link', { name: 'Download packet (PDF)' }).or(ll.getByRole('button', { name: 'Download packet (PDF)' }));
    const href = await pdfLink.getAttribute('href');
    expect(href).toMatch(/\/api\/applications\/[^/]+\/pdf$/);
    const response = await ll.request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');

    // Property page still reachable for this landlord.
    await ll.goto(`/landlord/properties/${propertyId}`);
    await expect(ll.getByRole('heading', { name: 'Lee Test Flats' }).first()).toBeVisible();
  } finally {
    await landlordCtx.close();
    await studentCtx.close();
  }
});
