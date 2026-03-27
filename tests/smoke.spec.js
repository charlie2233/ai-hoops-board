import { test, expect } from '@playwright/test';

function attachErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

test('board bootstraps with accessibility scaffolding', async ({ page }) => {
  const errors = attachErrorCapture(page);
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__aiHoopsBoardApp));

  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#board')).toHaveAttribute('tabindex', '0');
  await expect(page.locator('#toolbar')).toHaveAttribute('role', 'toolbar');
  await expect(page.locator('#app-live-region')).toHaveAttribute('role', 'status');
  await expect(page.locator('#show-advanced')).toHaveAttribute('aria-controls', 'advanced-toolbar');

  expect(errors).toEqual([]);
});

test('keyboard shortcuts drive core board actions', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Shortcut smoke is only run in chromium.');
  const errors = attachErrorCapture(page);

  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__aiHoopsBoardApp));
  await page.locator('#board').click();

  await page.keyboard.press('r');
  await expect(page.locator('#mode-run')).toHaveClass(/active/);

  await page.keyboard.press('p');
  await expect(page.locator('#mode-pass')).toHaveClass(/active/);

  await page.keyboard.press('v');
  await expect(page.locator('#mode-drag')).toHaveClass(/active/);

  await page.keyboard.press('d');
  await expect(page.locator('#toggle-defense')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('a');
  await expect(page.locator('#show-advanced')).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('f');
  await expect(page.locator('body')).toHaveClass(/immersive/);

  await page.keyboard.press(' ');
  await expect(page.locator('#btn-playpause')).not.toHaveText(/回放|Replay/);

  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-playpause')).toHaveText(/回放|Replay/);

  await page.keyboard.press('?');
  await expect(page.locator('#app-live-region')).not.toBeEmpty();

  await page.keyboard.press('Control+s');
  await expect.poll(async () => page.evaluate(() => Boolean(localStorage.getItem('boardState_v1')))).toBe(true);

  expect(errors).toEqual([]);
});

test('library, drills, and settings pages load from the static server', async ({ page }) => {
  const paths = ['/pages/library.html', '/pages/drills.html', '/pages/settings.html'];
  for (const path of paths) {
    const errors = attachErrorCapture(page);
    await page.goto(path);
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  }
});
