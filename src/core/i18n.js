export function attachI18nApi(app) {
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
    playbook: '战术本',
    link_settings: '设置',
    immersive_enter: '沉浸模式',
    immersive_exit: '原版布局',
    native_fullscreen_enter: '设备全屏',
    native_fullscreen_exit: '退出设备全屏',
    immersive_side_left: '控件在左侧',
    immersive_side_right: '控件在右侧',
    immersive_side_to_left: '移到左侧',
    immersive_side_to_right: '移到右侧',
    show_more: '更多 ▼',
    show_less: '更多 ▲',
    toggle_court_short: '切换半场/全场',
    stop: '停止',
    speed_half: '0.5× 默认',
    speed_default: '0.75×',
    speed_1: '1×',
    speed_2: '2×',
    ai_loading: 'AI 提示：正在分析当前站位…',
    board_hint: '手指拖动圆点移动球员；在“跑位线/传球箭头”模式下拖动绘制；可一键移除/恢复防守；双指可缩放/平移画板；支持撤销/重做与导出 PNG。',
    clear: '清空',
    toggle_court: '切换：半场/全场',
    save: '保存',
    load: '载入',
    export_png: '导出 PNG',
    playbook_title: '战术本',
    playbook_subtitle: '保存、命名、复制、导入和恢复本地战术板；自动保存会在刷新后恢复上一次会话。',
    playbook_close: '关闭',
    playbook_new: '从当前新建',
    playbook_save: '保存',
    playbook_load: '载入',
    playbook_load_current: '载入当前',
    playbook_save_current: '保存当前',
    playbook_rename: '重命名',
    playbook_duplicate: '复制',
    playbook_export: '导出 JSON',
    playbook_delete: '删除',
    playbook_import: '导入 JSON',
    playbook_name_placeholder: '输入战术本名称',
    playbook_help: '选择左侧卡片可载入，右侧按钮可直接更新、复制、导出或删除当前战术本。',
    playbook_status_label: '状态',
    playbook_status_idle: '就绪',
    playbook_status_saved: '已保存 {name}',
    playbook_status_renamed: '已重命名 {name}',
    playbook_status_duplicated: '已复制 {name}',
    playbook_status_deleted: '已删除选中的战术本',
    playbook_status_loaded: '已载入 {name}',
    playbook_status_imported: '已导入 {count} 个战术本',
    playbook_loading: '加载战术本…',
    playbook_storage_unavailable: '本地战术本存储不可用',
    playbook_empty: '还没有保存的战术本。输入名称并点击“从当前新建”即可保存当前画板。',
    playbook_empty_detail: '选择一个战术本来查看预览。',
    playbook_autosave_restored: '已恢复最近会话：{name}',
    playbook_autosave_name: '最近会话',
    playbook_imported: '已导入 {count} 个战术本',
    playbook_import_failed: '导入失败：{file}',
    playbook_confirm_delete: '确定删除“{name}”？',
    playbook_saved: '已保存：{name}',
    playbook_created: '已新建：{name}',
    playbook_renamed: '已重命名：{name}',
    playbook_duplicated: '已复制：{name}',
    playbook_deleted: '已删除：{name}',
    playbook_loaded: '已载入：{name}',
    playbook_exported: '已导出：{name}',
    playbook_offense: '进攻',
    playbook_defense: '防守',
    playbook_shapes: '个动作',
    playbook_created_at: '创建于',
    playbook_updated_at: '更新于',
    playbook_untitled: '未命名战术本',
    playbook_scene_custom: '当前画板',
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
    playbook: 'Playbook',
    link_settings: 'Settings',
    immersive_enter: 'Immersive Mode',
    immersive_exit: 'Original Layout',
    native_fullscreen_enter: 'Device Fullscreen',
    native_fullscreen_exit: 'Exit Device Fullscreen',
    immersive_side_left: 'Controls Left',
    immersive_side_right: 'Controls Right',
    immersive_side_to_left: 'Move Left',
    immersive_side_to_right: 'Move Right',
    show_more: 'More ▼',
    show_less: 'More ▲',
    toggle_court_short: 'Toggle Half/Full',
    stop: 'Stop',
    speed_half: '0.5x Default',
    speed_default: '0.75x',
    speed_1: '1x',
    speed_2: '2x',
    ai_loading: 'AI Tip: analyzing current spacing...',
    board_hint: 'Drag circles to move players. Draw in Run Line/Pass Arrow mode. You can remove/restore defenders anytime. Pinch to zoom and pan. Supports undo/redo and PNG export.',
    clear: 'Clear',
    toggle_court: 'Toggle: Half/Full',
    save: 'Save',
    load: 'Load',
    export_png: 'Export PNG',
    playbook_title: 'Playbook',
    playbook_subtitle: 'Save, name, duplicate, import, and restore local boards. Autosave restores the latest session after refresh.',
    playbook_close: 'Close',
    playbook_new: 'New from Current',
    playbook_save: 'Save',
    playbook_load: 'Load',
    playbook_load_current: 'Load Selected',
    playbook_save_current: 'Save Selected',
    playbook_rename: 'Rename',
    playbook_duplicate: 'Duplicate',
    playbook_export: 'Export JSON',
    playbook_delete: 'Delete',
    playbook_import: 'Import JSON',
    playbook_name_placeholder: 'Name this board',
    playbook_help: 'Select a card on the left to load it. Use the actions on the right to update, duplicate, export, or delete the current board.',
    playbook_status_label: 'Status',
    playbook_status_idle: 'Ready',
    playbook_status_saved: 'Saved {name}',
    playbook_status_renamed: 'Renamed {name}',
    playbook_status_duplicated: 'Duplicated {name}',
    playbook_status_deleted: 'Deleted the selected board',
    playbook_status_loaded: 'Loaded {name}',
    playbook_status_imported: 'Imported {count} boards',
    playbook_loading: 'Loading boards…',
    playbook_storage_unavailable: 'Local playbook storage unavailable',
    playbook_empty: 'No saved boards yet. Enter a name and press New to save the current board.',
    playbook_empty_detail: 'Select a board to preview it.',
    playbook_autosave_restored: 'Restored latest session: {name}',
    playbook_autosave_name: 'Latest Session',
    playbook_imported: 'Imported {count} boards',
    playbook_import_failed: 'Import failed: {file}',
    playbook_confirm_delete: 'Delete "{name}"?',
    playbook_saved: 'Saved: {name}',
    playbook_created: 'Created: {name}',
    playbook_renamed: 'Renamed: {name}',
    playbook_duplicated: 'Duplicated: {name}',
    playbook_deleted: 'Deleted: {name}',
    playbook_loaded: 'Loaded: {name}',
    playbook_exported: 'Exported: {name}',
    playbook_offense: 'Offense',
    playbook_defense: 'Defense',
    playbook_shapes: 'shapes',
    playbook_created_at: 'Created',
    playbook_updated_at: 'Updated',
    playbook_untitled: 'Untitled Board',
    playbook_scene_custom: 'Current Board',
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


  app.I18N = I18N;
  app.normalizeTheme = function normalizeTheme(theme) {
    return theme === 'dark' ? 'dark' : 'light';
  };

  app.normalizeStyle = function normalizeStyle(style) {
    return style === 'vivid' ? 'vivid' : 'classic';
  };

  app.normalizeLang = function normalizeLang(lang) {
    return lang === 'en' ? 'en' : 'zh';
  };

  app.normalizePlayerSize = function normalizePlayerSize(size) {
    return (size === 'small' || size === 'large' || size === 'huge') ? size : 'normal';
  };

  app.normalizeImmersiveSide = function normalizeImmersiveSide(side) {
    return side === 'left' ? 'left' : 'right';
  };

  app.normalizeLayoutMode = function normalizeLayoutMode(mode) {
    return mode === 'classic' ? 'classic' : 'immersive';
  };

  app.t = function t(key, vars = {}) {
    const lang = app.normalizeLang(app.state.uiLang);
    const dict = I18N[lang] || I18N.zh;
    const base = dict[key] ?? I18N.zh[key] ?? key;
    return String(base).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  };

  app.refreshLangButtons = function refreshLangButtons(lang) {
    const next = app.normalizeLang(lang);
    Object.entries(app.refs.langButtons).forEach(([k, el]) => {
      if (!el) return;
      const active = k === next;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  };

  app.updateReplayButtonLabel = function updateReplayButtonLabel() {
    const bp = app.refs.$('btn-playpause');
    if (!bp) return;
    if (!app.state.replay || !app.state.replay.playing) {
      bp.textContent = app.t('replay_replay');
      return;
    }
    bp.textContent = app.state.replay.paused ? app.t('replay_resume') : app.t('replay_pause');
  };

  app.renderLanguageUI = function renderLanguageUI() {
    document.title = app.t('app_title');
    const setText = (id, key, vars = null) => {
      const el = app.refs.$(id);
      if (!el) return;
      el.textContent = vars ? app.t(key, vars) : app.t(key);
    };
    const setIconText = (id, icon, key) => {
      const el = app.refs.$(id);
      if (!el) return;
      el.textContent = `${icon} ${app.t(key)}`;
    };
    const setTitle = (id, key) => {
      const el = app.refs.$(id);
      if (!el) return;
      el.setAttribute('title', app.t(key));
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
    setText('link-playbook', 'playbook');
    setTitle('link-settings', 'link_settings');
    setText('immersive-brand-title', 'app_title');
    setText('immersive-brand-sub', 'app_sub');
    setIconText('immersive-link-settings', '⚙️', 'link_settings');
    setIconText('immersive-link-library', '📚', 'link_library');
    setIconText('immersive-link-drills', '🎯', 'link_drills');
    setTitle('toggle-immersive', app.state.immersive.enabled ? 'immersive_exit' : 'immersive_enter');
    setText('immersive-exit', 'immersive_exit');
    setText('toggle-court', 'toggle_court_short');
    const showAdvBtn = app.refs.$('show-advanced');
    if (showAdvBtn && app.refs.advancedToolbar) {
      const isVisible = app.refs.advancedToolbar.classList.contains('show');
      showAdvBtn.textContent = isVisible ? app.t('show_less') : app.t('show_more');
    }
    setText('btn-stop', 'stop');
    setText('clear', 'clear');
    setText('save', 'save');
    setText('load', 'load');
    setText('export', 'export_png');
    setText('board-hint', 'board_hint');

    const speed = app.refs.$('speed');
    if (speed) {
      const o05 = speed.querySelector('option[value="0.5"]');
      const o075 = speed.querySelector('option[value="0.75"]');
      const o1 = speed.querySelector('option[value="1"]');
      const o2 = speed.querySelector('option[value="2"]');
      if (o05) o05.textContent = app.t('speed_half');
      if (o075) o075.textContent = app.t('speed_default');
      if (o1) o1.textContent = app.t('speed_1');
      if (o2) o2.textContent = app.t('speed_2');
    }

    if (app.refs.offenseSelect) {
      app.refs.offenseSelect.setAttribute('aria-label', app.t('aria_ball_handler'));
      for (let i = 1; i <= 5; i += 1) {
        const op = app.refs.offenseSelect.querySelector(`option[value="${i}"]`);
        if (op) op.textContent = app.t('ball_handler_opt', { n: i });
      }
    }
    if (app.refs.quickPlaySelect) {
      app.refs.quickPlaySelect.setAttribute('aria-label', app.t('aria_quick_play'));
    }
    if (app.refs.toggleDefenseBtn) {
      app.refs.toggleDefenseBtn.setAttribute('aria-label', app.t('aria_toggle_defense'));
    }
    if (app.updateDefenseToggleButton) app.updateDefenseToggleButton();
    if (!app.state.ai?.tips?.length && app.refs.aiStrip) {
      app.refs.aiStrip.textContent = app.t('ai_loading');
    }
    if (app.updateReplayButtonLabel) app.updateReplayButtonLabel();
    if (app.updateNativeFullscreenButton) app.updateNativeFullscreenButton();
    if (app.updateImmersiveButtons) app.updateImmersiveButtons();
  };
}
