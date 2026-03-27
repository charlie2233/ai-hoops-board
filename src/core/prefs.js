import {
  IMMERSIVE_SIDE_KEY,
  LANG_KEY,
  LAYOUT_MODE_KEY,
  PLAYER_SIZE_KEY,
  PLAY_FAVORITES_KEY,
  PLAY_RECENTS_KEY,
  THEME_KEY,
  THEME_STYLE_KEY
} from './keys.js';

const immersiveRailMoveIds = ['btn-playpause', 'btn-stop', 'seek', 'speed', 'native-fullscreen', 'show-advanced'];
const immersiveQuickbarMoveIds = ['immersive-side-toggle', 'immersive-exit'];

export function attachPrefsApi(app) {
  app.immersiveRailState = { marker: null, moved: false };
  app.immersiveQuickbarState = { marker: null, moved: false };

  app.applyLanguage = function applyLanguage(lang, opts = {}) {
    const next = app.normalizeLang(lang);
    app.state.uiLang = next;
    document.documentElement.setAttribute('data-lang', next);
    document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
    app.refreshLangButtons(next);
    app.renderLanguageUI();
    if (app.refreshQuickPlayOptions) app.refreshQuickPlayOptions();
    if (app.refreshAITips) app.refreshAITips(true);
    if (app.state.players.length && app.draw) app.draw();
    if (opts.persist !== false) {
      try { localStorage.setItem(LANG_KEY, next); } catch (_) {}
    }
  };

  app.initLanguageControls = function initLanguageControls() {
    let saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (_) {}
    const current = document.documentElement.getAttribute('data-lang');
    app.applyLanguage(saved || current || 'zh', { persist: false });
    if (app.refs.langButtons.zh) app.refs.langButtons.zh.onclick = () => app.applyLanguage('zh');
    if (app.refs.langButtons.en) app.refs.langButtons.en.onclick = () => app.applyLanguage('en');
  };

  app.updateThemeColorMeta = function updateThemeColorMeta(theme = app.normalizeTheme(document.documentElement.getAttribute('data-theme')), style = app.normalizeStyle(document.documentElement.getAttribute('data-style'))) {
    if (!app.refs.themeColorMeta) return;
    if (theme === 'dark') app.refs.themeColorMeta.setAttribute('content', style === 'vivid' ? '#0f172a' : '#0b1220');
    else app.refs.themeColorMeta.setAttribute('content', style === 'vivid' ? '#fff8ef' : '#f4f7ff');
  };

  app.refreshThemeButtons = function refreshThemeButtons(theme) {
    const next = app.normalizeTheme(theme);
    Object.entries(app.refs.themeButtons).forEach(([k, el]) => {
      if (!el) return;
      const active = k === next;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  app.refreshStyleButtons = function refreshStyleButtons(style) {
    const next = app.normalizeStyle(style);
    Object.entries(app.refs.styleButtons).forEach(([k, el]) => {
      if (!el) return;
      const active = k === next;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  app.applyTheme = function applyTheme(theme, opts = {}) {
    const next = app.normalizeTheme(theme);
    document.documentElement.setAttribute('data-theme', next);
    app.refreshThemeButtons(next);
    app.updateThemeColorMeta(next);
    if (opts.persist !== false) {
      try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
    }
  };

  app.applyThemeStyle = function applyThemeStyle(style, opts = {}) {
    const next = app.normalizeStyle(style);
    document.documentElement.setAttribute('data-style', next);
    app.refreshStyleButtons(next);
    app.updateThemeColorMeta(undefined, next);
    if (opts.persist !== false) {
      try { localStorage.setItem(THEME_STYLE_KEY, next); } catch (_) {}
    }
  };

  app.initThemeControls = function initThemeControls() {
    let savedTheme = null;
    let savedStyle = null;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
      savedStyle = localStorage.getItem(THEME_STYLE_KEY);
    } catch (_) {}
    const current = document.documentElement.getAttribute('data-theme');
    const currentStyle = document.documentElement.getAttribute('data-style');
    app.applyTheme(savedTheme || current || 'light', { persist: false });
    app.applyThemeStyle(savedStyle || currentStyle || 'classic', { persist: false });
    if (app.refs.themeButtons.light) app.refs.themeButtons.light.onclick = () => app.applyTheme('light');
    if (app.refs.themeButtons.dark) app.refs.themeButtons.dark.onclick = () => app.applyTheme('dark');
    if (app.refs.styleButtons.classic) app.refs.styleButtons.classic.onclick = () => app.applyThemeStyle('classic');
    if (app.refs.styleButtons.vivid) app.refs.styleButtons.vivid.onclick = () => app.applyThemeStyle('vivid');
  };

  app.applyPlayerSize = function applyPlayerSize(size, opts = {}) {
    app.state.playerSize = app.normalizePlayerSize(size);
    document.documentElement.setAttribute('data-player-size', app.state.playerSize);
    if (opts.persist !== false) {
      try { localStorage.setItem(PLAYER_SIZE_KEY, app.state.playerSize); } catch (_) {}
    }
    if (opts.redraw !== false && app.state.players.length && app.draw) app.draw();
  };

  app.initPlayerSize = function initPlayerSize() {
    let saved = null;
    try { saved = localStorage.getItem(PLAYER_SIZE_KEY); } catch (_) {}
    app.applyPlayerSize(saved || 'normal', { persist: false, redraw: false });
  };

  app.setImmersiveRailBalance = function setImmersiveRailBalance(enabled) {
    if (!app.refs.toolbarEl || !app.refs.bottombarEl) return;
    const shouldMove = !!enabled;
    if (shouldMove) {
      if (app.immersiveRailState.moved) return;
      const first = immersiveRailMoveIds.map((id) => app.refs.$(id)).find((el) => el && el.parentElement === app.refs.toolbarEl);
      if (first && !app.immersiveRailState.marker) {
        app.immersiveRailState.marker = document.createComment('immersive-rail-balance');
        app.refs.toolbarEl.insertBefore(app.immersiveRailState.marker, first);
      }
      const frag = document.createDocumentFragment();
      let movedCount = 0;
      immersiveRailMoveIds.forEach((id) => {
        const el = app.refs.$(id);
        if (!el || el.parentElement !== app.refs.toolbarEl) return;
        frag.appendChild(el);
        movedCount += 1;
      });
      if (movedCount > 0) app.refs.bottombarEl.insertBefore(frag, app.refs.bottombarEl.firstChild);
      app.immersiveRailState.moved = movedCount > 0;
      return;
    }

    if (!app.immersiveRailState.moved) return;
    const frag = document.createDocumentFragment();
    let restoredCount = 0;
    immersiveRailMoveIds.forEach((id) => {
      const el = app.refs.$(id);
      if (!el || el.parentElement !== app.refs.bottombarEl) return;
      frag.appendChild(el);
      restoredCount += 1;
    });
    if (restoredCount > 0) {
      if (app.immersiveRailState.marker && app.immersiveRailState.marker.parentNode === app.refs.toolbarEl) {
        app.refs.toolbarEl.insertBefore(frag, app.immersiveRailState.marker);
      } else {
        app.refs.toolbarEl.appendChild(frag);
      }
    }
    if (app.immersiveRailState.marker) app.immersiveRailState.marker.remove();
    app.immersiveRailState.marker = null;
    app.immersiveRailState.moved = false;
  };

  app.setImmersiveQuickbarDock = function setImmersiveQuickbarDock() {
    const shouldDock = !!(app.state.immersive.enabled && app.state.court === 'half');
    document.body.classList.toggle('immersive-quickbar-docked', shouldDock);
    if (!app.refs.immersiveQuickbarEl || !app.refs.toolbarEl || !app.refs.bottombarEl) return;
    const rightRail = app.normalizeImmersiveSide(app.state.immersive.side) === 'right' ? app.refs.toolbarEl : app.refs.bottombarEl;
    if (shouldDock) {
      if (!app.immersiveQuickbarState.marker) {
        app.immersiveQuickbarState.marker = document.createComment('immersive-quickbar-home');
        app.refs.immersiveQuickbarEl.insertBefore(app.immersiveQuickbarState.marker, app.refs.immersiveQuickbarEl.firstChild);
      }
      const frag = document.createDocumentFragment();
      let movedCount = 0;
      immersiveQuickbarMoveIds.forEach((id) => {
        const el = app.refs.$(id);
        if (!el || el.parentElement === rightRail) return;
        frag.appendChild(el);
        movedCount += 1;
      });
      if (movedCount > 0) {
        const railHead = rightRail.querySelector('#immersive-rail-head');
        if (railHead && railHead.parentElement === rightRail) rightRail.insertBefore(frag, railHead.nextSibling);
        else rightRail.insertBefore(frag, rightRail.firstChild);
      }
      app.immersiveQuickbarState.moved = true;
      return;
    }

    if (!app.immersiveQuickbarState.moved) return;
    const frag = document.createDocumentFragment();
    let restoredCount = 0;
    immersiveQuickbarMoveIds.forEach((id) => {
      const el = app.refs.$(id);
      if (!el || el.parentElement === app.refs.immersiveQuickbarEl) return;
      frag.appendChild(el);
      restoredCount += 1;
    });
    if (restoredCount > 0) {
      if (app.immersiveQuickbarState.marker && app.immersiveQuickbarState.marker.parentNode === app.refs.immersiveQuickbarEl) {
        app.refs.immersiveQuickbarEl.insertBefore(frag, app.immersiveQuickbarState.marker);
      } else {
        app.refs.immersiveQuickbarEl.appendChild(frag);
      }
    }
    if (app.immersiveQuickbarState.marker) app.immersiveQuickbarState.marker.remove();
    app.immersiveQuickbarState.marker = null;
    app.immersiveQuickbarState.moved = false;
  };

  app.isFullCourtImmersiveStack = function isFullCourtImmersiveStack() {
    return !!(app.state.immersive.enabled && app.state.court === 'full');
  };

  app.syncImmersiveLayoutByCourt = function syncImmersiveLayoutByCourt() {
    const fullCourtStack = app.isFullCourtImmersiveStack();
    document.body.classList.toggle('immersive-fullcourt', fullCourtStack);
    app.setImmersiveRailBalance(app.state.immersive.enabled && !fullCourtStack);
    app.setImmersiveQuickbarDock();
  };

  app.updateNativeFullscreenButton = function updateNativeFullscreenButton() {
    if (!app.refs.nativeFullscreenBtn) return;
    const supported = !!document.fullscreenEnabled;
    if (!supported) {
      app.refs.nativeFullscreenBtn.disabled = true;
      app.refs.nativeFullscreenBtn.setAttribute('aria-pressed', 'false');
      app.refs.nativeFullscreenBtn.textContent = app.t('native_fullscreen_enter');
      app.refs.nativeFullscreenBtn.title = app.t('native_fullscreen_enter');
      return;
    }
    app.refs.nativeFullscreenBtn.disabled = false;
    const active = !!document.fullscreenElement;
    app.refs.nativeFullscreenBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    app.refs.nativeFullscreenBtn.textContent = app.t(active ? 'native_fullscreen_exit' : 'native_fullscreen_enter');
    app.refs.nativeFullscreenBtn.title = app.refs.nativeFullscreenBtn.textContent;
  };

  app.updateImmersiveButtons = function updateImmersiveButtons() {
    const side = app.normalizeImmersiveSide(app.state.immersive.side);
    document.body.setAttribute('data-immersive-side', side);
    if (app.refs.immersiveToggleBtn) {
      app.refs.immersiveToggleBtn.classList.toggle('active', !!app.state.immersive.enabled);
      app.refs.immersiveToggleBtn.setAttribute('aria-pressed', app.state.immersive.enabled ? 'true' : 'false');
      app.refs.immersiveToggleBtn.setAttribute('title', app.t(app.state.immersive.enabled ? 'immersive_exit' : 'immersive_enter'));
    }
    if (app.refs.immersiveExitBtn) app.refs.immersiveExitBtn.textContent = app.t('immersive_exit');
    if (app.refs.immersiveSideBtn) {
      const toLeft = side === 'right';
      app.refs.immersiveSideBtn.textContent = app.t(toLeft ? 'immersive_side_to_left' : 'immersive_side_to_right');
      app.refs.immersiveSideBtn.setAttribute('title', app.t(side === 'left' ? 'immersive_side_left' : 'immersive_side_right'));
    }
  };

  app.setImmersiveSide = function setImmersiveSide(side, opts = {}) {
    app.state.immersive.side = app.normalizeImmersiveSide(side);
    app.updateImmersiveButtons();
    app.syncImmersiveLayoutByCourt();
    if (opts.persist !== false) {
      try { localStorage.setItem(IMMERSIVE_SIDE_KEY, app.state.immersive.side); } catch (_) {}
    }
    if (app.state.immersive.enabled) {
      const prevRect = app.snapshotCourtRect();
      app.resizeForDPI();
      app.remapStateGeometryBetweenRects(prevRect, app.snapshotCourtRect());
      if (app.draw) app.draw();
    }
  };

  app.applyImmersiveMode = function applyImmersiveMode(enabled, opts = {}) {
    const prevRect = app.snapshotCourtRect();
    const next = !!enabled;
    const persist = opts.persist !== false;
    app.state.immersive.enabled = next;
    document.body.classList.toggle('immersive', next);
    document.body.setAttribute('data-immersive-side', app.normalizeImmersiveSide(app.state.immersive.side));
    app.syncImmersiveLayoutByCourt();
    if (next && app.refs.advancedToolbar && app.refs.advancedToolbar.classList.contains('show')) {
      app.refs.advancedToolbar.classList.remove('show');
    }
    const showAdvBtn = app.refs.$('show-advanced');
    if (showAdvBtn && app.refs.advancedToolbar) {
      showAdvBtn.textContent = app.refs.advancedToolbar.classList.contains('show') ? app.t('show_less') : app.t('show_more');
    }
    app.updateImmersiveButtons();
    if (persist) {
      try { localStorage.setItem(LAYOUT_MODE_KEY, next ? 'immersive' : 'classic'); } catch (_) {}
    }
    app.resizeForDPI();
    app.remapStateGeometryBetweenRects(prevRect, app.snapshotCourtRect());
    if (app.draw) app.draw();
  };

  app.initImmersiveControls = function initImmersiveControls() {
    let savedLayoutMode = null;
    let savedSide = null;
    try {
      savedSide = localStorage.getItem(IMMERSIVE_SIDE_KEY);
      savedLayoutMode = localStorage.getItem(LAYOUT_MODE_KEY);
    } catch (_) {}
    app.setImmersiveSide(savedSide || 'right', { persist: false });
    app.applyImmersiveMode(app.normalizeLayoutMode(savedLayoutMode || 'immersive') === 'immersive', { persist: false });
    app.updateNativeFullscreenButton();
    if (app.refs.immersiveToggleBtn) app.refs.immersiveToggleBtn.onclick = () => app.applyImmersiveMode(!app.state.immersive.enabled);
    if (app.refs.immersiveExitBtn) app.refs.immersiveExitBtn.onclick = () => app.applyImmersiveMode(false);
    if (app.refs.immersiveSideBtn) {
      app.refs.immersiveSideBtn.onclick = () => {
        const nextSide = app.state.immersive.side === 'right' ? 'left' : 'right';
        app.setImmersiveSide(nextSide);
      };
    }
    if (app.refs.nativeFullscreenBtn) {
      app.refs.nativeFullscreenBtn.onclick = async () => {
        if (!document.fullscreenEnabled) return;
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch (_) {}
        app.updateNativeFullscreenButton();
      };
    }
    document.addEventListener('fullscreenchange', app.updateNativeFullscreenButton);
  };

  window.addEventListener('storage', (e) => {
    if (e.key === PLAY_FAVORITES_KEY || e.key === PLAY_RECENTS_KEY) {
      if (app.refreshQuickPlayOptions) app.refreshQuickPlayOptions();
    }
    if (e.key === LANG_KEY) app.applyLanguage((e.newValue || 'zh'), { persist: false });
    if (e.key === PLAYER_SIZE_KEY) app.applyPlayerSize((e.newValue || 'normal'), { persist: false });
    if (e.key === IMMERSIVE_SIDE_KEY) app.setImmersiveSide((e.newValue || 'right'), { persist: false });
    if (e.key === LAYOUT_MODE_KEY) app.applyImmersiveMode(app.normalizeLayoutMode(e.newValue || 'immersive') === 'immersive', { persist: false });
  });
}
