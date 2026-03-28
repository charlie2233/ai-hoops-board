import {
  DRILLS_CATALOG_CACHE_KEY,
  DRILLS_CATALOG_META_KEY,
  PLAYS_CATALOG_CACHE_KEY,
  PLAYS_CATALOG_META_KEY
} from '../core/keys.js';

const CONFIG = {
  plays: {
    cacheKey: PLAYS_CATALOG_CACHE_KEY,
    metaKey: PLAYS_CATALOG_META_KEY
  },
  drills: {
    cacheKey: DRILLS_CATALOG_CACHE_KEY,
    metaKey: DRILLS_CATALOG_META_KEY
  }
};

const listeners = new Set();
const statusByKind = new Map();

function normalizeKind(kind) {
  return kind === 'drills' ? 'drills' : 'plays';
}

function getConfig(kind) {
  return CONFIG[normalizeKind(kind)];
}

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function readStoredCatalog(kind) {
  const cfg = getConfig(kind);
  const rawItems = localStorage.getItem(cfg.cacheKey);
  const items = parseJson(rawItems, null);
  const rawMeta = parseJson(localStorage.getItem(cfg.metaKey), {});
  return {
    hasCache: rawItems !== null && Array.isArray(items),
    items: Array.isArray(items) ? items : [],
    lastSyncedAt: Number(rawMeta?.lastSyncedAt) || null
  };
}

function writeStoredCatalog(kind, items, lastSyncedAt) {
  const cfg = getConfig(kind);
  localStorage.setItem(cfg.cacheKey, JSON.stringify(items));
  localStorage.setItem(cfg.metaKey, JSON.stringify({ lastSyncedAt }));
}

function buildStatus(kind, patch = {}) {
  const current = statusByKind.get(kind) || {
    kind,
    items: [],
    loaded: false,
    state: 'unavailable',
    lastSyncedAt: null,
    error: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine !== false
  };
  return Object.assign({}, current, patch);
}

function publishStatus(kind, patch) {
  const next = buildStatus(kind, patch);
  statusByKind.set(kind, next);
  listeners.forEach((listener) => {
    try {
      listener(next, kind);
    } catch (_) {}
  });
  return next;
}

function formatTime(lastSyncedAt, lang) {
  if (!lastSyncedAt) return '';
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(lastSyncedAt));
  } catch (_) {
    return new Date(lastSyncedAt).toLocaleString(locale);
  }
}

export function getCatalogStatus(kind) {
  const key = normalizeKind(kind);
  if (statusByKind.has(key)) return statusByKind.get(key);
  const stored = readStoredCatalog(key);
  return buildStatus(key, {
    items: stored.items,
    loaded: stored.hasCache,
    state: stored.hasCache ? 'cached' : 'unavailable',
    lastSyncedAt: stored.lastSyncedAt,
    error: null
  });
}

export function subscribeCatalogStatus(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatCatalogSyncLabel(status, lang = 'zh') {
  const state = status?.state || 'unavailable';
  const time = formatTime(status?.lastSyncedAt, lang);
  if (lang === 'en') {
    if (state === 'synced') return time ? `Synced ${time}` : 'Synced';
    if (state === 'cached') return time ? `Offline Cache · ${time}` : 'Offline Cache';
    return 'Catalog Unavailable';
  }
  if (state === 'synced') return time ? `已同步 ${time}` : '已同步';
  if (state === 'cached') return time ? `离线缓存 · ${time}` : '离线缓存';
  return '目录不可用';
}

export async function loadCatalog(kind, url, options = {}) {
  const key = normalizeKind(kind);
  const force = !!options.force;
  const existing = statusByKind.get(key);
  if (existing?.loaded && !force) {
    return { items: existing.items, status: existing };
  }

  const stored = readStoredCatalog(key);
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Catalog payload must be an array');
    const lastSyncedAt = Date.now();
    writeStoredCatalog(key, data, lastSyncedAt);
    const status = publishStatus(key, {
      items: data,
      loaded: true,
      state: 'synced',
      lastSyncedAt,
      error: null,
      online: true
    });
    return { items: data, status };
  } catch (error) {
    if (stored.hasCache) {
      const status = publishStatus(key, {
        items: stored.items,
        loaded: true,
        state: 'cached',
        lastSyncedAt: stored.lastSyncedAt,
        error: error?.message || 'Catalog fetch failed',
        online: typeof navigator === 'undefined' ? true : navigator.onLine !== false
      });
      return { items: stored.items, status };
    }
    const status = publishStatus(key, {
      items: [],
      loaded: true,
      state: 'unavailable',
      lastSyncedAt: stored.lastSyncedAt,
      error: error?.message || 'Catalog unavailable',
      online: typeof navigator === 'undefined' ? true : navigator.onLine !== false
    });
    return { items: [], status };
  }
}
