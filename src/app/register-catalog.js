export function registerCatalog(app) {
  const retryCatalogs = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    app.ensurePlaysCatalog(true);
  };

  window.addEventListener('online', retryCatalogs);
}
