import { expect, test, type Page } from '@playwright/test';
import { signIn, studentEmail } from './helpers';

const deck = (page: Page) => page.getByRole('region', { name: 'Match deck' });

/** The deck ignores swipes while a save is in flight, so wait for each server action to settle. */
const settled = (page: Page, act: () => Promise<void>) =>
  Promise.all([page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/match')), act()]);

/** Name of the card on top, read from its Save button label ("Save <name>"). */
async function topName(page: Page): Promise<string> {
  const label = await deck(page).getByRole('button', { name: /^Save / }).getAttribute('aria-label');
  expect(label).toBeTruthy();
  return label!.replace(/^Save /, '');
}

test('solo Match: drag, button, Right arrow and undo; saved places show in Saved', async ({ page }) => {
  await signIn(page, { email: studentEmail('match'), name: 'Match Tester', next: '/match' });
  await expect(deck(page)).toBeVisible();

  const first = await topName(page);
  const card = deck(page).locator('.cursor-grab');
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  // 1. Drag right past the threshold: saves the first card.
  await settled(page, async () => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(x + i * 40, y);
    await page.mouse.up();
  });
  await expect.poll(() => topName(page)).not.toBe(first);
  const second = await topName(page);

  // 2. Pass button passes the second card (left).
  await settled(page, () => deck(page).getByRole('button', { name: `Pass ${second}` }).click());
  await expect.poll(() => topName(page)).not.toBe(second);
  const third = await topName(page);

  // 3. Undo brings the passed card back on top.
  await settled(page, () => deck(page).getByRole('button', { name: /^Undo, / }).click());
  await expect.poll(() => topName(page)).toBe(second);

  // 4. Right arrow with the deck focused saves the second card; a second Right saves the third.
  await deck(page).focus();
  await settled(page, () => page.keyboard.press('ArrowRight'));
  await expect.poll(() => topName(page)).toBe(third);
  await settled(page, () => page.keyboard.press('ArrowRight'));
  const fourth = await topName(page);
  expect(fourth).not.toBe(third);

  // 5. Undo the last swipe (Z key): the third card is back on top.
  await settled(page, () => page.keyboard.press('z'));
  await expect.poll(() => topName(page)).toBe(third);

  // Saved: the right-swiped places (first, second) are there; the passed and undone ones are not.
  await page.goto('/saved');
  await expect(page.getByRole('heading', { level: 1, name: 'Saved' })).toBeVisible();
  const body = page.locator('main');
  await expect(body).toContainText(first);
  await expect(body).toContainText(second);
  await expect(body).not.toContainText(third);
});
