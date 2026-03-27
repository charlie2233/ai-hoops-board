import { SAVE_KEY, SAVE_SCHEMA, SAVE_TTL } from '../core/keys.js';

export function registerCore(app) {
  app.bindLongPressClearSave = function bindLongPressClearSave() {
    const el = app.refs.$('clear');
    if (!el) return;
    let timer = null;
    const start = () => {
      timer = setTimeout(() => {
        localStorage.removeItem(SAVE_KEY);
        app.toast(app.t('toast_cleared_saved'));
      }, 800);
    };
    const cancel = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    el.addEventListener('pointerdown', start);
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, cancel));
  };

  app.init = function init() {
    app.updateCanvasAspect();
    app.resizeForDPI();
    app.seedPlayers();
    app.layoutPlayers();
    app.updateDefenseToggleButton();
    app.bindPointerEvents();
    app.draw();
    app.initAITips();

    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const expired = !data.ts || Date.now() - data.ts > SAVE_TTL;
        const incompatible = data.schema !== SAVE_SCHEMA;
        if (expired || incompatible) {
          localStorage.removeItem(SAVE_KEY);
        } else {
          app.restoreScene(data, { redraw: false });
          app.draw();
        }
      }
    } catch (_) {}

    app.bindLongPressClearSave();
    app.ensurePlaysCatalog();
    app.bindReplayControls();
  };

  Object.entries(app.refs.modeButtons).forEach(([key, el]) => {
    if (!el) return;
    el.onclick = () => app.setMode(key);
  });
  if (app.refs.$('undo')) app.refs.$('undo').onclick = () => app.undo();
  if (app.refs.$('redo')) app.refs.$('redo').onclick = () => app.redo();
  if (app.refs.$('clear')) app.refs.$('clear').onclick = () => {
    app.cancelCurrentInteraction();
    app.pushUndo();
    app.state.shapes = [];
    if (app.clearSelection) app.clearSelection({ redraw: false });
    app.draw();
  };
  if (app.refs.$('toggle-court')) app.refs.$('toggle-court').onclick = () => {
    app.cancelCurrentInteraction();
    app.pushUndo();
    app.state.court = app.state.court === 'half' ? 'full' : 'half';
    app.updateCanvasAspect();
    app.resizeForDPI();
    app.layoutPlayers();
    app.draw();
  };
  if (app.refs.$('reset-view')) app.refs.$('reset-view').onclick = () => {
    app.resetView();
    app.draw();
    app.toast(app.t('toast_view_reset'));
  };
  if (app.refs.offenseSelect) app.refs.offenseSelect.onchange = (e) => {
    const next = (e.target && e.target.value) || '1';
    if (String(next) !== String(app.currentBallHandlerId())) app.pushUndo();
    app.setBallHandlerById(next);
  };
  if (app.refs.quickPlaySelect) {
    app.refs.quickPlaySelect.onchange = async (e) => {
      const id = (e.target && e.target.value) || '';
      if (!id) return;
      await app.applyPlayById(id, { sourceKey: 'source_quick' });
      e.target.value = '';
    };
  }
  if (app.refs.randomPlayBtn) app.refs.randomPlayBtn.onclick = () => app.applyRandomPlay();
  if (app.refs.toggleDefenseBtn) app.refs.toggleDefenseBtn.onclick = () => {
    app.cancelCurrentInteraction();
    app.pushUndo();
    app.setDefendersRemoved(!app.areDefendersRemoved());
  };
  if (app.refs.$('export')) {
    app.refs.$('export').onclick = async () => {
      const opts = await app.promptExportOptions();
      if (!opts) return;
      app.exportPNG(opts);
    };
  }
  if (app.refs.$('erase')) {
    app.refs.$('erase').onclick = () => {
      if (app.getSelection && app.getSelection()) {
        if (app.deleteSelectedObject && app.deleteSelectedObject()) return;
        return;
      }
      if (!app.state.shapes.length) return;
      app.pushUndo();
      app.state.shapes.pop();
      if (app.clearSelection) app.clearSelection({ redraw: false });
      app.draw();
      app.toast(app.t('toast_erased_last'));
    };
  }
  if (app.refs.$('save')) {
    app.refs.$('save').onclick = () => {
      const payload = Object.assign({ ts: Date.now(), schema: SAVE_SCHEMA }, app.serializeScene());
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      app.toast(app.t('toast_saved'));
    };
  }
  if (app.refs.$('load')) {
    app.refs.$('load').onclick = () => {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        app.toast(app.t('toast_no_saved'));
        return;
      }
      try {
        const data = JSON.parse(raw);
        app.cancelCurrentInteraction();
        app.pushUndo();
        app.restoreScene(data);
        app.toast(app.t('toast_loaded'));
      } catch (_) {
        app.toast(app.t('toast_load_corrupt'));
      }
    };
  }

  app.initThemeControls();
  app.initLanguageControls();
  app.initPlayerSize();
  app.initImmersiveControls();
  app.setMode('drag');
  app.init();
}
