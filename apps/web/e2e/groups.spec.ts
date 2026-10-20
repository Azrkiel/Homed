import { expect, test } from '@playwright/test';
import { signIn, studentEmail } from './helpers';

test('group: create, copy invite, join, vote, both swipe yes, match banner; outsider gets 404', async ({ browser }) => {
  test.setTimeout(240_000);
  const alice = await browser.newContext({ baseURL: 'http://localhost:3020' });
  const bob = await browser.newContext({ baseURL: 'http://localhost:3020' });
  const carol = await browser.newContext({ baseURL: 'http://localhost:3020' });
  try {
    const a = await alice.newPage();
    const b = await bob.newPage();
    const c = await carol.newPage();

    // Alice creates the group.
    await signIn(a, { email: studentEmail('alice'), name: 'Alice Group', next: '/groups' });
    await a.getByRole('textbox', { name: 'Group name' }).fill('Crew Test');
    await a.getByRole('button', { name: 'Create group' }).click();
    await expect(a).toHaveURL(/\/groups\/[^/?#]+$/);
    const groupPath = new URL(a.url()).pathname;

    // Copy the invite link: the copy button is in the page, the link is the read-only field.
    await a.getByRole('button', { name: 'Copy link' }).click();
    const invite = await a.locator('input[readonly]').first().inputValue();
    expect(invite).toMatch(/\/groups\/join\//);
    const joinPath = new URL(invite).pathname;

    // Alice adds two places from Browse as a group.
    await a.goto(`${groupPath}/browse`);
    const addButtons = a.getByRole('button', { name: /^Add .* to the shortlist$/ });
    await addButtons.nth(0).click();
    await expect(a.getByRole('button', { name: /is on the shortlist$/ })).toHaveCount(1);
    await addButtons.nth(0).click();
    await expect(a.getByRole('button', { name: /is on the shortlist$/ })).toHaveCount(2);

    // Bob joins with the invite link.
    await signIn(b, { email: studentEmail('bob'), name: 'Bob Group', next: joinPath });
    await b.getByRole('button', { name: 'Join group' }).click();
    await expect(b).toHaveURL(new RegExp(`${groupPath}$`));

    // Carol is not a member: 404.
    await signIn(c, { email: studentEmail('carol'), name: 'Carol Outsider', next: '/groups' });
    const outsider = await c.goto(groupPath);
    expect(outsider?.status()).toBe(404);

    // Both vote yes on the shortlist.
    await a.goto(groupPath);
    await b.goto(groupPath);
    const voteNames = await a.getByRole('button', { name: /^Vote yes on / }).evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label') ?? ''),
    );
    expect(voteNames).toHaveLength(2);
    for (const label of voteNames) {
      await a.getByRole('button', { name: label }).click();
      await expect(a.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
      await b.getByRole('button', { name: label }).click();
      await expect(b.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true');
    }

    // Group Match: both swipe yes on the same top card.
    await a.goto(`${groupPath}/match`);
    await b.goto(`${groupPath}/match`);
    const topA = await a.getByRole('region', { name: 'Group match deck' }).getByRole('button', { name: /^Yes to / }).getAttribute('aria-label');
    const topB = await b.getByRole('region', { name: 'Group match deck' }).getByRole('button', { name: /^Yes to / }).getAttribute('aria-label');
    expect(topB).toBe(topA);

    await a.getByRole('region', { name: 'Group match deck' }).getByRole('button', { name: /^Yes to / }).click();
    await b.getByRole('region', { name: 'Group match deck' }).getByRole('button', { name: /^Yes to / }).click();

    await b.reload();
    await a.reload();
    await expect(a.getByRole('heading', { name: 'Everyone agrees on' })).toBeVisible();
    await expect(b.getByRole('heading', { name: 'Everyone agrees on' })).toBeVisible();
  } finally {
    await alice.close();
    await bob.close();
    await carol.close();
  }
});
