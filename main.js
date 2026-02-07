// AI 战术板 · Step 1 MVP
// 功能：半场/全场绘制；攻防棋子拖拽；跑位虚线、传球箭头；撤销/重做；导出PNG（水印）
import { getPreset } from './plays/presets.js';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const applied = { id: null, name: null, meta: null };
const aiStrip = document.getElementById('ai-strip');
const activePointers = new Map();

// 长按切换持球人
let longPressTimer = null;
let downPt = null;
const LONG_PRESS_MS = 600;   // 0.6s 触发
const THEME_KEY = 'uiThemeV1';
const THEME_STYLE_KEY = 'uiThemeStyleV1';
const LANG_KEY = 'uiLangV1';
const PLAY_FAVORITES_KEY = 'playFavoritesV1';
const PLAY_RECENTS_KEY = 'playRecentsV1';
const PLAY_RECENTS_LIMIT = 12;


// —— 本地保存策略
const SAVE_KEY = 'boardState_v1';          // 保持原键名即可
const SAVE_SCHEMA = 1;                     // 数据结构版本号（升级结构就 +1）
const SAVE_TTL = 14 * 24 * 3600 * 1000;    // 保存有效期：14 天

const state = {
  court: 'half', // 'half' | 'full'
  mode: 'drag',  // 'drag' | 'run' | 'pass'
  players: [],   // {id, team:'O'|'D', x, y, ball?}
  shapes: [],    // {type:'run'|'pass', pts:[{x,y},...], color, dashed?}
  undoStack: [],
  redoStack: [],
  dragTarget: null,
  drawing: false,
  currentLine: null,
  dpi: window.devicePixelRatio || 1,
  view: {
    scale: 1,
    minScale: 1,
    maxScale: 2.4,
    offsetX: 0,
    offsetY: 0
  },
  gesture: {
    active: false,
    startDist: 0,
    startScale: 1,
    anchorWorld: null
  },
  ai: {
    tips: [],
    idx: 0,
    signature: '',
    timer: null
  },
  uiLang: 'zh'
};

// 放在 state 定义后
const EXPORT_OPTS_KEY = 'exportOpts_v1';
state.exportOpts = (() => {
  try { return Object.assign({ hideDefense:false, bg:'court' }, JSON.parse(localStorage.getItem(EXPORT_OPTS_KEY) || '{}')); }
  catch(_) { return { hideDefense:false, bg:'court' }; }
})();
function saveExportOpts(){ localStorage.setItem(EXPORT_OPTS_KEY, JSON.stringify(state.exportOpts)); }


// UI
const $ = (id)=>document.getElementById(id);
const modeButtons = {
  drag: $('mode-drag'),
  run: $('mode-run'),
  pass: $('mode-pass'),
};
const themeButtons = {
  light: $('theme-light'),
  dark: $('theme-dark')
};
const styleButtons = {
  classic: $('style-classic'),
  vivid: $('style-vivid')
};
const langButtons = {
  zh: $('lang-zh'),
  en: $('lang-en')
};
const themeColorMeta = document.querySelector('meta[name=\"theme-color\"]');
const offenseSelect = $('offense-player');
const quickPlaySelect = $('quick-play');
const randomPlayBtn = $('random-play');
const toggleDefenseBtn = $('toggle-defense');
let playsCatalog = [];
let playsCatalogLoaded = false;

const I18N = {
  zh: {
    app_title: 'AI 战术板',
    app_sub: 'Basketball Play Designer',
    creator_label: '制作团队：',
    badge_step: 'Step 1',
    theme_light: '浅色',
    theme_dark: '深色',
    style_classic: '经典',
    style_vivid: '动感',
    lang_zh: '中文',
    lang_en: 'EN',
    mode_drag: '拖拽',
    mode_run: '跑位线',
    mode_pass: '传球箭头',
    toggle_defense_remove: '移除防守',
    toggle_defense_restore: '恢复防守',
    ball_handler_opt: '持球人：{n}',
    quick_play_pick: '快速战术：选择',
    random_play: '随机战术',
    undo: '撤销',
    redo: '重做',
    play: '回放',
    erase: '橡皮擦',
    reset_view: '重置视图',
    link_library: '战术库',
    link_drills: '训练',
    link_settings: '设置',
    show_more: '更多 ▼',
    show_less: '更多 ▲',
    toggle_court_short: '切换半场/全场',
    stop: '停止',
    speed_half: '0.5×',
    speed_default: '0.75× 默认',
    speed_1: '1×',
    speed_2: '2×',
    ai_loading: 'AI 提示：正在分析当前站位…',
    board_hint: '手指拖动圆点移动球员；在“跑位线/传球箭头”模式下拖动绘制；可一键移除/恢复防守；双指可缩放/平移画板；支持撤销/重做与导出 PNG。',
    clear: '清空',
    toggle_court: '切换：半场/全场',
    save: '保存',
    load: '载入',
    export_png: '导出 PNG',
    aria_ball_handler: '持球人选择',
    aria_quick_play: '快速战术',
    aria_toggle_defense: '移除或恢复防守球员',
    replay_pause: '⏸ 暂停',
    replay_resume: '▶ 继续',
    replay_replay: '▶ 回放',
    toast_view_reset: '视图已重置',
    toast_erased_last: '已删除最近一条线',
    toast_saved: '已保存到本地',
    toast_no_saved: '没有可载入的本地保存',
    toast_loaded: '载入完成',
    toast_load_corrupt: '载入失败：数据损坏',
    toast_cleared_saved: '已清除本地保存',
    toast_no_geom: '未找到战术几何，已保持当前布置',
    toast_defense_removed: '已移除防守球员',
    toast_defense_restored: '已恢复防守球员',
    toast_applied: '已应用：{name}（{src}{kind}）',
    toast_no_plays: '战术库为空',
    toast_ball_handler: '持球人：{id}',
    toast_applied_offline: '已应用：{id}（离线预设）',
    source_quick: '快速选择',
    source_random: '随机',
    source_random_fav: '随机(收藏)',
    source_link: '链接应用',
    geom_json: 'JSON.geometry',
    geom_simple: 'JSON(简化)',
    geom_preset_alias: '预设(preset)',
    geom_preset: '预设',
    geom_fallback: '预设兜底',
    group_favorites: '收藏',
    group_recent: '最近使用',
    group_all: '全部战术',
    spacing_alert: '拉开',
    ai_no_tip: 'AI 提示：当前没有建议，继续绘制即可。',
    ai_prefix_one: 'AI 提示：',
    ai_prefix_multi: 'AI 提示（{i}/{n}）：',
    ai_close_pair: '{a} 与 {b} 过近，建议一人拉到 45° 或底角。',
    ai_first_action: '先画第 1 个动作：为持球人添加跑位线或传球箭头。',
    ai_need_pass: '已有跑位线但没有传球箭头，补 1 次传导把优势转化成出手。',
    ai_need_run: '只有传球没有无球移动，建议补 1 条跑位线避免站桩。',
    ai_good_shape: '线路已成型，可点击“回放”检查先后时序与接应点。',
    ai_ball_handler_now: '当前持球人为 {id} 号，切到“跑位线”可更快标出第一拍。',
    ai_cues: '战术口令：{text}',
    ai_errors: '常见错误：{text}。',
    ai_full_court: '全场模式建议先标推进传球，再落位执行半场动作。',
    export_title: '导出选项',
    export_bg: '背景',
    export_bg_court: '球场背景（默认）',
    export_bg_white: '白底（适合讲解/打印）',
    export_vis: '显示内容',
    export_vis_all: '进攻 + 防守（默认）',
    export_vis_offense: '仅进攻（隐藏 X1–X5）',
    cancel: '取消',
    export: '导出',
    export_play_named: '战术：{name}',
    export_play_unnamed: '战术：未命名',
    court_half: '半场',
    court_full: '全场',
    watermark: 'AI 战术板'
  },
  en: {
    app_title: 'AI Hoops Board',
    app_sub: 'Basketball Play Designer',
    creator_label: 'Created by',
    badge_step: 'Step 1',
    theme_light: 'Light',
    theme_dark: 'Dark',
    style_classic: 'Classic',
    style_vivid: 'Vivid',
    lang_zh: '中文',
    lang_en: 'EN',
    mode_drag: 'Drag',
    mode_run: 'Run Line',
    mode_pass: 'Pass Arrow',
    toggle_defense_remove: 'Remove Defense',
    toggle_defense_restore: 'Restore Defense',
    ball_handler_opt: 'Ball Handler: {n}',
    quick_play_pick: 'Quick Play: Select',
    random_play: 'Random Play',
    undo: 'Undo',
    redo: 'Redo',
    play: 'Replay',
    erase: 'Eraser',
    reset_view: 'Reset View',
    link_library: 'Play Library',
    link_drills: 'Drills',
    link_settings: 'Settings',
    show_more: 'More ▼',
    show_less: 'More ▲',
    toggle_court_short: 'Toggle Half/Full',
    stop: 'Stop',
    speed_half: '0.5x',
    speed_default: '0.75x Default',
    speed_1: '1x',
    speed_2: '2x',
    ai_loading: 'AI Tip: analyzing current spacing...',
    board_hint: 'Drag circles to move players. Draw in Run Line/Pass Arrow mode. You can remove/restore defenders anytime. Pinch to zoom and pan. Supports undo/redo and PNG export.',
    clear: 'Clear',
    toggle_court: 'Toggle: Half/Full',
    save: 'Save',
    load: 'Load',
    export_png: 'Export PNG',
    aria_ball_handler: 'Ball handler selection',
    aria_quick_play: 'Quick play',
    aria_toggle_defense: 'Remove or restore defenders',
    replay_pause: '⏸ Pause',
    replay_resume: '▶ Resume',
    replay_replay: '▶ Replay',
    toast_view_reset: 'View reset',
    toast_erased_last: 'Removed the last line',
    toast_saved: 'Saved locally',
    toast_no_saved: 'No local save found',
    toast_loaded: 'Load complete',
    toast_load_corrupt: 'Load failed: corrupted data',
    toast_cleared_saved: 'Local save cleared',
    toast_no_geom: 'Play geometry not found; kept current layout',
    toast_defense_removed: 'Defenders removed',
    toast_defense_restored: 'Defenders restored',
    toast_applied: 'Applied: {name} ({src}{kind})',
    toast_no_plays: 'Play library is empty',
    toast_ball_handler: 'Ball handler: {id}',
    toast_applied_offline: 'Applied: {id} (offline preset)',
    source_quick: 'Quick Select',
    source_random: 'Random',
    source_random_fav: 'Random (Favorites)',
    source_link: 'Link Apply',
    geom_json: 'JSON.geometry',
    geom_simple: 'JSON(simple)',
    geom_preset_alias: 'Preset(alias)',
    geom_preset: 'Preset',
    geom_fallback: 'Preset fallback',
    group_favorites: 'Favorites',
    group_recent: 'Recent',
    group_all: 'All Plays',
    spacing_alert: 'Space',
    ai_no_tip: 'AI Tip: no suggestions right now, keep drawing.',
    ai_prefix_one: 'AI Tip:',
    ai_prefix_multi: 'AI Tip ({i}/{n}):',
    ai_close_pair: '{a} and {b} are too close. Move one to slot or corner.',
    ai_first_action: 'Draw the first action: add a run line or a pass arrow.',
    ai_need_pass: 'You have run lines but no pass arrow. Add one pass to convert the advantage.',
    ai_need_run: 'You have pass arrows but no off-ball movement. Add one run line.',
    ai_good_shape: 'Sequence looks good. Press replay to verify timing and catch points.',
    ai_ball_handler_now: 'Current ball handler is #{id}. Switch to Run Line for first action mapping.',
    ai_cues: 'Cues: {text}',
    ai_errors: 'Common mistake: {text}.',
    ai_full_court: 'In full-court mode, map advance pass first, then flow into half-court action.',
    export_title: 'Export Options',
    export_bg: 'Background',
    export_bg_court: 'Court Background (default)',
    export_bg_white: 'White Background (for teaching/printing)',
    export_vis: 'Visibility',
    export_vis_all: 'Offense + Defense (default)',
    export_vis_offense: 'Offense Only (hide X1-X5)',
    cancel: 'Cancel',
    export: 'Export',
    export_play_named: 'Play: {name}',
    export_play_unnamed: 'Play: Untitled',
    court_half: 'Half Court',
    court_full: 'Full Court',
    watermark: 'AI Hoops Board'
  }
};

