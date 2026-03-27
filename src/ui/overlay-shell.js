export function attachOverlayShell(app) {
  let root = app.refs.overlayRoot;
  if (!root) {
    root = document.createElement('div');
    root.id = 'overlay-root';
    root.hidden = true;
    document.body.appendChild(root);
    app.refs.overlayRoot = root;
  }

  app.openOverlay = function openOverlay(name, content = null) {
    root.dataset.overlay = String(name || '');
    root.hidden = false;
    if (content instanceof Node) {
      root.replaceChildren(content);
    }
  };

  app.closeOverlay = function closeOverlay() {
    root.hidden = true;
    root.replaceChildren();
    delete root.dataset.overlay;
  };
}
