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
  await page.getByLabel('Email').fill(opts.email);
  if (opts.name) await page.getByLabel('Name (optional)').fill(opts.name);
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
