export function attachOverlayShell(app) {
  let root = app.refs.overlayRoot;
  if (!root) {
    root = document.createElement('div');
    root.id = 'overlay-root';
    document.body.appendChild(root);
    app.refs.overlayRoot = root;
  }

  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '2400';
  root.style.display = 'block';
  root.style.pointerEvents = 'auto';

  app.openOverlay = function openOverlay(name, content = null) {
    root.dataset.overlay = String(name || '');
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    if (content instanceof Node) {
      root.replaceChildren(content);
    } else if (typeof content === 'string') {
      root.innerHTML = content;
    }
    return root;
  };

  app.closeOverlay = function closeOverlay() {
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    root.replaceChildren();
    delete root.dataset.overlay;
  };

  app.getOverlayRoot = function getOverlayRoot() {
    return root;
  };
}
