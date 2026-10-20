import { createServer, type Server } from 'node:http';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { studentEmail } from './helpers';

// Expo web build of apps/mobile, served by a tiny static server with SPA fallback on :3021.
const MOBILE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'mobile');
const DIST = join(MOBILE, 'dist');
const MOBILE_PORT = 3021;
const MOBILE_URL = `http://localhost:${MOBILE_PORT}`;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function serveDist(): Server {
  return createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
    const safe = normalize(urlPath).replace(/^[/\\]+/, '');
    let file = join(DIST, safe);
    const isFile = existsSync(file) && statSync(file).isFile();
    if (!file.startsWith(DIST) || !isFile) file = join(DIST, 'index.html'); // SPA fallback
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  }).listen(MOBILE_PORT);
}

test.describe.serial('mobile web build', () => {
  let server: Server | undefined;

  test.beforeAll(() => {
    rmSync(DIST, { recursive: true, force: true });
    execSync('npx expo export --platform web', {
      cwd: MOBILE,
      env: { ...process.env, EXPO_PUBLIC_API_URL: 'http://localhost:3020' },
      stdio: 'inherit',
      timeout: 600_000,
    });
    expect(existsSync(join(DIST, 'index.html'))).toBe(true);
    server = serveDist();
  });

  test.afterAll(async () => {
    await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
    rmSync(DIST, { recursive: true, force: true });
  });

  test('sign in, ranked list, open a listing, swipe right in Match, see it in Saved', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(`${MOBILE_URL}/signin`);
    await page.getByPlaceholder('netid@virginia.edu').fill(studentEmail('mobile'));
    await page.getByPlaceholder('First name').fill('Mo Mobile');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Ranked list: cards are buttons labelled "<property>. <floor plan>. <bed/bath>. ... score <n>. <badges>".
    const firstCard = page.getByRole('button', { name: /\. score \d+/ }).first();
    await expect(firstCard).toBeVisible({ timeout: 90_000 });
    const propertyName = ((await firstCard.getAttribute('aria-label')) ?? '').split('. ')[0]!.trim();
    expect(propertyName.length).toBeGreaterThan(0);

    // Open a listing from the list.
    await firstCard.click();
    await expect(page.getByText(propertyName).filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    await page.goBack();

    // Match: the top card is the best-ranked place; Save swipes it right.
    // In-app tab navigation: the web build keeps the session in memory, so reloads would sign out.
    await page.getByRole("tab", { name: "Match" }).or(page.getByRole("link", { name: "Match" })).first().click();
    await expect(page.getByText(propertyName).filter({ visible: true }).first()).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Saved shows the swiped-right place.
    await page.getByRole("tab", { name: "Saved" }).or(page.getByRole("link", { name: "Saved" })).first().click();
    await expect(page.getByText(propertyName).filter({ visible: true }).first()).toBeVisible({ timeout: 90_000 });
  });
});
