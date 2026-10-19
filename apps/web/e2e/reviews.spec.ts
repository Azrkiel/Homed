import { expect, test } from '@playwright/test';
import { createLandlordListing, landlordSignIn, signIn, studentEmail } from './helpers';

const TEXT_PUBLISHED = 'Quiet building, responsive maintenance team, and the walk to Grounds was easy.';
const TEXT_REJECTED = 'Mold in the bathroom and no one answered the phone for two weeks.';

/** Reviews sit in a collapsed section on the listing page; open it the way a student would. */
async function openReviews(page: import('@playwright/test').Page) {
  await page.locator('summary', { hasText: 'Reviews' }).click();
}

async function postReview(page: import('@playwright/test').Page, text: string) {
  await openReviews(page);
  await page.getByRole('combobox', { name: 'Noise (1 = loud, 5 = quiet)' }).selectOption('4');
  await page.getByRole('combobox', { name: 'Maintenance' }).selectOption('4');
  await page.getByRole('combobox', { name: 'Landlord responsiveness' }).selectOption('3');
  await page.getByRole('combobox', { name: 'Value for the price' }).selectOption('3');
  await page.getByRole('textbox', { name: 'Your review' }).fill(text);
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Your review is pending moderation')).toBeVisible();
}

test('reviews: student posts, admin rejects one and publishes one, landlord replies, reply shows on listing', async ({ browser }) => {
  test.setTimeout(240_000);
  const ctx = {
    landlord: await browser.newContext({ baseURL: 'http://localhost:3020' }),
    alice: await browser.newContext({ baseURL: 'http://localhost:3020' }),
    bob: await browser.newContext({ baseURL: 'http://localhost:3020' }),
    admin: await browser.newContext({ baseURL: 'http://localhost:3020' }),
    anon: await browser.newContext({ baseURL: 'http://localhost:3020' }),
  };
  try {
    const ll = await ctx.landlord.newPage();
    await landlordSignIn(ll, `landlord.${Date.now().toString(36)}@example.com`);
    await ll.getByRole('textbox', { name: 'Business or landlord name' }).fill('Review Rentals');
    await ll.getByRole('button', { name: 'Create landlord profile' }).click();
    const { floorPlanId } = await createLandlordListing(ll, { propertyName: 'Review Test House', planName: '3BR', rent: '900' });
    const listingPath = `/listings/${floorPlanId}`;

    // Students post; both land pending.
    const alice = await ctx.alice.newPage();
    await signIn(alice, { email: studentEmail('alice-rev'), name: 'Alice Reviewer', next: listingPath });
    await postReview(alice, TEXT_PUBLISHED);

    const bob = await ctx.bob.newPage();
    await signIn(bob, { email: studentEmail('bob-rev'), name: 'Bob Reviewer', next: listingPath });
    await postReview(bob, TEXT_REJECTED);

    // Signed out: the review link carries the listing path as next.
    const anon = await ctx.anon.newPage();
    await anon.goto(listingPath);
    await openReviews(anon);
    const signInLink = anon.getByRole('link', { name: 'Sign in with your @virginia.edu email to review' });
    await expect(signInLink).toHaveAttribute('href', `/signin?next=${encodeURIComponent(listingPath)}`);

    // Admin: reject Bob's review, publish Alice's.
    const admin = await ctx.admin.newPage();
    await signIn(admin, { email: 'admin@virginia.edu', name: 'Admin', next: '/admin/reviews' });
    const rejectedCard = admin.getByText(TEXT_REJECTED).locator('xpath=ancestor::*[.//button[normalize-space()="Reject"]][1]');
    await rejectedCard.getByRole('button', { name: 'Reject' }).click();
    await expect(admin.getByText(TEXT_REJECTED)).toHaveCount(0);
    const publishedCard = admin.getByText(TEXT_PUBLISHED).locator('xpath=ancestor::*[.//button[normalize-space()="Publish"]][1]');
    await publishedCard.getByRole('button', { name: 'Publish' }).click();
    await expect(admin.getByText(TEXT_PUBLISHED)).toHaveCount(0);

    // Landlord replies to the published review.
    await ll.goto('/landlord');
    const replyBox = ll.getByRole('textbox', { name: 'Reply to this review' }).first();
    await replyBox.fill('Thanks for the feedback. We fixed the heat schedule this week.');
    await ll.getByRole('button', { name: 'Post reply' }).click();
    await expect(ll.getByText('Thanks for the feedback. We fixed the heat schedule this week.')).toBeVisible();

    // Public listing: published review and the reply show; rejected one does not.
    await anon.goto(listingPath);
    await openReviews(anon);
    await expect(anon.getByText(TEXT_PUBLISHED)).toBeVisible();
    await expect(anon.getByText('Thanks for the feedback. We fixed the heat schedule this week.')).toBeVisible();
    await expect(anon.getByText(TEXT_REJECTED)).toHaveCount(0);
  } finally {
    for (const c of Object.values(ctx)) await c.close();
  }
});
