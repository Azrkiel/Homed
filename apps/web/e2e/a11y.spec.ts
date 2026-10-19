import { expect, test, type Page } from '@playwright/test';
import { firstListingPath } from './helpers';

// Approximate accessible-name check: visible links and buttons must have a non-empty name.
async function unnamedControls(page: Page): Promise<string[]> {
  return page.$$eval('a[href], button, [role="button"], [role="link"]', (els) => {
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    };
    const nameOf = (el: Element): string => {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const t = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim();
        if (t) return t;
      }
      const aria = el.getAttribute('aria-label')?.trim();
      if (aria) return aria;
      const text = (el.textContent ?? '').trim();
      if (text) return text;
      const img = el.querySelector('img[alt]');
      if (img && (img.getAttribute('alt') ?? '').trim()) return img.getAttribute('alt')!.trim();
      return (el.getAttribute('title') ?? '').trim();
    };
    return els
      .filter((el) => visible(el) && !el.closest('[aria-hidden="true"]'))
      .filter((el) => nameOf(el) === '')
      .map((el) => `${el.tagName.toLowerCase()} ${el.outerHTML.slice(0, 120)}`);
  });
}

const PAGES = ['/', '/search'];

test.describe('accessibility smoke', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  for (const path of PAGES) {
    test(`${path}: one h1, no horizontal overflow at 360px, named controls`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal overflow px').toBeLessThanOrEqual(0);
      expect(await unnamedControls(page)).toEqual([]);
    });
  }

  test('listing page: one h1, no horizontal overflow at 360px, named controls', async ({ page }) => {
    const path = await firstListingPath(page);
    await page.goto(path);
    await expect(page.locator('h1')).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow px').toBeLessThanOrEqual(0);
    expect(await unnamedControls(page)).toEqual([]);
  });
});
