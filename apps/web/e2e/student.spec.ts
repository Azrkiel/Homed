import { expect, test, type Page } from '@playwright/test';
import { signIn, studentEmail } from './helpers';

/** Count shown above the results, e.g. "12 places" -> 12. */
async function placeCount(page: Page): Promise<number> {
  const text = await page.getByRole('heading', { level: 2, name: /places?$/ }).innerText();
  return Number(text.match(/\d+/)?.[0] ?? NaN);
}

test('student journey: settings, classes, search, listing, compare, saved note', async ({ page }) => {
  test.setTimeout(180_000);
  await signIn(page, { email: studentEmail('student'), name: 'Sam Student', next: '/settings' });

  // Settings: budget, a weight preset, an extra place.
  await page.getByRole('spinbutton', { name: /Max budget per month/ }).fill('1800');
  await page.getByRole('button', { name: 'Budget first' }).click();
  await expect(page.getByRole('button', { name: 'Budget first' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('checkbox', { name: 'Clemons Library' }).check();
  await page.getByRole('combobox', { name: 'Major' }).selectOption({ label: 'Biology' });
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Your settings are updated.')).toBeVisible();

  // Classes: by major first.
  await page.goto('/classes');
  await page.getByRole('button', { name: 'By major' }).click();
  await page.getByRole('combobox', { name: 'Major' }).selectOption({ label: 'Biology' });
  await page.getByRole('button', { name: 'Save my classes' }).click();
  await expect(page.getByText('Rankings now use your classes.')).toBeVisible();

  // Then one class from the schedule.
  await page.getByRole('button', { name: 'My schedule' }).click();
  await page.getByRole('textbox', { name: 'Course number, row 1' }).fill('BIOL 1000');
  await page.locator('label', { has: page.getByRole('checkbox', { name: 'Monday, row 1' }) }).click();
  await page.locator('label', { has: page.getByRole('checkbox', { name: 'Wednesday, row 1' }) }).click();
  const building = page.getByRole('combobox', { name: 'Building, row 1' });
  await building.fill('Gilmer');
  await page.getByRole('option', { name: /Gilmer Hall/ }).first().click();
  await page.getByRole('textbox', { name: 'Start time, row 1' }).fill('10:00');
  await page.getByRole('textbox', { name: 'End time, row 1' }).fill('10:50');
  await page.getByRole('button', { name: 'Save my classes' }).click();
  await expect(page.getByText('Rankings now use your classes.')).toBeVisible();

  // Search: open filters, set one, see the count change, sort.
  await page.goto('/search');
  const before = await placeCount(page);
  await page.getByRole('button', { name: /^Filters/ }).click();
  const drawer = page.getByRole('dialog');
  await drawer.getByRole('spinbutton', { name: /Max cost per person/ }).fill('1200');
  await drawer.getByRole('button', { name: 'Show results' }).last().click();
  await expect(page).toHaveURL(/max=1200/);
  await expect.poll(() => placeCount(page)).toBeLessThan(before);
  const filtered = await placeCount(page);
  expect(filtered).toBeGreaterThan(0);

  await page.getByRole('link', { name: 'Price', exact: true }).click();
  await expect(page).toHaveURL(/sort=price/);

  // Parking filter, then open a listing that has parking.
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('dialog').getByRole('checkbox', { name: 'Parking available' }).check();
  await page.getByRole('dialog').getByRole('button', { name: 'Show results' }).last().click();
  await expect(page).toHaveURL(/parking=1/);
  const firstListing = page.locator('a[href^="/listings/"]').first();
  await firstListing.click();
  await expect(page.getByRole('heading', { level: 2, name: 'True cost per person' })).toBeVisible();

  // Cost table: toggle parking in and check the parking row starts counting.
  const parkingRow = page.locator('tr', { hasText: 'Parking' });
  await expect(parkingRow).toContainText('Not counted');
  await page.getByRole('group', { name: 'Parking in the cost' }).getByRole('link', { name: 'With parking' }).click();
  await expect(page).toHaveURL(/\?parking=1/);
  await expect(page.getByRole('link', { name: 'With parking' })).toHaveAttribute('aria-current', 'true');
  await expect(parkingRow).not.toContainText('Not counted');

  // Save this listing.
  const saveButton = page.getByRole('button', { name: /^Save / }).first();
  await saveButton.click();
  await expect(page.getByRole('button', { name: /^Remove .* from saved$/ }).first()).toBeVisible();
  const firstName = (await page.getByRole('button', { name: /^Remove .* from saved$/ }).first().getAttribute("aria-label"))!
    .replace(/^Remove /, '')
    .replace(/ from saved$/, '');

  // Second place: save it from the search results, so there are two to compare.
  await page.goto('/search');
  await page.locator('a[href^="/listings/"]').nth(1).click();
  await page.getByRole('button', { name: /^Save / }).first().click();
  await expect(page.getByRole('button', { name: /^Remove .* from saved$/ }).first()).toBeVisible();
  const secondName = (await page.getByRole('button', { name: /^Remove .* from saved$/ }).first().getAttribute("aria-label"))!
    .replace(/^Remove /, '')
    .replace(/ from saved$/, '');
  expect(secondName).not.toBe(firstName);

  // Saved: select both, compare. The saved list names places "property floor plan" (no comma),
  // so read the names from the list itself and use those for the note labels below.
  await page.goto('/saved');
  const compareBoxes = page.getByRole('checkbox', { name: /^Select to compare/ });
  await expect(compareBoxes).toHaveCount(2);
  const savedNames: string[] = [];
  for (let i = 0; i < 2; i++) {
    const id = (await compareBoxes.nth(i).getAttribute("id"))!;
    const label = page.locator(`label[for="${id}"]`);
    savedNames.push((await label.textContent())!.replace("Select to compare:", "").trim());
    await label.click();
  }
  expect(savedNames[1]).not.toBe(savedNames[0]);
  await page.getByRole('link', { name: 'Compare selected (2)' }).click();
  await expect(page).toHaveURL(/\/compare\?ids=/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('region', { name: /Comparison table/ })).toBeVisible();

  // Saved page: add a note, then edit it.
  await page.goto('/saved');
  await page.getByRole('button', { name: `Add note for ${savedNames[0]!}` }).click();
  await page.getByRole('textbox', { name: `Note for ${savedNames[0]!}` }).fill('Quiet floor, good light');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Note: Quiet floor, good light')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: `Edit note for ${savedNames[0]!}` }).click();
  await page.getByRole('textbox', { name: `Note for ${savedNames[0]!}` }).fill('Quiet floor, good light, bring a fan');
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Note: Quiet floor, good light, bring a fan')).toBeVisible();
});
