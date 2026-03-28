import { test, expect } from '@playwright/test';

const PLAYS_CACHE_KEY = 'catalogCache:plays:v1';
const PLAYS_META_KEY = 'catalogMeta:plays:v1';
const DRILLS_CACHE_KEY = 'catalogCache:drills:v1';
const DRILLS_META_KEY = 'catalogMeta:drills:v1';

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

test('library falls back to cached catalog when network is unavailable', async ({ page }) => {
  await resetClientState(page);
  await page.addInitScript(({ cacheKey, metaKey }) => {
    localStorage.setItem(cacheKey, JSON.stringify([
      { id: 'cached-play', name: 'Cached Play', type: 'PnR', vs: ['Drop'], cues: ['Cache'] }
    ]));
    localStorage.setItem(metaKey, JSON.stringify({ lastSyncedAt: 1700000000000 }));
  }, { cacheKey: PLAYS_CACHE_KEY, metaKey: PLAYS_META_KEY });
  await page.route('**/plays/plays.json', (route) => route.abort());

  await page.goto(`/pages/library.html?offline=${Date.now()}`);
  await expect(page.locator('#stats')).toHaveAttribute('data-state', 'cached');
  await expect(page.locator('#list')).toContainText('Cached Play');
});

test('library refreshes from synced network data after cached offline state', async ({ page }) => {
  await resetClientState(page);
  await page.addInitScript(({ cacheKey, metaKey }) => {
    localStorage.setItem(cacheKey, JSON.stringify([
      { id: 'cached-play', name: 'Cached Play', type: 'PnR', vs: ['Drop'], cues: ['Cache'] }
    ]));
    localStorage.setItem(metaKey, JSON.stringify({ lastSyncedAt: 1700000000000 }));
  }, { cacheKey: PLAYS_CACHE_KEY, metaKey: PLAYS_META_KEY });
  await page.route('**/plays/plays.json', (route) => route.abort());

  await page.goto(`/pages/library.html?offline-refresh=${Date.now()}`);
  await expect(page.locator('#stats')).toHaveAttribute('data-state', 'cached');
  await expect(page.locator('#list')).toContainText('Cached Play');

  await page.unroute('**/plays/plays.json');
  await page.goto(`/pages/library.html?online-refresh=${Date.now()}`);
  await expect(page.locator('#stats')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('#list')).toContainText('Horns Left PnR');
});

test('drills page uses cached catalogs when offline', async ({ page }) => {
  await resetClientState(page);
  await page.addInitScript(({ playsCacheKey, playsMetaKey, drillsCacheKey, drillsMetaKey }) => {
    localStorage.setItem(playsCacheKey, JSON.stringify([
      { id: 'cached-play', name: 'Cached Play', type: 'PnR', vs: ['Drop'], cues: ['Cache'] }
    ]));
    localStorage.setItem(playsMetaKey, JSON.stringify({ lastSyncedAt: 1700000000000 }));
    localStorage.setItem(drillsCacheKey, JSON.stringify([
      { title: 'Cached Drill', notes: 'Offline drill', tags: ['offline'], playId: 'cached-play', youtubeId: 'VIDEO_ID_PLACEHOLDER' }
    ]));
    localStorage.setItem(drillsMetaKey, JSON.stringify({ lastSyncedAt: 1700000000000 }));
  }, {
    playsCacheKey: PLAYS_CACHE_KEY,
    playsMetaKey: PLAYS_META_KEY,
    drillsCacheKey: DRILLS_CACHE_KEY,
    drillsMetaKey: DRILLS_META_KEY
  });
  await page.route('**/plays/plays.json', (route) => route.abort());
  await page.route('**/drills/drills.json', (route) => route.abort());

  await page.goto(`/pages/drills.html?offline=${Date.now()}`);
  await expect(page.locator('#catalog-status')).toHaveAttribute('data-state', 'cached');
  await expect(page.locator('#list')).toContainText('Cached Drill');
});

test('share button supports native and fallback flows', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Share smoke is only run in chromium.');

  await resetClientState(page);
  await page.addInitScript(() => {
    window.__sharedPayload = null;
    window.__copiedText = null;
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__sharedPayload = {
          title: payload.title,
          text: payload.text,
          files: Array.isArray(payload.files)
            ? payload.files.map((file) => ({ name: file.name, type: file.type }))
            : []
        };
      }
    });
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (payload) => Array.isArray(payload?.files) && payload.files.length > 0
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__copiedText = text;
        }
      }
    });
  });

  await page.goto(`/index.html?share-native=${Date.now()}`);
  await page.waitForFunction(() => Boolean(window.__aiHoopsBoardApp));
  await page.click('#share-board');
  await expect.poll(async () => page.evaluate(() => window.__sharedPayload)).not.toBeNull();
  const shared = await page.evaluate(() => window.__sharedPayload);
  expect(shared.files[0].name).toMatch(/\.json$/);
  expect(shared.text).toContain('AI');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: undefined });
    window.__copiedText = null;
  });

  await page.click('#share-board');
  await expect(page.getByRole('button', { name: '复制 JSON' })).toBeVisible();
  await page.getByRole('button', { name: '复制 JSON' }).click();
  await expect.poll(async () => page.evaluate(() => window.__copiedText)).toContain('"scene"');

  await page.click('#share-board');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
});
