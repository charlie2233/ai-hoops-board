export function attachDrillsApi(app) {
  app.ensureDrillsCatalog = async function ensureDrillsCatalog(force = false) {
    if (app.drillsCatalogLoaded && !force) return app.drillsCatalog;
    try {
      const res = await fetch('./drills/drills.json?t=' + Date.now(), { cache: 'no-store' });
      const list = await res.json();
      app.drillsCatalog = Array.isArray(list) ? list : [];
      app.drillsCatalogLoaded = true;
    } catch (_) {
      if (!app.drillsCatalogLoaded) app.drillsCatalog = [];
    }
    return app.drillsCatalog;
  };
}
