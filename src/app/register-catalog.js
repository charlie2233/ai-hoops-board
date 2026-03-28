import {
  formatCatalogSyncLabel,
  getCatalogStatus,
  subscribeCatalogStatus
} from '../catalog/cache.js';

function getDisplayStatus(status) {
  if (!status) return { state: 'unavailable', lastSyncedAt: null };
  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  if (!online && (status.lastSyncedAt || (Array.isArray(status.items) && status.items.length))) {
    return Object.assign({}, status, { state: 'cached' });
  }
  return status;
}

export function registerCatalog(app) {
  app.renderCatalogStatusBadge = function renderCatalogStatusBadge(status = getCatalogStatus('plays')) {
    const el = app.refs.catalogStatusBadge;
    if (!el) return;
    const display = getDisplayStatus(status);
    if (!display.loaded && !display.lastSyncedAt) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.dataset.state = display.state || 'unavailable';
    const label = formatCatalogSyncLabel(display, app.normalizeLang(app.state.uiLang));
    el.textContent = label;
    el.title = label;
  };

  const rerender = (status = getCatalogStatus('plays')) => app.renderCatalogStatusBadge(status);
  const retryCatalogs = () => {
    rerender();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    app.ensurePlaysCatalog(true);
  };

  subscribeCatalogStatus((status, kind) => {
    if (kind === 'plays') rerender(status);
  });

  window.addEventListener('online', retryCatalogs);
  window.addEventListener('offline', rerender);
  rerender();
}