function normalizeTheme(theme){
  return theme === 'dark' ? 'dark' : 'light';
}

function normalizeStyle(style){
  return style === 'vivid' ? 'vivid' : 'classic';
}

function normalizeLang(lang){
  return lang === 'en' ? 'en' : 'zh';
}

function t(key, vars = {}){
  const lang = normalizeLang(state.uiLang);
  const dict = I18N[lang] || I18N.zh;
  const base = dict[key] ?? I18N.zh[key] ?? key;
  return String(base).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function refreshLangButtons(lang){
  const l = normalizeLang(lang);
  Object.entries(langButtons).forEach(([k, el]) => {
    if (!el) return;
    const active = k === l;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateReplayButtonLabel(){
  const bp = document.getElementById('btn-playpause');
  if (!bp) return;
  if (!state.replay || !state.replay.playing){
    bp.textContent = t('replay_replay');
    return;
  }
  bp.textContent = state.replay.paused ? t('replay_resume') : t('replay_pause');
}

function renderLanguageUI(){
  document.title = t('app_title');
  const setText = (id, key, vars = null) => {
    const el = $(id);
    if (!el) return;
    el.textContent = vars ? t(key, vars) : t(key);
  };
  
  const setTitle = (id, key) => {
    const el = $(id);
    if (!el) return;
    el.setAttribute('title', t(key));
  };

  setText('app-title', 'app_title');
  setText('app-sub', 'app_sub');
  setText('creator-label', 'creator_label');
  setText('badge-step', 'badge_step');
  setText('theme-light', 'theme_light');
  setText('theme-dark', 'theme_dark');
  setText('style-classic', 'style_classic');
  setText('style-vivid', 'style_vivid');
  setText('lang-zh', 'lang_zh');
  setText('lang-en', 'lang_en');
  setText('mode-drag', 'mode_drag');
  setText('mode-run', 'mode_run');
  setText('mode-pass', 'mode_pass');
  setText('random-play', 'random_play');
  setText('undo', 'undo');
  setText('redo', 'redo');
  setText('play', 'play');
  setText('erase', 'erase');
  setText('reset-view', 'reset_view');
  setText('link-library', 'link_library');
  setText('link-drills', 'link_drills');
  setTitle('link-settings', 'link_settings');
  setText('toggle-court', 'toggle_court_short');
  
  // Update "More" button based on current state
  const showAdvBtn = $('show-advanced');
  const advToolbar = $('advanced-toolbar');
  if(showAdvBtn && advToolbar) {
    const isVisible = advToolbar.classList.contains('show');
    showAdvBtn.textContent = isVisible ? t('show_less') : t('show_more');
  }
  
  setText('btn-stop', 'stop');
  setText('clear', 'clear');
  setText('save', 'save');
  setText('load', 'load');
  setText('export', 'export_png');
  setText('board-hint', 'board_hint');

  const speed = $('speed');
  if (speed){
    const o05 = speed.querySelector('option[value="0.5"]');
    const o075 = speed.querySelector('option[value="0.75"]');
    const o1 = speed.querySelector('option[value="1"]');
    const o2 = speed.querySelector('option[value="2"]');
    if (o05) o05.textContent = t('speed_half');
    if (o075) o075.textContent = t('speed_default');
    if (o1) o1.textContent = t('speed_1');
    if (o2) o2.textContent = t('speed_2');
  }

  if (offenseSelect){
    offenseSelect.setAttribute('aria-label', t('aria_ball_handler'));
    for (let i = 1; i <= 5; i++){
      const op = offenseSelect.querySelector(`option[value="${i}"]`);
      if (op) op.textContent = t('ball_handler_opt', { n: i });
    }
  }
  if (quickPlaySelect){
    quickPlaySelect.setAttribute('aria-label', t('aria_quick_play'));
  }
  if (toggleDefenseBtn){
    toggleDefenseBtn.setAttribute('aria-label', t('aria_toggle_defense'));
  }
  updateDefenseToggleButton();

  if (!state.ai?.tips?.length && aiStrip){
    aiStrip.textContent = t('ai_loading');
  }

  updateReplayButtonLabel();
}

function applyLanguage(lang, opts = {}){
  const l = normalizeLang(lang);
  state.uiLang = l;
  document.documentElement.setAttribute('data-lang', l);
  document.documentElement.lang = l === 'en' ? 'en' : 'zh-CN';
  refreshLangButtons(l);
  renderLanguageUI();
  refreshQuickPlayOptions();
  refreshAITips(true);
  if (state.players.length) draw();
  if (opts.persist !== false){
    try { localStorage.setItem(LANG_KEY, l); } catch(_) {}
  }
}

function initLanguageControls(){
  let saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch(_) {}
  const current = document.documentElement.getAttribute('data-lang');
  applyLanguage(saved || current || 'zh', { persist: false });
  if (langButtons.zh) langButtons.zh.onclick = () => applyLanguage('zh');
  if (langButtons.en) langButtons.en.onclick = () => applyLanguage('en');
}

function updateThemeColorMeta(theme = normalizeTheme(document.documentElement.getAttribute('data-theme')),
  style = normalizeStyle(document.documentElement.getAttribute('data-style'))){
  if (!themeColorMeta) return;
  if (theme === 'dark'){
    themeColorMeta.setAttribute('content', style === 'vivid' ? '#0f172a' : '#0b1220');
  } else {
    themeColorMeta.setAttribute('content', style === 'vivid' ? '#fff8ef' : '#f4f7ff');
  }
}

function refreshThemeButtons(theme){
  const t = normalizeTheme(theme);
  Object.entries(themeButtons).forEach(([k, el]) => {
    if (!el) return;
    const active = k === t;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function refreshStyleButtons(style){
  const s = normalizeStyle(style);
  Object.entries(styleButtons).forEach(([k, el]) => {
    if (!el) return;
    const active = k === s;
    el.classList.toggle('active', active);
    el.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function applyTheme(theme, opts = {}){
  const t = normalizeTheme(theme);
  document.documentElement.setAttribute('data-theme', t);
  refreshThemeButtons(t);
  updateThemeColorMeta(t);
  if (opts.persist !== false){
    try { localStorage.setItem(THEME_KEY, t); } catch(_) {}
  }
}

function applyThemeStyle(style, opts = {}){
  const s = normalizeStyle(style);
  document.documentElement.setAttribute('data-style', s);
  refreshStyleButtons(s);
  updateThemeColorMeta(undefined, s);
  if (opts.persist !== false){
    try { localStorage.setItem(THEME_STYLE_KEY, s); } catch(_) {}
  }
}

function initThemeControls(){
  let savedTheme = null;
  let savedStyle = null;
  try {
    savedTheme = localStorage.getItem(THEME_KEY);
    savedStyle = localStorage.getItem(THEME_STYLE_KEY);
  } catch(_) {}
  const current = document.documentElement.getAttribute('data-theme');
  const currentStyle = document.documentElement.getAttribute('data-style');
  applyTheme(savedTheme || current || 'light', { persist: false });
  applyThemeStyle(savedStyle || currentStyle || 'classic', { persist: false });
  if (themeButtons.light) themeButtons.light.onclick = () => applyTheme('light');
  if (themeButtons.dark) themeButtons.dark.onclick = () => applyTheme('dark');
  if (styleButtons.classic) styleButtons.classic.onclick = () => applyThemeStyle('classic');
  if (styleButtons.vivid) styleButtons.vivid.onclick = () => applyThemeStyle('vivid');
}

function setMode(m){
  state.mode = m;
  for (const k in modeButtons) modeButtons[k].classList.toggle('active', k===m);
}
modeButtons.drag.onclick=()=>setMode('drag');
modeButtons.run.onclick=()=>setMode('run');
modeButtons.pass.onclick=()=>setMode('pass');
$('undo').onclick=()=>undo();
$('redo').onclick=()=>redo();
$('clear').onclick=()=>{ pushUndo(); state.shapes=[]; draw(); };
$('toggle-court').onclick=()=>{ state.court = (state.court==='half'?'full':'half'); layoutPlayers(); draw(); };
$('reset-view').onclick=()=>{ resetView(); draw(); toast(t('toast_view_reset')); };
if (offenseSelect){
  offenseSelect.onchange = (e) => setBallHandlerById((e.target && e.target.value) || '1');
}
if (quickPlaySelect){
  quickPlaySelect.onchange = async (e) => {
    const id = (e.target && e.target.value) || '';
    if (!id) return;
    await applyPlayById(id, { sourceKey: 'source_quick' });
    e.target.value = '';
  };
}
if (randomPlayBtn){
  randomPlayBtn.onclick = () => { applyRandomPlay(); };
}
if (toggleDefenseBtn){
  toggleDefenseBtn.onclick = () => {
    setDefendersRemoved(!areDefendersRemoved());
  };
}

$('export').onclick = async () => {
  const opts = await promptExportOptions();   // { bg:'court'|'white', hideDefense:boolean } | null
  if (!opts) return;                          // 取消
  exportPNG(opts);
};


// —— 橡皮擦：删除最近一条线
$('erase').onclick = () => {
  if (!state.shapes.length) return;
  pushUndo();
  state.shapes.pop();
  draw();
  toast(t('toast_erased_last'));
};


$('save').onclick = () => {
  const payload = {
    court: state.court,
    players: state.players,
    shapes: state.shapes,
    ts: Date.now(),
    schema: SAVE_SCHEMA
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  toast(t('toast_saved'));
};



$('load').onclick = () => {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { toast(t('toast_no_saved')); return; }
  try {
    const data = JSON.parse(raw);
    pushUndo();
    state.court  = data.court  ?? state.court;
    state.players= data.players ?? state.players;
    state.shapes = data.shapes  ?? [];
    //layoutPlayers(); // 兼容旧结构
    updateDefenseToggleButton();
    draw();
    toast(t('toast_loaded'));
  } catch(e){
    toast(t('toast_load_corrupt'));
  }
};

// $('play').onclick = () => {//btnPlay.onclick = ()=>{
//   // 1) 未播放：可能是初始或“已结束待重播”
//   if(!state.replay.playing){
//     const ended = (state.replay.timeMs >= state.replay.durationMs) && state.replay.durationMs > 0;
//     if (ended) {               // 已结束 → 重播
//       setReplayTime(0);
//       startReplay();
//       btnPlay.textContent = '⏸ 暂停';
//       return;
//     }
//     // 初始播放
//     startReplay();
//     btnPlay.textContent = '⏸ 暂停';
//     return;
//   }

//   // 2) 播放中：切换 暂停/继续
//   if(state.replay.paused){
//     resumeReplay();
//     btnPlay.textContent = '⏸ 暂停';
//   }else{
//     pauseReplay();
//     btnPlay.textContent = '▶ 继续';
//   }
// };

$('play').onclick = () => {
  // 统一用回放控制条的按钮逻辑，避免重复状态机和未定义变量
  const bp = document.getElementById('btn-playpause');
  if (bp) bp.click();
};

initThemeControls();
initLanguageControls();
setMode('drag');
window.addEventListener('storage', (e) => {
  if (e.key === PLAY_FAVORITES_KEY || e.key === PLAY_RECENTS_KEY) {
    refreshQuickPlayOptions();
  }
  if (e.key === LANG_KEY){
    applyLanguage((e.newValue || 'zh'), { persist: false });
  }
});

// Init
function init(){
  resizeForDPI();
  seedPlayers();
  layoutPlayers();
  updateDefenseToggleButton();
  bindPointerEvents();
  draw();
  initAITips();

  // —— 自动恢复（带过期/不兼容处理）
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const expired = !data.ts || Date.now() - data.ts > SAVE_TTL;
      const incompatible = data.schema !== SAVE_SCHEMA;
      if (expired || incompatible) {
        localStorage.removeItem(SAVE_KEY); // 过期或不兼容就直接清
      } else {
        state.court   = data.court   ?? state.court;
        state.players = data.players ?? state.players;
        state.shapes  = data.shapes  ?? [];
        updateDefenseToggleButton();
        draw();
      }
    }
  } catch(_) {}

  // 长按“清空”= 同时清除保存（隐性手势，不加按钮）
  bindLongPressClearSave();
  ensurePlaysCatalog();
}


function bindLongPressClearSave(){
  const el = $('clear');
  if (!el) return;
  let timer = null;
  const start = () => {
    timer = setTimeout(() => {
      localStorage.removeItem(SAVE_KEY);
      toast(t('toast_cleared_saved'));
    }, 800); // 长按 0.8s 触发
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('pointerdown', start);
  ['pointerup','pointercancel','pointerleave'].forEach(ev => el.addEventListener(ev, cancel));
}

function readStoredIds(key, limit = 50){
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    raw.forEach((v) => {
      const id = String(v || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(id);
    });
    return out.slice(0, limit);
  } catch (_) {
    return [];
  }
}

function writeStoredIds(key, ids, limit = 50){
  const seen = new Set();
  const out = [];
  (ids || []).forEach((v) => {
    const id = String(v || '').trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  try { localStorage.setItem(key, JSON.stringify(out.slice(0, limit))); } catch (_) {}
}

function markPlayRecent(id){
  const pid = String(id || '').trim();
  if (!pid) return;
  const old = readStoredIds(PLAY_RECENTS_KEY, PLAY_RECENTS_LIMIT);
  const next = [pid, ...old.filter(x => x !== pid)];
  writeStoredIds(PLAY_RECENTS_KEY, next, PLAY_RECENTS_LIMIT);
}

function getPlayByIdFromCatalog(id){
  const key = String(id || '').trim().toLowerCase();
  if (!key) return null;
  return playsCatalog.find((p) => String(p?.id || '').trim().toLowerCase() === key) || null;
}

function playLabel(play, fallbackId){
  if (!play) return String(fallbackId || '');
  const title = String(play.name || play.id || fallbackId || '').trim();
  const type = String(play.type || '').trim();
  return type ? `${title} · ${type}` : title;
}

function refreshQuickPlayOptions(){
  if (!quickPlaySelect) return;
  const keep = quickPlaySelect.value;
  quickPlaySelect.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = t('quick_play_pick');
  quickPlaySelect.appendChild(first);

  const favorites = readStoredIds(PLAY_FAVORITES_KEY, 200)
    .map((id) => ({ id, play: getPlayByIdFromCatalog(id) }))
    .filter((x) => x.play);
  const recents = readStoredIds(PLAY_RECENTS_KEY, PLAY_RECENTS_LIMIT)
    .map((id) => ({ id, play: getPlayByIdFromCatalog(id) }))
    .filter((x) => x.play);
  const all = playsCatalog
    .filter((p) => p && p.id)
    .slice()
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), state.uiLang === 'en' ? 'en' : 'zh-Hans-CN'));

  const appendGroup = (label, items, prefix = '') => {
    if (!items.length) return;
    const group = document.createElement('optgroup');
    group.label = label;
    items.forEach((item) => {
      const play = item.play || item;
      const id = String(item.id || play.id || '').trim();
      if (!id) return;
      const op = document.createElement('option');
      op.value = id;
      op.textContent = `${prefix}${playLabel(play, id)}`;
      group.appendChild(op);
    });
    quickPlaySelect.appendChild(group);
  };

  appendGroup(t('group_favorites'), favorites, '★ ');
  appendGroup(t('group_recent'), recents, '• ');
  appendGroup(t('group_all'), all);

  if (keep && Array.from(quickPlaySelect.options).some(op => op.value === keep)) {
    quickPlaySelect.value = keep;
  }
}

async function ensurePlaysCatalog(force = false){
  if (playsCatalogLoaded && !force) return playsCatalog;
  try {
    const res = await fetch('./plays/plays.json?t=' + Date.now(), { cache: 'no-store' });
    const list = await res.json();
    playsCatalog = Array.isArray(list) ? list : [];
    playsCatalogLoaded = true;
  } catch (_) {
    if (!playsCatalogLoaded) playsCatalog = [];
  }
  refreshQuickPlayOptions();
  return playsCatalog;
}

function resolvePlayGeometry(play, rawId){
  if (play && play.geometry) return { geom: play.geometry, sourceKey: 'geom_json' };
  if (play && (play.offense || play.shapes || play.defense)) return { geom: play, sourceKey: 'geom_simple' };

  if (play){
    const pid = play.preset || play.presetId || play.alias || play.id;
    if (pid){
      const byPreset = getPreset(pid);
      if (byPreset) return { geom: byPreset, sourceKey: 'geom_preset_alias' };
    }
  }

  const byId = getPreset(rawId);
  if (byId) return { geom: byId, sourceKey: 'geom_preset' };

  return { geom: getPreset('fiveOut'), sourceKey: 'geom_fallback' };
}

function syncAppliedMeta(play, rawId){
  applied.id = rawId;
  applied.name = (play && (play.name || play.id)) || rawId;
  applied.meta = play ? {
    cues: Array.isArray(play.cues) ? play.cues : [],
    errors: Array.isArray(play.errors) ? play.errors : [],
    drills: Array.isArray(play.drills) ? play.drills : [],
    type: play.type || '',
    vs: Array.isArray(play.vs) ? play.vs : []
  } : null;
}

async function applyPlayById(rawId, opts = {}){
  const id = String(rawId || '').trim();
  if (!id) return false;

  await ensurePlaysCatalog();
  let play = getPlayByIdFromCatalog(id);
  if (!play && !playsCatalog.length){
    await ensurePlaysCatalog(true);
    play = getPlayByIdFromCatalog(id);
  }

  syncAppliedMeta(play, id);
  const resolved = resolvePlayGeometry(play, id);
  if (!resolved.geom){
    toast(t('toast_no_geom'));
    return false;
  }

  applyPlay(resolved.geom);
  const recentId = String((play && play.id) || id);
  markPlayRecent(recentId);
  refreshQuickPlayOptions();

  if (opts.toast !== false){
    const src = opts.sourceKey ? `${t(opts.sourceKey)} · ` : '';
    toast(t('toast_applied', { name: applied.name, src, kind: t(resolved.sourceKey) }));
  }
  return true;
}

async function applyRandomPlay(){
  await ensurePlaysCatalog();
  const favoritePool = readStoredIds(PLAY_FAVORITES_KEY, 200)
    .filter((id) => !!getPlayByIdFromCatalog(id));
  const fullPool = playsCatalog.map((p) => String(p?.id || '').trim()).filter(Boolean);
  const pool = favoritePool.length ? favoritePool : fullPool;
  if (!pool.length){
    toast(t('toast_no_plays'));
    return;
  }
  const id = pool[Math.floor(Math.random() * pool.length)];
  await applyPlayById(id, { sourceKey: favoritePool.length ? 'source_random_fav' : 'source_random' });
}

function currentBallHandlerId(){
  return state.players.find(p => p.team === 'O' && p.ball)?.id || '';
}

function syncOffenseSelect(){
  if (!offenseSelect) return;
  const id = currentBallHandlerId();
  if (id && offenseSelect.value !== id) offenseSelect.value = id;
}

function setBallHandlerById(id, opts = {}){
  const target = state.players.find(x => x.team === 'O' && x.id === String(id));
  if (!target) return false;
  state.players.forEach(x=>{ if (x.team==='O') x.ball = false; });
  target.ball = true;
  syncOffenseSelect();
  if (opts.redraw !== false) draw();
  if (!opts.silent) toast(t('toast_ball_handler', { id: target.id }));
  return true;
}

function setBallHandler(p){
  if (!p || p.team !== 'O') return;
  setBallHandlerById(p.id);
}

function areDefendersRemoved(){
  const defenders = state.players.filter((p) => p.team === 'D');
  return defenders.length > 0 && defenders.every((p) => !!p.hidden);
}

function updateDefenseToggleButton(){
  if (!toggleDefenseBtn) return;
  const removed = areDefendersRemoved();
  toggleDefenseBtn.textContent = t(removed ? 'toggle_defense_restore' : 'toggle_defense_remove');
  toggleDefenseBtn.classList.toggle('active', removed);
  toggleDefenseBtn.setAttribute('aria-pressed', removed ? 'true' : 'false');
}

function setDefendersRemoved(removed, opts = {}){
  const defenders = state.players.filter((p) => p.team === 'D');
  if (!defenders.length) return;
  defenders.forEach((p) => { p.hidden = !!removed; });
  if (state.dragTarget && state.dragTarget.team === 'D'){
    state.dragTarget = null;
  }
  updateDefenseToggleButton();
  draw();
  if (opts.toast !== false){
    toast(t(removed ? 'toast_defense_removed' : 'toast_defense_restored'));
  }
}

function resizeForDPI(){
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  const ratio = state.dpi;
  canvas.width = Math.round(cssW*ratio);
  canvas.height = Math.round(cssH*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  clampView();
}

window.addEventListener('resize', ()=>{
  resizeForDPI();
  draw();
});

function seedPlayers(){
  state.players = [];
  // Offense 1-5 (blue solid)
  for (let i=1;i<=5;i++){
    state.players.push({id:String(i), team:'O', x:0, y:0, ball: i===1, hidden:false});
  }
  // Defense X1-X5 (red hollow)
  for (let i=1;i<=5;i++){
    state.players.push({id:'X'+i, team:'D', x:0, y:0, hidden:false});
  }
}

function layoutPlayers(){
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  if (state.court==='half'){
    // Place offense top half, defense near paint
    const ox = W*0.18, gap = W*0.13, y1 = H*0.65;
    for (let i=0;i<5;i++){
      state.players[i].x = ox + i*gap;
      state.players[i].y = y1 - (i%2)*H*0.08;
    }
    const dx = W*0.18, dgap = W*0.13, y2 = H*0.35;
    for (let i=0;i<5;i++){
      state.players[5+i].x = dx + i*dgap;
      state.players[5+i].y = y2 + (i%2)*H*0.08;
    }
  } else {
    // Full court distributed
    const cols = 5;
    const rowY = [H*0.28, H*0.72];
    for (let i=0;i<5;i++){
      state.players[i].x = (i+1)*(W/(cols+1));
      state.players[i].y = rowY[1];
      state.players[5+i].x = (i+1)*(W/(cols+1));
      state.players[5+i].y = rowY[0];
    }
  }
}

function drawCourt(){
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E5E7EB';

  if (state.court==='half'){
    // Half court: baseline at bottom, hoop at bottom center
    const centerX = W/2;
    // Outer boundary
    ctx.strokeRect(W*0.05, H*0.05, W*0.90, H*0.90);
    // Midline (top arc only for half)
    ctx.beginPath();
    ctx.arc(centerX, H*0.95, W*0.45, Math.PI, 0);
    ctx.stroke();
    // Three-point arc approx
    ctx.beginPath();
    ctx.arc(centerX, H*0.85, W*0.38, Math.PI*0.9, Math.PI*0.1);
    ctx.stroke();
    // Paint
    ctx.strokeRect(centerX - W*0.12, H*0.72, W*0.24, H*0.18);
    // Hoop
    ctx.beginPath(); ctx.arc(centerX, H*0.92, 9, 0, Math.PI*2); ctx.stroke();
    // Free throw circle
    ctx.beginPath(); ctx.arc(centerX, H*0.72, W*0.12, 0, Math.PI*2); ctx.stroke();
  }else {
    // ------- Full court：左右方向 -------
    const m = Math.min(W, H) * 0.05;
    const left   = m, right  = W - m;
    const top    = m, bottom = H - m;
    const cx = W / 2, cy = H / 2;

    // 外框
    ctx.strokeRect(left, top, right - left, bottom - top);

    // 中线 + 中圈
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(W, H) * 0.07, 0, Math.PI * 2); ctx.stroke();

    // 罚球区（左右各一个）
    const laneLen = (right - left) * 0.19;     // 由边线向内的长度
    const laneW   = (bottom - top) * 0.24;     // 罚球区宽度（竖向）
    ctx.strokeRect(left,            cy - laneW/2, laneLen,           laneW);  // 左
    ctx.strokeRect(right - laneLen, cy - laneW/2, laneLen,           laneW);  // 右
    // 罚球圈（完整圆，简化处理）
    ctx.beginPath(); ctx.arc(left  + laneLen,  cy, laneW/2, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(right - laneLen,  cy, laneW/2, 0, Math.PI*2); ctx.stroke();

    // 篮圈
    const rimR = 9;
    const hoopLx = left  + 18, hoopRx = right - 18;
    ctx.beginPath(); ctx.arc(hoopLx, cy, rimR, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(hoopRx, cy, rimR, 0, Math.PI*2); ctx.stroke();

    // 三分线（近角直线 + 弧线）
    const cornerXLeft  = left  + (right - left) * 0.13; // 可在 0.13~0.14 微调
    const cornerXRight = right - (right - left) * 0.13;
    
    // 近角直线（上下两段）
    ctx.beginPath(); ctx.moveTo(cornerXLeft, top);          ctx.lineTo(cornerXLeft, cy - laneW/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cornerXLeft, cy + laneW/2); ctx.lineTo(cornerXLeft, bottom);       ctx.stroke();
    
    ctx.beginPath(); ctx.moveTo(cornerXRight, top);          ctx.lineTo(cornerXRight, cy - laneW/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cornerXRight, cy + laneW/2); ctx.lineTo(cornerXRight, bottom);       ctx.stroke();
    
    // 弧线：用 acos(dx/r3) 计算夹角，避免 NaN
    const r3 = (right - left) * 0.39; // 三分弧半径（可在 0.37~0.41 微调）
    function arcByCorner(hoopX, hoopY, cornerX, side /* 'L' | 'R' */){
      const dx = Math.abs(cornerX - hoopX);
      const R  = Math.max(r3, dx + 1);  // 防止 dx>R
      const theta = Math.acos(dx / R);  // 0~π/2
      ctx.beginPath();
      if (side === 'L'){
        // 以左筐为圆心，朝右开口：-θ → +θ
        ctx.arc(hoopX, hoopY, R, -theta, theta);
      } else {
        // 以右筐为圆心，朝左开口：π-θ → π+θ
        ctx.arc(hoopX, hoopY, R, Math.PI - theta, Math.PI + theta);
      }
      ctx.stroke();
    }
    arcByCorner(hoopLx, cy, cornerXLeft,  'L');
    arcByCorner(hoopRx, cy, cornerXRight, 'R');

  }

  ctx.restore();
}

function drawPlayers(opts = {}){
  const hideDefense = !!opts.hideDefense;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const R = Math.max(16, Math.min(W,H)*0.028);
  state.players.forEach(p=>{
    if (p.hidden) return;
    if (hideDefense && p.team === 'D') return;
    ctx.save();
    if (p.team==='O'){
      ctx.fillStyle = '#2563EB'; // blue solid
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI*2); ctx.fill();
      if (p.ball){
        ctx.fillStyle = '#FF7A1A';
        ctx.beginPath(); ctx.arc(p.x+R*0.6, p.y-R*0.6, R*0.35, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.floor(R)}px system-ui`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.id, p.x, p.y);
    } else {
      ctx.strokeStyle = '#DC2626'; // red hollow
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#DC2626';
      ctx.font = `bold ${Math.floor(R)}px system-ui`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(p.id, p.x, p.y+1);
    }
    ctx.restore();
  });
}

function drawShapes(){
  state.shapes.forEach(s=>{
    if (s.type==='run'){
      drawPolyline(s.pts, '#F59E0B', true); // dashed orange
    } else if (s.type==='pass'){
      drawArrow(s.pts[0], s.pts[s.pts.length-1], '#FF7A1A'); // solid orange
    }
  });
  // current drawing
  if (state.currentLine){
    if (state.currentLine.type==='run'){
      drawPolyline(state.currentLine.pts, '#F59E0B', true);
    } else {
      drawArrow(state.currentLine.pts[0], state.currentLine.pts[state.currentLine.pts.length-1], '#FF7A1A');
    }
  }
}
function spacingThresholdPx(){
  // 阈值≈短边的 9%，可微调
  return Math.min(canvas.clientWidth, canvas.clientHeight) * 0.09;
}

function drawSpacingAlerts(){
  const thr = spacingThresholdPx();
  const O = state.players.filter(p=>p.team==='O');
  for (let i=0;i<O.length;i++){
    for (let j=i+1;j<O.length;j++){
      const a = O[i], b = O[j];
      const d = Math.hypot(a.x-b.x, a.y-b.y);
      if (d < thr){
        const R = Math.max(16, Math.min(canvas.clientWidth, canvas.clientHeight)*0.028);
        const midx = (a.x+b.x)/2, midy = (a.y+b.y)/2;
        [a,b].forEach(p=>{
          ctx.save();
          ctx.strokeStyle = '#F87171';
          ctx.setLineDash([6,6]);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(p.x, p.y, R+8, 0, Math.PI*2); ctx.stroke();
          ctx.restore();
        });
        ctx.save();
        ctx.fillStyle = '#B91C1C';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(t('spacing_alert'), midx, midy);
        ctx.restore();
      }
    }
  }
}

function findClosestOffensePair(){
  const O = state.players.filter(p => p.team === 'O');
  let best = null;
  for (let i = 0; i < O.length; i++){
    for (let j = i + 1; j < O.length; j++){
      const a = O[i], b = O[j];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best || d < best.d) best = { a, b, d };
    }
  }
  return best;
}

function dedupeStrings(items = []){
  const seen = new Set();
  const out = [];
  items.forEach((txt) => {
    const k = (txt || '').trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  });
  return out;
}

function buildAITips(){
  const tips = [];
  const runCount = state.shapes.filter(s => s.type === 'run').length;
  const passCount = state.shapes.filter(s => s.type === 'pass').length;
  const ball = state.players.find(p => p.team === 'O' && p.ball);

  const close = findClosestOffensePair();
  const thr = spacingThresholdPx();
  if (close && close.d < thr){
    tips.push(t('ai_close_pair', { a: close.a.id, b: close.b.id }));
  }

  if (!state.shapes.length){
    tips.push(t('ai_first_action'));
  } else {
    if (runCount >= 2 && passCount === 0){
      tips.push(t('ai_need_pass'));
    }
    if (passCount >= 1 && runCount === 0){
      tips.push(t('ai_need_run'));
    }
    if (runCount > 0 && passCount > 0){
      tips.push(t('ai_good_shape'));
    }
  }

  if (ball && state.mode === 'drag' && state.shapes.length < 2){
    tips.push(t('ai_ball_handler_now', { id: ball.id }));
  }

  if (applied.meta?.cues?.length){
    tips.push(t('ai_cues', { text: applied.meta.cues.slice(0, 2).join(' / ') }));
  }
  if (applied.meta?.errors?.length){
    tips.push(t('ai_errors', { text: applied.meta.errors[0] }));
  }

  if (state.court === 'full' && state.shapes.length){
    tips.push(t('ai_full_court'));
  }

  return dedupeStrings(tips).slice(0, 6);
}

function renderAITip(){
  if (!aiStrip) return;
  if (!state.ai.tips.length){
    aiStrip.textContent = t('ai_no_tip');
    return;
  }
  const idx = Math.max(0, Math.min(state.ai.idx, state.ai.tips.length - 1));
  const prefix = state.ai.tips.length > 1
    ? t('ai_prefix_multi', { i: idx + 1, n: state.ai.tips.length })
    : t('ai_prefix_one');
  aiStrip.textContent = `${prefix}${state.ai.tips[idx]}`;
}

function refreshAITips(force = false){
  if (!aiStrip) return;
  const tips = buildAITips();
  const signature = tips.join('||');
  if (!force && signature === state.ai.signature) return;
  state.ai.signature = signature;
  state.ai.tips = tips;
  state.ai.idx = 0;
  renderAITip();
}

function initAITips(){
  if (!aiStrip) return;
  refreshAITips(true);
  if (state.ai.timer) clearInterval(state.ai.timer);
  state.ai.timer = setInterval(() => {
    if (!state.ai.tips || state.ai.tips.length <= 1) return;
    state.ai.idx = (state.ai.idx + 1) % state.ai.tips.length;
    renderAITip();
  }, 4200);
}

function drawPolyline(pts, color, dashed=false){
  if (pts.length<2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  if (dashed) ctx.setLineDash([10,10]); else ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

function applyPlay(play){
  if (!play) return;
  pushUndo();

  // 1) 切换场地（不再调用 layoutPlayers，因为我们要用战术里的坐标）
  if (play.court === 'half' || play.court === 'full') {
    state.court = play.court;
  }

  // 2) 进攻 O1~O5（你的 O 是 1..5）
  if (Array.isArray(play.offense)){
    for (let i = 0; i < Math.min(5, play.offense.length); i++){
      const p = state.players[i];                 // 1..5
      const n = play.offense[i];                  // {x:0..1, y:0..1}
      if (p && n) {
        const px = normToPx(n);
        p.x = px.x; p.y = px.y;
      }
    }
  }

  // 3) 防守 X1~X5（你的 D 是 5..9 索引）
  if (Array.isArray(play.defense)){
    for (let i = 0; i < Math.min(5, play.defense.length); i++){
      const p = state.players[5 + i];             // X1..X5
      const n = play.defense[i];
      if (p && n) {
        const px = normToPx(n);
        p.x = px.x; p.y = px.y;
      }
    }
  }

  // 4) 线路（跑位/传球）
  if (Array.isArray(play.shapes)){
    state.shapes = play.shapes.map(s => {
      const pts = (s.pts || []).map(normToPx);
      return { type: s.type === 'pass' ? 'pass' : 'run', pts };
    });
  }

  // 5) 持球人（可选字段：ballHandler，取值 '1'..'5'）
  if (play.ballHandler){
    setBallHandlerById(String(play.ballHandler), { silent: true, redraw: false });
  }

  draw();
}

function clampView(){
  const W = canvas.clientWidth || 0;
  const H = canvas.clientHeight || 0;
  const scaledW = W * state.view.scale;
  const scaledH = H * state.view.scale;
  const minX = Math.min(0, W - scaledW);
  const minY = Math.min(0, H - scaledH);
  state.view.offsetX = Math.min(0, Math.max(minX, state.view.offsetX));
  state.view.offsetY = Math.min(0, Math.max(minY, state.view.offsetY));
}

function resetView(){
  state.view.scale = 1;
  state.view.offsetX = 0;
  state.view.offsetY = 0;
  state.gesture.active = false;
  state.gesture.anchorWorld = null;
  clampView();
}

function getPointerScreenPos(e){
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function screenToWorld(pt){
  return {
    x: (pt.x - state.view.offsetX) / state.view.scale,
    y: (pt.y - state.view.offsetY) / state.view.scale
  };
}

function clampScale(v){
  return Math.max(state.view.minScale, Math.min(state.view.maxScale, v));
}

function firstTwoPointers(){
  const pts = Array.from(activePointers.values());
  if (pts.length < 2) return null;
  return [pts[0], pts[1]];
}

function startGestureFromPointers(){
  const pair = firstTwoPointers();
  if (!pair) return;
  const [a, b] = pair;
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dist = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y));
  state.gesture.active = true;
  state.gesture.startDist = dist;
  state.gesture.startScale = state.view.scale;
  state.gesture.anchorWorld = screenToWorld(center);
}

function updateGestureFromPointers(){
  const pair = firstTwoPointers();
  if (!pair || !state.gesture.active || !state.gesture.anchorWorld) return;
  const [a, b] = pair;
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dist = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y));
  const nextScale = clampScale(state.gesture.startScale * (dist / state.gesture.startDist));
  state.view.scale = nextScale;
  state.view.offsetX = center.x - state.gesture.anchorWorld.x * nextScale;
  state.view.offsetY = center.y - state.gesture.anchorWorld.y * nextScale;
  clampView();
}

function cancelCurrentInteraction(){
  state.dragTarget = null;
  if (state.drawing){
    state.drawing = false;
    state.currentLine = null;
  }
  clearTimeout(longPressTimer);
  longPressTimer = null;
  downPt = null;
}

function drawArrow(p0, p1, color){
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.stroke();
  // arrow head
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const len = 16;
  const a1 = {x: p1.x - len*Math.cos(ang - Math.PI/6), y: p1.y - len*Math.sin(ang - Math.PI/6)};
  const a2 = {x: p1.x - len*Math.cos(ang + Math.PI/6), y: p1.y - len*Math.sin(ang + Math.PI/6)};
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(a1.x, a1.y);
  ctx.lineTo(a2.x, a2.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw(opts = {}){
  const bg = opts.bg || 'court';
  const hideDefense = !!opts.hideDefense;
  const useView = opts.useView !== false;

  if (bg === 'white'){
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
    ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H); ctx.restore();
  }else{
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0,0,W,H);
  }
  ctx.save();
  if (useView){
    ctx.translate(state.view.offsetX, state.view.offsetY);
    ctx.scale(state.view.scale, state.view.scale);
  }
  if (bg !== 'white') drawCourt();
  drawShapes();
  drawPlayers({ hideDefense });
  drawSpacingAlerts();
  ctx.restore();
  syncOffenseSelect();
  refreshAITips();
}



function getPointerPos(e){
  return screenToWorld(getPointerScreenPos(e));
}

function getCourtRect(){
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const m = Math.min(W, H) * 0.05; // 和 drawCourt 外框一致
  return { left: m, top: m, right: W - m, bottom: H - m, width: W - 2*m, height: H - 2*m };
}

function normToPx(pt){
  const r = getCourtRect();
  return {
    x: r.left + pt.x * r.width,
    y: r.top  + pt.y * r.height
  };
}


function nearestPlayer(pt){
  let hit=null, min=1e9;
  const R = Math.max(16, Math.min(canvas.clientWidth, canvas.clientHeight)*0.028);
  state.players.forEach(p=>{
    if (p.hidden) return;
    const d = Math.hypot(p.x-pt.x, p.y-pt.y);
    if (d< R*1.2 && d<min){ min=d; hit=p; }
  });
  return hit;
}

function bindPointerEvents(){
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onUp);
}

function onDown(e){
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  const spt = getPointerScreenPos(e);
  activePointers.set(e.pointerId, spt);

  if (activePointers.size >= 2){
    cancelCurrentInteraction();
    startGestureFromPointers();
    draw();
    return;
  }

  if (state.gesture.active) return;
  const pt = screenToWorld(spt);
  if (state.mode==='drag'){
    const hit = nearestPlayer(pt);
    if (hit){ 
      state.dragTarget = hit;
      downPt = spt;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        if (hit.team === 'O') setBallHandler(hit);
      }, LONG_PRESS_MS);
    }
  } else {
    state.drawing = true;
    state.currentLine = { type: state.mode==='run'?'run':'pass', pts: [pt] };
  }
}

function onMove(e){
  const spt = getPointerScreenPos(e);
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, spt);

  if (activePointers.size >= 2 || state.gesture.active){
    if (!state.gesture.active) startGestureFromPointers();
    updateGestureFromPointers();
    draw();
    return;
  }

  const pt = screenToWorld(spt);

  // 拖动距离超过阈值则取消长按
  if (longPressTimer && downPt){
    const dx = spt.x - downPt.x, dy = spt.y - downPt.y;
    if (dx*dx + dy*dy > 16) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  if (!e.pressure && e.pointerType==='mouse' && e.buttons===0) return;

  if (state.mode==='drag'){
    if (state.dragTarget){
      state.dragTarget.x = pt.x; 
      state.dragTarget.y = pt.y;
      draw();
    }
  } else if (state.drawing){
    const last = state.currentLine.pts[state.currentLine.pts.length-1];
    const dx = pt.x - last.x, dy = pt.y - last.y;
    if (dx*dx + dy*dy > 16) { // reduce noisy points
      state.currentLine.pts.push(pt);
      draw();
    }
  }
}


function onUp(e){
  clearTimeout(longPressTimer); longPressTimer = null; downPt = null;
  activePointers.delete(e.pointerId);

  if (state.gesture.active){
    if (activePointers.size >= 2){
      startGestureFromPointers();
      return;
    }
    state.gesture.active = false;
    state.gesture.anchorWorld = null;
    return;
  }

  if (state.mode==='drag'){
    state.dragTarget = null;
  } else if (state.drawing){
    state.drawing = false;
    if (state.currentLine && state.currentLine.pts.length>1){
      pushUndo();
      state.shapes.push(state.currentLine);
    }
    state.currentLine = null;
    draw();
  }
}

function pushUndo(){
  state.undoStack.push({
    shapes: JSON.parse(JSON.stringify(state.shapes))
  });
  if (state.undoStack.length>50) state.undoStack.shift();
  state.redoStack.length = 0;
}
function undo(){
  if (!state.undoStack.length) return;
  const last = state.undoStack.pop();
  state.redoStack.push({ shapes: JSON.parse(JSON.stringify(state.shapes)) });
  state.shapes = last.shapes;
  draw();
}
function redo(){
  if (!state.redoStack.length) return;
  const next = state.redoStack.pop();
  state.undoStack.push({ shapes: JSON.parse(JSON.stringify(state.shapes)) });
  state.shapes = next.shapes;
  draw();
}
//导出png
function exportPNG(opts = { bg:'court', hideDefense:false }){

  // 显式打开平滑（尤其白底导出）
  if (ctx && 'imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = true;
  // 用本次选择渲染一帧
  draw({ bg: opts.bg, hideDefense: opts.hideDefense, useView: false });

  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.save();

  // ===== 左上角标题块 & 右下水印（保留你现有的样式）=====
  const title = applied.name
    ? t('export_play_named', { name: applied.name })
    : t('export_play_unnamed');
  const meta  = `${state.court==='half' ? t('court_half') : t('court_full')} · ${new Date().toLocaleString()}`;

  ctx.font = 'bold 14px system-ui';
  const tW = ctx.measureText(title).width;
  ctx.font = '12px system-ui';
  const mW = ctx.measureText(meta).width;
  const boxW = Math.max(tW, mW) + 24;
  const boxH = 46, pad = 12;

  roundRect(ctx, pad, pad, boxW, boxH, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#FF7A1A'; ctx.stroke();

  ctx.fillStyle = '#111';
  ctx.font = 'bold 14px system-ui'; ctx.fillText(title, pad + 12, pad + 18);
  ctx.font = '12px system-ui';      ctx.fillText(meta,  pad + 12, pad + 36);

  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.font = 'bold 14px system-ui';
  ctx.fillText(`${t('watermark')} • ${new Date().toLocaleString()}`, W - 220, H - 12);

  ctx.restore();

  // 下载
  const dataURL = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataURL; a.download = (applied.name || 'play') + '.png';
  a.click();

  // 恢复到正常预览
  draw();
}


// 小工具：圆角矩形
function roundRect(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function promptExportOptions(){
  return new Promise((resolve)=>{
    // 遮罩
    const ov = document.createElement('div');
    ov.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:2000;
      display:flex;align-items:center;justify-content:center;padding:16px;`;

    // 弹窗
    const box = document.createElement('div');
    box.style.cssText = `
      width: min(92vw, 420px); background:#fff; border:1px solid #E5E7EB; border-radius:14px;
      box-shadow: 0 20px 60px rgba(0,0,0,.18); font:14px/1.5 system-ui; color:#0F172A;`;
    box.innerHTML = `
      <div style="padding:14px 16px; border-bottom:1px solid #E5E7EB; font-weight:700;">${t('export_title')}</div>
      <div style="padding:16px;">
        <div style="margin-bottom:12px; font-weight:600;">${t('export_bg')}</div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <input type="radio" name="bg" value="court" checked>
          <span>${t('export_bg_court')}</span>
        </label>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
          <input type="radio" name="bg" value="white">
          <span>${t('export_bg_white')}</span>
        </label>

        <div style="margin-bottom:12px; font-weight:600;">${t('export_vis')}</div>
        <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
          <input type="radio" name="vis" value="all" checked>
          <span>${t('export_vis_all')}</span>
        </label>
        <label style="display:flex;gap:8px;align-items:center;">
          <input type="radio" name="vis" value="atk">
          <span>${t('export_vis_offense')}</span>
        </label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #E5E7EB;">
        <button data-act="cancel" style="height:40px;padding:0 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;">${t('cancel')}</button>
        <button data-act="ok"     style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#FF7A1A;color:#fff;font-weight:700;">${t('export')}</button>
      </div>
    `;
    ov.appendChild(box);
    document.body.appendChild(ov);

    const close = () => ov.remove();
    box.querySelector('[data-act="cancel"]').onclick = () => { close(); resolve(null); };
    box.querySelector('[data-act="ok"]').onclick = () => {
      const bg  = box.querySelector('input[name="bg"]:checked').value;
      const vis = box.querySelector('input[name="vis"]:checked').value;
      close();
      resolve({ bg, hideDefense: vis === 'atk' });
    };
    // 点击遮罩关闭
    ov.addEventListener('pointerdown', (e)=>{ if (e.target === ov){ close(); resolve(null); } }, true);
  });
}


init();
readAppliedPlay();   // 启动时尝试接收 Library 的“应用”指令


async function readAppliedPlay(){
  const urlId = new URLSearchParams(location.search).get('apply');
  const lsId = localStorage.getItem('applyPlayId');
  const idRaw = (urlId || lsId || '').trim();
  if (!idRaw) return;

  try {
    await applyPlayById(idRaw, { sourceKey: 'source_link' });
  } catch (_) {
    const fallback = getPreset(idRaw) || getPreset('fiveOut');
    if (fallback){
      applied.id = idRaw;
      applied.name = idRaw;
      applied.meta = null;
      applyPlay(fallback);
      markPlayRecent(idRaw);
      refreshQuickPlayOptions();
      toast(t('toast_applied_offline', { id: idRaw }));
    } else {
      toast(t('toast_no_geom'));
    }
  } finally {
    localStorage.removeItem('applyPlayId');
  }
}




function toastAppliedIfAny(){
  if(!applied.id) return;
  const bar = document.createElement('div');
  bar.textContent = t('toast_applied', { name: applied.name, src: '', kind: t('geom_simple') });
  bar.style.cssText = 'position:fixed;top:56px;left:0;right:0;z-index:999;background:#FFEDD5;color:#9A3412;padding:8px 12px;text-align:center;border-bottom:1px solid #FED7AA';
  document.body.appendChild(bar);
  setTimeout(()=>bar.remove(), 4000);
}

function toast(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);'
    + 'background:#111;color:#fff;padding:8px 12px;border-radius:10px;z-index:999;opacity:.92';
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 1600);
}

// ===== 回放引擎 · Phase B =====
state.replay = { playing:false, paused:false, speed:1, startStamp:0, lastStamp:0,
  timeMs:0, durationMs:0, runs:[], passes:[], snapshot:null, flightBall:null };

const MOVE_SPEED = 320, PASS_SPEED = 900, BASE_DELAY = 600;

// Catmull-Rom 样条 & 折线工具
function catmullRom(a,b,c,d,t){const t2=t*t,t3=t2*t;return{
  x:0.5*((2*b.x)+(-a.x+c.x)*t+(2*a.x-5*b.x+4*c.x-d.x)*t2+(-a.x+3*b.x-3*c.x+d.x)*t3),
  y:0.5*((2*b.y)+(-a.y+c.y)*t+(2*a.y-5*b.y+4*c.y-d.y)*t2+(-a.y+3*b.y-3*c.y+d.y)*t3)};}
function sampleSpline(pts,n=64){ if(!pts||pts.length<3) return pts?.slice()||[];
  const r=[],L=pts.length; for(let i=0;i<L-1;i++){const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(L-1,i+2)];
    for(let k=0;k<(i<L-2?n:1);k++){const t=k/n; r.push(catmullRom(p0,p1,p2,p3,t));}} r.push(pts[L-1]); return r;}
function polyLength(pts){let L=0; for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y); return L;}
function polyLerp(pts,u){if(!pts||!pts.length)return{x:0,y:0}; if(pts.length===1)return pts[0];
  const tot=polyLength(pts); if(!tot) return pts[0]; let d=u*tot;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],seg=Math.hypot(b.x-a.x,b.y-a.y);
    if(d<=seg){const t=seg?d/seg:0;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}} d-=seg;} return pts.at(-1);}

// ===== 路径避障 v0：对 RUN 轨迹做轻微侧移，减少“穿人” =====
const PATHING_AVOIDANCE_KEY = 'pathingAvoidance';
state.pathingAvoidance = (() => {
  try { return JSON.parse(localStorage.getItem(PATHING_AVOIDANCE_KEY) || 'true'); }
  catch(_) { return true; }
})();
function setPathingAvoidance(on){
  state.pathingAvoidance = !!on;
  try { localStorage.setItem(PATHING_AVOIDANCE_KEY, JSON.stringify(state.pathingAvoidance)); } catch(_){}
}
function adjustPathForTeammates(pts, player, teammates, minGapPx){
  if (!state.pathingAvoidance) return pts;
  if (!pts || pts.length < 2) return pts;
  const out = pts.map(p => ({x:p.x, y:p.y}));
  const R = Math.max(16, Math.min(canvas.clientWidth, canvas.clientHeight)*0.028);
  const thr = Math.max(minGapPx || spacingThresholdPx()*0.65, R*1.2);

  // 最多两轮轻量侧移，保证性能
  for (let iter=0; iter<2; iter++){
    for (let i=0; i<out.length; i++){
      const p = out[i];
      for (const tm of teammates){
        if (tm.id === player.id) continue;
        const d = Math.hypot(p.x - tm.x, p.y - tm.y);
        if (d < thr){
          const nx = (p.x - tm.x) / (d || 1), ny = (p.y - tm.y) / (d || 1);
          const push = (thr - d) * 0.55;
          p.x += nx * push;
          p.y += ny * push;
        }
      }
    }
  }
  return out;
}


// 编译时间线（从 shapes 推出 runs/passes）
function compileTimeline(){
  const runs=[],passes=[],O=state.players.filter(p=>p.team==='O');

  // 最近进攻球员匹配器（沿用你现有逻辑）
  const nearest=pt=>O.reduce((m,p)=>{
    const d=Math.hypot(pt.x-p.x,pt.y-p.y);
    return(!m||d<m.d)?{p,d}:m
  },null)?.p;

  // RUN：样条平滑 → 可选避障 → 时长
  state.shapes.filter(s=>s.type==='run'&&s.pts?.length>=2).forEach(s=>{
    const player=nearest(s.pts[0]); if(!player) return;
    const smooth=sampleSpline(s.pts,64);
    // 基于当前帧队友位置做轻度避障
    const teammates = O; // 以 O 队友为参照
    const adjusted = adjustPathForTeammates(smooth, player, teammates);
    const dur=Math.max(0.2,polyLength(adjusted)/MOVE_SPEED);
    runs.push({player,pts:adjusted,t0:0,t1:dur*1000});
  });

  // PASS：按你的启发式生成
  let idx=0;
  state.shapes.filter(s=>s.type==='pass'&&s.pts?.length>=2).forEach(s=>{
    const a=s.pts[0],b=s.pts.at(-1),from=nearest(a),to=nearest(b); if(!from||!to) return;
    const dist=Math.hypot(b.x-a.x,b.y-a.y);
    const dur=Math.max(0.2,dist/PASS_SPEED);
    const t0=BASE_DELAY+idx*300;
    const arc=Math.max(28,Math.min(84,dist*0.18));
    passes.push({from,to,p0:a,p1:b,t0,dur:dur*1000,arc});
    idx++;
  });

  const durationMs=Math.max(
    runs.reduce((m,r)=>Math.max(m,r.t1),0),
    passes.reduce((m,p)=>Math.max(m,p.t0+p.dur),0)
  )||0;

  return {runs,passes,durationMs};
}


// 控制与定位
function startReplay(){
  state.replay.snapshot = {
    players: JSON.parse(JSON.stringify(state.players)),
    ballOwnerId: state.players.find(p=>p.team==='O'&&p.ball)?.id || null
  };
  canvas.style.pointerEvents='none';

  const tl = compileTimeline();
  state.replay.runs = tl.runs;
  state.replay.passes = tl.passes;
  state.replay.durationMs = Math.max(100, tl.durationMs);
  state.replay.timeMs = 0;
  state.replay.playing = true;
  state.replay.paused  = false;

  // 关键：默认 0.75×
  const sel = document.getElementById('speed');
  state.replay.speed = parseFloat((sel && sel.value) ? sel.value : '0.75');

  state.replay.startStamp = performance.now();
  state.replay.lastStamp  = state.replay.startStamp;

  updateReplayButtonLabel();

  requestAnimationFrame(tickReplay);
}

function stopReplay(restore = true){
  state.replay.playing = false;
  state.replay.paused  = false;
  canvas.style.pointerEvents = 'auto';

  if (restore && state.replay.snapshot){
    // 恢复到回放前的站位
    state.players = JSON.parse(JSON.stringify(state.replay.snapshot.players));
    state.players.forEach(p => p.ball = (p.team==='O' && p.id===state.replay.snapshot.ballOwnerId));
  }
  state.replay.flightBall = null;

  draw();

  updateReplayButtonLabel();
  const seek = document.getElementById('seek');
  if (seek) seek.value = 0;                     // 归零
  state.replay.timeMs = 0;                      // 内部时间也归零
}


function pauseReplay(){ state.replay.paused=true; }
function resumeReplay(){ state.replay.paused=false; state.replay.lastStamp=performance.now(); }
function setSpeed(k){ state.replay.speed=Math.max(0.25,Math.min(3,k||1)); }
function setReplayTime(ms){
  const t=Math.max(0,Math.min(state.replay.durationMs,ms|0)); state.replay.timeMs=t;
  state.replay.runs.forEach(r=>{const u=(t<r.t0)?0:(t>r.t1?1:(t-r.t0)/(r.t1-r.t0)); const pos=polyLerp(r.pts,Math.max(0,Math.min(1,u))); r.player.x=pos.x; r.player.y=pos.y;});
  state.players.forEach(p=>{if(p.team==='O') p.ball=false;}); state.replay.flightBall=null;
  let inFlight=null,lastDone=null; state.replay.passes.forEach(p=>{ if(t>=p.t0+p.dur) lastDone=p; else if(t>=p.t0&&t<p.t0+p.dur) inFlight=p;});
  if(inFlight){ const u=(t-inFlight.t0)/inFlight.dur,base=polyLerp([inFlight.p0,inFlight.p1],Math.max(0,Math.min(1,u))),arcY=-4*inFlight.arc*u*(1-u);
    state.replay.flightBall={x:base.x,y:base.y+arcY}; } else { const targetId=lastDone?lastDone.to.id:state.replay.snapshot.ballOwnerId;
    const holder=state.players.find(p=>p.team==='O'&&p.id===targetId); if(holder) holder.ball=true; }
  draw(); const s=document.getElementById('seek'); if(s) s.value=(t/state.replay.durationMs)*100;
}
function tickReplay(now){ if(!state.replay.playing) return;
  if(!state.replay.paused){ const dt=Math.min(50,now-state.replay.lastStamp); const next=state.replay.timeMs+dt*state.replay.speed;
    setReplayTime(next); state.replay.lastStamp=now; if(next>=state.replay.durationMs){ stopReplay(true); return; } }
  requestAnimationFrame(tickReplay);
}
// 包装 draw：回放时绘制飞行球
const _draw_replay_wrap = draw;
draw = function(opts={}){ _draw_replay_wrap(opts);
  if(state.replay&&state.replay.flightBall){ const b=state.replay.flightBall; ctx.save(); ctx.fillStyle='#FF7A1A';
    ctx.beginPath(); ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.fill(); ctx.restore(); } };
// 绑定 UI
(function(){ const $=id=>document.getElementById(id);
  const bp=$('btn-playpause'), bs=$('btn-stop'), seek=$('seek'), spd=$('speed');
  if(bp){ bp.onclick=()=>{ if(!state.replay.playing){ startReplay(); updateReplayButtonLabel(); return; }
    if(state.replay.paused){ resumeReplay(); } else { pauseReplay(); } updateReplayButtonLabel(); };}
  if(bs){ bs.onclick=()=>stopReplay(); }
  if(seek){ seek.oninput=e=>{ if(!state.replay.playing){ const tl=compileTimeline(); state.replay.runs=tl.runs; state.replay.passes=tl.passes; state.replay.durationMs=Math.max(100,tl.durationMs); }
    setReplayTime((parseFloat(e.target.value||'0')/100)*state.replay.durationMs); }; }
  if(spd){ spd.onchange=e=>setSpeed(parseFloat(e.target.value||'1')); }
  
  // Advanced toolbar toggle
  const showAdvBtn = $('show-advanced');
  const advToolbar = $('advanced-toolbar');
  if(showAdvBtn && advToolbar) {
    showAdvBtn.onclick = () => {
      const isVisible = advToolbar.classList.toggle('show');
      showAdvBtn.textContent = isVisible ? t('show_less') : t('show_more');
    };
  }
  
  // Play button shows replay bar
  const playBtn = $('play');
  const replayBar = $('replaybar');
  if(playBtn && replayBar) {
    playBtn.onclick = () => {
      replayBar.style.display = 'flex';
      if(!state.replay.playing){ startReplay(); updateReplayButtonLabel(); }
    };
  }
  
  // Stop button hides replay bar
  if(bs && replayBar) {
    const originalStopHandler = bs.onclick;
    bs.onclick = () => {
      if(originalStopHandler) originalStopHandler();
      replayBar.style.display = 'none';
    };
  }
})();
