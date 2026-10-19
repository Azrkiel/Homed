import { expect, type Page } from '@playwright/test';

let counter = 0;
/** A unique student email per test so runs never share saves, classes or applications. */
export function studentEmail(tag: string): string {
  counter += 1;
  return `${tag}.${Date.now().toString(36)}${counter}@virginia.edu`;
}

/** Demo sign-in through the real form. Lands on `next` (or /landlord for landlords). */
export async function signIn(page: Page, opts: { email: string; name?: string; role?: 'student' | 'landlord'; next?: string }) {
  const query = opts.next ? `?next=${encodeURIComponent(opts.next)}` : '';
  await page.goto(`/signin${query}`);
  await page.getByRole('radio', { name: opts.role === 'landlord' ? 'Landlord' : 'Student' }).check();
  await page.getByRole('textbox', { name: 'Email' }).fill(opts.email);
  if (opts.name) await page.getByRole('textbox', { name: 'Name' }).fill(opts.name);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/signin'));
}

/** Path of the first listing link on /search (a real floor plan id from the seed). */
export async function firstListingPath(page: Page): Promise<string> {
  await page.goto('/search');
  const href = await page.locator('a[href^="/listings/"]').first().getAttribute('href');
  expect(href, 'a listing link on /search').toBeTruthy();
  return href!.split('?')[0]!;
}

/** Landlord demo sign-in (any email). Lands on the onboarding form for a new landlord. */
export async function landlordSignIn(page: Page, email: string, name = 'Lee Landlord') {
  await signIn(page, { email, name, role: 'landlord', next: '/landlord' });
}

/**
 * Landlord creates a property with a map-click pin and one floor plan, all through the UI.
 * Returns the ids the students and the landlord inbox use.
 */
export async function createLandlordListing(
  page: Page,
  opts: { propertyName: string; planName: string; rent: string },
): Promise<{ propertyId: string; floorPlanId: string }> {
  await page.goto('/landlord/properties/new');
  await page.getByRole('textbox', { name: 'Property name' }).fill(opts.propertyName);
  await page.getByRole('textbox', { name: 'Street address' }).fill('100 Test Way, Charlottesville, VA 22903');
  await page.getByRole('textbox', { name: 'Neighborhood' }).fill('Rugby Road');
  // Click the map to drop the pin (the tiles may not load offline; the click still sets lat/lng).
  await page.locator('.leaflet-container').first().click({ position: { x: 160, y: 120 } });
  await expect(page.getByText(/^Pin at /)).toBeVisible();
  await page.getByRole('button', { name: 'Create property' }).click();
  await page.waitForURL(/\/landlord\/properties\/[^/?#]+\?created=1/);
  const propertyId = new URL(page.url()).pathname.split('/')[3]!;

  await page.getByRole('textbox', { name: 'Floor plan name' }).fill(opts.planName);
  await page.getByRole('spinbutton', { name: 'Bedrooms' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Bathrooms' }).fill('2');
  await page.getByRole('spinbutton', { name: 'Rent (USD per month)' }).fill(opts.rent);
  await page.getByLabel('Lease start').fill('2027-08-01');
  await page.getByLabel('Lease end').fill('2028-07-31');
  await page.getByRole('button', { name: 'Add floor plan' }).click();
  await expect(page.getByText('Floor plan added.')).toBeVisible();

  // The dashboard links each floor plan to its editor anchor; the anchor id carries the floor plan id.
  await page.goto('/landlord');
  const link = page.locator(`a[href*="/landlord/properties/${propertyId}#floor-plan-"]`).first();
  const href = await link.getAttribute('href');
  const floorPlanId = href!.split('#floor-plan-')[1]!;
  return { propertyId, floorPlanId };
}

/** Student profile with the four required fields, saved through the form. */
export async function fillApplicantProfile(page: Page, legalName: string) {
  await page.goto('/profile/applicant');
  await page.getByRole('textbox', { name: /^Legal name/ }).fill(legalName);
  await page.getByRole('textbox', { name: 'Phone', exact: true }).fill('(434) 555-0100');
  await page.getByRole('textbox', { name: /^Current address/ }).fill('1 Student Way, Charlottesville');
  await page.getByRole('combobox', { name: /^Student status/ }).selectOption('undergraduate');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Your applicant profile is up to date.')).toBeVisible();
}

/** Solo application to one place: builder -> attach profile -> submit. Profile must already be complete. */
export async function applySolo(page: Page, floorPlanId: string) {
  await page.goto(`/apply/new?fp=${floorPlanId}`);
  await page.getByRole('button', { name: 'Send application' }).click();
  await page.waitForURL(/\/applications\/batch\/[^/?#]+$/);
  await page.getByRole('button', { name: 'Attach my profile and mark my part done' }).click();
  await page.getByRole('button', { name: 'Submit 1 application' }).click();
  await expect(page.getByRole('button', { name: 'Submit 1 application' })).toHaveCount(0);
}
