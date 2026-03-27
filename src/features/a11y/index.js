const COPY = {
  zh: {
    shortcutsHelp: '快捷键：V 拖拽，R 跑位线，P 传球箭头，D 移除或恢复防守，C 切换半场全场，F 切换沉浸模式，A 展开更多，空格回放或暂停，Esc 停止回放或关闭浮层，Ctrl 或 Command 加 S 保存，Ctrl 或 Command 加 Z 撤销，Shift 加 Ctrl 或 Command 加 Z 重做。',
    boardLabel: '篮球战术画板。可用快捷键切换工具，画板说明见下方提示。',
    mainToolbar: '主工具栏',
    advancedToolbar: '扩展工具栏',
    bottomToolbar: '底部操作栏',
    liveRegion: '战术板状态播报',
    overlay: '战术板弹层',
    playPause: '回放或暂停',
    stopReplay: '停止回放',
    toggleMore: '展开或收起更多工具',
    focusCanvas: '已聚焦画板。',
    overlayClosed: '已关闭弹层。'
  },
  en: {
    shortcutsHelp: 'Shortcuts: V drag, R run line, P pass arrow, D remove or restore defense, C toggle half or full court, F toggle immersive mode, A toggle more tools, Space replay or pause, Escape stop replay or close overlay, Ctrl or Command plus S save, Ctrl or Command plus Z undo, Shift plus Ctrl or Command plus Z redo.',
    boardLabel: 'Basketball tactics board. Use keyboard shortcuts to switch tools. The board hint is announced below the canvas.',
    mainToolbar: 'Main toolbar',
    advancedToolbar: 'Advanced toolbar',
    bottomToolbar: 'Bottom action bar',
    liveRegion: 'Board status announcements',
    overlay: 'Board overlay',
    playPause: 'Replay or pause',
    stopReplay: 'Stop replay',
    toggleMore: 'Expand or collapse more tools',
    focusCanvas: 'Board focused.',
    overlayClosed: 'Overlay closed.'
  }
};

function copyFor(app) {
  const lang = app.normalizeLang?.(app.state?.uiLang) || 'zh';
  return COPY[lang] || COPY.zh;
}

function createVisuallyHiddenStyle(doc) {
  if (doc.getElementById('quality-a11y-style')) return;
  const style = doc.createElement('style');
  style.id = 'quality-a11y-style';
  style.textContent = `
    .sr-only {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    :focus-visible {
      outline: 3px solid color-mix(in srgb, var(--accent-soft, #fb923c) 85%, white);
      outline-offset: 3px;
    }
  `;
  doc.head.appendChild(style);
}

function ensureHiddenHelp(doc) {
  let el = doc.getElementById('quality-shortcuts-help');
  if (el) return el;
  el = doc.createElement('p');
  el.id = 'quality-shortcuts-help';
  el.className = 'sr-only';
  doc.body.appendChild(el);
  return el;
}

function ensureLiveRegion(doc) {
  let el = doc.getElementById('app-live-region');
  if (el) return el;
  el = doc.createElement('div');
  el.id = 'app-live-region';
  el.className = 'sr-only';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  doc.body.appendChild(el);
  return el;
}

function setShortcutAttrs(app) {
  const shortcuts = {
    'mode-drag': 'V',
    'mode-run': 'R',
    'mode-pass': 'P',
    undo: 'Control+Z Meta+Z',
    redo: 'Control+Shift+Z Meta+Shift+Z Control+Y',
    'toggle-defense': 'D',
    'toggle-court': 'C',
    'toggle-immersive': 'F',
    'show-advanced': 'A',
    'btn-playpause': 'Space',
    'btn-stop': 'Escape',
    save: 'Control+S Meta+S',
    'reset-view': '0'
  };

  Object.entries(shortcuts).forEach(([id, value]) => {
    const el = app.refs.$(id);
    if (!el) return;
    el.setAttribute('aria-keyshortcuts', value);
  });
}

