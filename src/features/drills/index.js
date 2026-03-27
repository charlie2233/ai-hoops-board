export function isOverlayMode(win = window) {
  try {
    return new URLSearchParams(win.location.search).get('overlay') === '1' || win.parent !== win;
  } catch (_) {
    return false;
  }
}

export function getBoardApp(win = window) {
  try {
    return win.parent !== win ? win.parent.__aiHoopsBoardApp || null : null;
  } catch (_) {
    return null;
  }
}

export function bindOverlayBackLink(doc = document, onClose = () => {}) {
  const backLink = doc.getElementById('back-link');
  if (!backLink) return () => {};
  const handler = (e) => {
    e.preventDefault();
    onClose();
  };
  backLink.addEventListener('click', handler);
  return () => backLink.removeEventListener('click', handler);
}

export async function applyPlayFromCatalog(
  playId,
  { boardApp = getBoardApp(), fallbackHref = '../index.html?apply=' } = {}
) {
  const pid = String(playId || '').trim();
  if (!pid) return false;
  if (boardApp && typeof boardApp.applyPlayById === 'function') {
    await boardApp.applyPlayById(pid, { sourceKey: 'source_link' });
    return true;
  }
  location.href = fallbackHref + encodeURIComponent(pid);
  return true;
}
