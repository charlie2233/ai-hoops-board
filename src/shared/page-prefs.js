export const THEME_KEY = 'uiThemeV1';
export const THEME_STYLE_KEY = 'uiThemeStyleV1';
export const LANG_KEY = 'uiLangV1';
export const PLAYER_SIZE_KEY = 'uiPlayerSizeV1';

export function normalizeTheme(theme) {
  return theme === 'dark' ? 'dark' : 'light';
}

export function normalizeStyle(style) {
  return style === 'vivid' ? 'vivid' : 'classic';
}

export function normalizeLang(lang) {
  return lang === 'en' ? 'en' : 'zh';
}

export function normalizePlayerSize(size) {
  return (size === 'small' || size === 'large' || size === 'huge') ? size : 'normal';
}

export function bootstrapPreferenceAttributes(root = document.documentElement) {
  try {
    const theme = localStorage.getItem(THEME_KEY);
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    const style = localStorage.getItem(THEME_STYLE_KEY);
    if (style === 'classic' || style === 'vivid') root.setAttribute('data-style', style);
    const lang = localStorage.getItem(LANG_KEY);
    if (lang === 'zh' || lang === 'en') root.setAttribute('data-lang', lang);
    const playerSize = localStorage.getItem(PLAYER_SIZE_KEY);
    if (playerSize === 'small' || playerSize === 'normal' || playerSize === 'large' || playerSize === 'huge') {
      root.setAttribute('data-player-size', playerSize);
    }
  } catch (_) {}
}

function updateThemeColorMeta(theme, style) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const nextTheme = normalizeTheme(theme ?? document.documentElement.getAttribute('data-theme'));
  const nextStyle = normalizeStyle(style ?? document.documentElement.getAttribute('data-style'));
  if (nextTheme === 'dark') {
    meta.setAttribute('content', nextStyle === 'vivid' ? '#0f172a' : '#0b1220');
  } else {
    meta.setAttribute('content', nextStyle === 'vivid' ? '#fff8ef' : '#f4f7ff');
  }
}

function refreshButtons(buttons, activeValue) {
  Object.entries(buttons || {}).forEach(([key, el]) => {
    if (!el) return;
    const active = key === activeValue;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

export function createPreferenceController({
  themeButtons = {},
  styleButtons = {},
  langButtons = {},
  sizeButtons = {},
  onLanguageChange = () => {}
} = {}) {
  const state = {
    theme: normalizeTheme(document.documentElement.getAttribute('data-theme')),
    style: normalizeStyle(document.documentElement.getAttribute('data-style')),
    lang: normalizeLang(document.documentElement.getAttribute('data-lang')),
    playerSize: normalizePlayerSize(document.documentElement.getAttribute('data-player-size'))
  };

  function applyTheme(theme, persist = true) {
    state.theme = normalizeTheme(theme);
    document.documentElement.setAttribute('data-theme', state.theme);
    refreshButtons(themeButtons, state.theme);
    updateThemeColorMeta(state.theme, state.style);
    if (persist) {
      try { localStorage.setItem(THEME_KEY, state.theme); } catch (_) {}
    }
    return state.theme;
  }

  function applyThemeStyle(style, persist = true) {
    state.style = normalizeStyle(style);
    document.documentElement.setAttribute('data-style', state.style);
    refreshButtons(styleButtons, state.style);
    updateThemeColorMeta(state.theme, state.style);
    if (persist) {
      try { localStorage.setItem(THEME_STYLE_KEY, state.style); } catch (_) {}
    }
    return state.style;
  }

  function applyLanguage(lang, persist = true) {
    state.lang = normalizeLang(lang);
    document.documentElement.setAttribute('data-lang', state.lang);
    document.documentElement.lang = state.lang === 'en' ? 'en' : 'zh-CN';
    refreshButtons(langButtons, state.lang);
    if (persist) {
      try { localStorage.setItem(LANG_KEY, state.lang); } catch (_) {}
    }
    onLanguageChange(state.lang);
    return state.lang;
  }

  function applyPlayerSize(size, persist = true) {
    state.playerSize = normalizePlayerSize(size);
    document.documentElement.setAttribute('data-player-size', state.playerSize);
    refreshButtons(sizeButtons, state.playerSize);
    if (persist) {
      try { localStorage.setItem(PLAYER_SIZE_KEY, state.playerSize); } catch (_) {}
    }
    return state.playerSize;
  }

  function init() {
    let savedTheme = null;
    let savedStyle = null;
    let savedLang = null;
    let savedSize = null;
    try {
      savedTheme = localStorage.getItem(THEME_KEY);
      savedStyle = localStorage.getItem(THEME_STYLE_KEY);
      savedLang = localStorage.getItem(LANG_KEY);
      savedSize = localStorage.getItem(PLAYER_SIZE_KEY);
    } catch (_) {}

    applyTheme(savedTheme || state.theme, false);
    applyThemeStyle(savedStyle || state.style, false);
    applyLanguage(savedLang || state.lang, false);
    applyPlayerSize(savedSize || state.playerSize, false);

    if (themeButtons) {
      Object.keys(themeButtons).forEach((theme) => {
        const el = themeButtons[theme];
        if (!el) return;
        el.addEventListener('click', () => applyTheme(theme));
      });
    }
    if (styleButtons) {
      Object.keys(styleButtons).forEach((style) => {
        const el = styleButtons[style];
        if (!el) return;
        el.addEventListener('click', () => applyThemeStyle(style));
      });
    }
    if (langButtons) {
      Object.keys(langButtons).forEach((lang) => {
        const el = langButtons[lang];
        if (!el) return;
        el.addEventListener('click', () => applyLanguage(lang));
      });
    }
    if (sizeButtons) {
      Object.keys(sizeButtons).forEach((size) => {
        const el = sizeButtons[size];
        if (!el) return;
        el.addEventListener('click', () => applyPlayerSize(size));
      });
    }
  }

  function handleStorageEvent(e) {
    if (!e || !e.key) return;
    if (e.key === THEME_KEY) applyTheme(e.newValue || state.theme, false);
    if (e.key === THEME_STYLE_KEY) applyThemeStyle(e.newValue || state.style, false);
    if (e.key === LANG_KEY) applyLanguage(e.newValue || state.lang, false);
    if (e.key === PLAYER_SIZE_KEY) applyPlayerSize(e.newValue || state.playerSize, false);
  }

  return {
    state,
    init,
    applyTheme,
    applyThemeStyle,
    applyLanguage,
    applyPlayerSize,
    handleStorageEvent
  };
}
