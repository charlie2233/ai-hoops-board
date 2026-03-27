const CATALOG_LINKS = [
  { id: 'link-library', overlay: 'library', href: 'pages/library.html?overlay=1' },
  { id: 'immersive-link-library', overlay: 'library', href: 'pages/library.html?overlay=1' },
  { id: 'link-drills', overlay: 'drills', href: 'pages/drills.html?overlay=1' },
  { id: 'immersive-link-drills', overlay: 'drills', href: 'pages/drills.html?overlay=1' }
];

function isPlainActivationEvent(e) {
  return !!e && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function createOverlayFrame(doc, url, title) {
  const frame = doc.createElement('iframe');
  frame.src = url;
  frame.title = title;
  frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture');
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  frame.style.cssText = [
    'width:100%',
    'height:100%',
    'border:0',
    'display:block',
    'background:#fff'
  ].join(';');
  return frame;
}

export function registerCatalog(app) {
  const doc = app.document || document;
  const overlayRoot = app.refs.overlayRoot || null;

  function openCatalogOverlay(kind, href, title) {
    if (!overlayRoot || !app.openOverlay) {
      location.href = href;
      return false;
    }
    const frame = createOverlayFrame(doc, href, title);
    app.openOverlay(kind, frame);
    return true;
  }

  app.openLibraryOverlay = function openLibraryOverlay() {
    return openCatalogOverlay('library', 'pages/library.html?overlay=1', 'Play Library');
  };

  app.openDrillsOverlay = function openDrillsOverlay() {
    return openCatalogOverlay('drills', 'pages/drills.html?overlay=1', 'Drill Library');
  };

  CATALOG_LINKS.forEach(({ id, overlay, href }) => {
    const el = doc.getElementById(id);
    if (!el) return;
    const title = overlay === 'library' ? 'Play Library' : 'Drill Library';
    el.addEventListener('click', (e) => {
      if (!isPlainActivationEvent(e)) return;
      e.preventDefault();
      if (overlay === 'library') {
        openCatalogOverlay('library', href, title);
      } else {
        openCatalogOverlay('drills', href, title);
      }
    });
  });
}