export function registerAccessibility(app) {
  const doc = app.document;
  const win = app.window;
  let overlayReturnFocus = null;

  createVisuallyHiddenStyle(doc);
  const liveRegion = ensureLiveRegion(doc);
  const shortcutsHelp = ensureHiddenHelp(doc);

  app.announce = function announce(message, politeness = 'polite') {
    if (!message) return;
    liveRegion.setAttribute('aria-live', politeness);
    liveRegion.textContent = '';
    win.clearTimeout(app._announceTimer);
    app._announceTimer = win.setTimeout(() => {
      liveRegion.textContent = String(message);
    }, 32);
  };

  const originalToast = typeof app.toast === 'function' ? app.toast.bind(app) : null;
  app.toast = function toastWithAnnouncement(message) {
    if (originalToast) originalToast(message);
    app.announce(message);
  };

  const originalOpenOverlay = typeof app.openOverlay === 'function' ? app.openOverlay.bind(app) : null;
  if (originalOpenOverlay) {
    app.openOverlay = function openOverlayWithFocus(...args) {
      const active = doc.activeElement;
      overlayReturnFocus = active instanceof win.HTMLElement ? active : null;
      originalOpenOverlay(...args);
      const root = app.refs.overlayRoot;
      if (!root) return;
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', copyFor(app).overlay);
      if (!root.hasAttribute('tabindex')) root.tabIndex = -1;
      const focusable = root.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      (focusable || root).focus();
    };
  }

  const originalCloseOverlay = typeof app.closeOverlay === 'function' ? app.closeOverlay.bind(app) : null;
  if (originalCloseOverlay) {
    app.closeOverlay = function closeOverlayWithFocus(...args) {
      originalCloseOverlay(...args);
      const root = app.refs.overlayRoot;
      if (root) {
        root.setAttribute('aria-hidden', 'true');
        root.removeAttribute('role');
        root.removeAttribute('aria-modal');
        root.removeAttribute('aria-label');
      }
      if (overlayReturnFocus && overlayReturnFocus.isConnected) overlayReturnFocus.focus();
      app.announce(copyFor(app).overlayClosed);
    };
  }

  function applyAttributes() {
    const copy = copyFor(app);

    shortcutsHelp.textContent = copy.shortcutsHelp;
    liveRegion.setAttribute('aria-label', copy.liveRegion);

    doc.querySelectorAll('button').forEach((button) => {
      if (!button.getAttribute('type')) button.setAttribute('type', 'button');
    });

    if (app.refs.toolbarEl) {
      app.refs.toolbarEl.setAttribute('role', 'toolbar');
      app.refs.toolbarEl.setAttribute('aria-label', copy.mainToolbar);
    }
    if (app.refs.advancedToolbar) {
      app.refs.advancedToolbar.setAttribute('role', 'group');
      app.refs.advancedToolbar.setAttribute('aria-label', copy.advancedToolbar);
      app.refs.advancedToolbar.id = app.refs.advancedToolbar.id || 'advanced-toolbar';
    }
    if (app.refs.bottombarEl) {
      app.refs.bottombarEl.setAttribute('role', 'group');
      app.refs.bottombarEl.setAttribute('aria-label', copy.bottomToolbar);
    }
    if (app.refs.aiStrip) {
      app.refs.aiStrip.setAttribute('role', 'status');
      app.refs.aiStrip.setAttribute('aria-live', 'polite');
      app.refs.aiStrip.setAttribute('aria-atomic', 'true');
    }
    if (app.canvas) {
      app.canvas.tabIndex = 0;
      app.canvas.setAttribute('role', 'img');
      app.canvas.setAttribute('aria-label', copy.boardLabel);
      app.canvas.setAttribute('aria-describedby', ['board-hint', 'ai-strip', 'quality-shortcuts-help'].join(' '));
    }
    if (app.refs.overlayRoot) {
      app.refs.overlayRoot.setAttribute('aria-hidden', app.refs.overlayRoot.hidden ? 'true' : 'false');
    }

    const showAdvanced = app.refs.$('show-advanced');
    if (showAdvanced && app.refs.advancedToolbar) {
      showAdvanced.setAttribute('aria-controls', app.refs.advancedToolbar.id);
      showAdvanced.setAttribute('aria-expanded', app.refs.advancedToolbar.classList.contains('show') ? 'true' : 'false');
      showAdvanced.setAttribute('aria-label', copy.toggleMore);
    }

    const playPause = app.refs.$('btn-playpause');
    if (playPause) playPause.setAttribute('aria-label', copy.playPause);
    const stopReplay = app.refs.$('btn-stop');
    if (stopReplay) stopReplay.setAttribute('aria-label', copy.stopReplay);

    setShortcutAttrs(app);
  }

  const originalRenderLanguageUI = typeof app.renderLanguageUI === 'function' ? app.renderLanguageUI.bind(app) : null;
  if (originalRenderLanguageUI) {
    app.renderLanguageUI = function renderLanguageUIWithAccessibility(...args) {
      const result = originalRenderLanguageUI(...args);
      applyAttributes();
      return result;
    };
  }

  const advancedObserver = app.refs.advancedToolbar
    ? new win.MutationObserver(() => applyAttributes())
    : null;
  if (advancedObserver) {
    advancedObserver.observe(app.refs.advancedToolbar, { attributes: true, attributeFilter: ['class'] });
  }

  if (app.canvas) {
    app.canvas.addEventListener('focus', () => {
      app.announce(copyFor(app).focusCanvas);
    });
  }

  applyAttributes();
}
