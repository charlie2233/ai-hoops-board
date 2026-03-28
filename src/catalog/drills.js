import { loadCatalog } from './cache.js';

export function attachDrillsApi(app) {
  app.ensureDrillsCatalog = async function ensureDrillsCatalog(force = false) {
    const result = await loadCatalog('drills', './drills/drills.json', { force });
    app.drillsCatalog = Array.isArray(result.items) ? result.items : [];
    app.drillsCatalogLoaded = !!result.status?.loaded;
    app.drillsCatalogStatus = result.status;
    return app.drillsCatalog;
  };
}
