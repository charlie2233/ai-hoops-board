import { test, expect } from '@playwright/test';

function attachErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('favicon.ico')) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

async function resetClientState(page) {
  await page.goto(`/index.html?reset=${Date.now()}`);
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  });
}

test('board boots with catalog badge and share controls', async ({ page }) => {
  const errors = attachErrorCapture(page);
  await resetClientState(page);

  await page.goto(`/index.html?smoke=${Date.now()}`);
  await page.waitForFunction(() => Boolean(window.__aiHoopsBoardApp));

  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#share-board')).toBeVisible();
  await expect(page.locator('#catalog-status-badge')).toBeVisible();
  await expect(page.locator('#catalog-status-badge')).toContainText(/已同步|Synced|离线缓存|Offline Cache|目录不可用|Catalog Unavailable/);

  expect(errors).toEqual([]);
});

test('library and drills pages expose catalog status surfaces', async ({ page }) => {
  for (const path of ['/pages/library.html', '/pages/drills.html']) {
    const errors = attachErrorCapture(page);
    await resetClientState(page);
    await page.goto(`${path}?smoke=${Date.now()}`);
    await expect(page.locator('body')).toBeVisible();
    const statusLocator = path.includes('library') ? page.locator('#stats') : page.locator('#catalog-status');
    await expect(statusLocator).toBeVisible();
    await expect(statusLocator).toContainText(/已同步|Synced|离线缓存|Offline Cache|目录不可用|Catalog Unavailable/);
    expect(errors).toEqual([]);
  }
});
