import {
  EXPORT_OPTS_KEY,
  SAVE_SCHEMA
} from '../core/keys.js';

function createInitialState() {
  return {
    court: 'half',
    mode: 'drag',
    players: [],
    shapes: [],
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
    uiLang: 'zh',
    playerSize: 'normal',
    immersive: {
      enabled: false,
      side: 'right'
    },
    exportOpts: (() => {
      try {
        return Object.assign({ hideDefense: false, bg: 'court' }, JSON.parse(localStorage.getItem(EXPORT_OPTS_KEY) || '{}'));
      } catch (_) {
        return { hideDefense: false, bg: 'court' };
      }
    })(),
    replay: null,
    pathingAvoidance: true
  };
}

export function attachSceneApi(app) {
  app.state = createInitialState();
  app.saveExportOpts = function saveExportOpts() {
    localStorage.setItem(EXPORT_OPTS_KEY, JSON.stringify(app.state.exportOpts));
  };

  app.serializeScene = function serializeScene() {
    return {
      schema: SAVE_SCHEMA,
      court: app.state.court,
      players: JSON.parse(JSON.stringify(app.state.players)),
      shapes: JSON.parse(JSON.stringify(app.state.shapes)),
      ballHandlerId: app.currentBallHandlerId(),
      defendersRemoved: app.areDefendersRemoved(),
      appliedPlayId: app.applied.id || null
    };
  };

  app.normalizePlayerVisibility = function normalizePlayerVisibility() {
    app.state.players.forEach((p) => {
      if (!p) return;
      if (typeof p.hidden === 'boolean') return;
      p.hidden = p.team === 'D';
    });
  };

  app.currentBallHandlerId = function currentBallHandlerId() {
    return app.state.players.find((p) => p.team === 'O' && p.ball)?.id || '';
  };

  app.syncOffenseSelect = function syncOffenseSelect() {
    if (!app.refs.offenseSelect) return;
    const id = app.currentBallHandlerId();
    if (id && app.refs.offenseSelect.value !== id) app.refs.offenseSelect.value = id;
  };

  app.setBallHandlerById = function setBallHandlerById(id, opts = {}) {
    const target = app.state.players.find((x) => x.team === 'O' && x.id === String(id));
    if (!target) return false;
    app.state.players.forEach((x) => {
      if (x.team === 'O') x.ball = false;
    });
    target.ball = true;
    app.syncOffenseSelect();
    if (opts.redraw !== false && app.draw) app.draw();
    if (!opts.silent && app.toast) app.toast(app.t('toast_ball_handler', { id: target.id }));
    return true;
  };

  app.setBallHandler = function setBallHandler(player) {
    if (!player || player.team !== 'O') return;
    app.setBallHandlerById(player.id);
  };

  app.areDefendersRemoved = function areDefendersRemoved() {
    const defenders = app.state.players.filter((p) => p.team === 'D');
    return defenders.length > 0 && defenders.every((p) => !!p.hidden);
  };

  app.updateDefenseToggleButton = function updateDefenseToggleButton() {
    if (!app.refs.toggleDefenseBtn) return;
    const removed = app.areDefendersRemoved();
    app.refs.toggleDefenseBtn.textContent = app.t(removed ? 'toggle_defense_restore' : 'toggle_defense_remove');
    app.refs.toggleDefenseBtn.classList.toggle('active', removed);
    app.refs.toggleDefenseBtn.setAttribute('aria-pressed', removed ? 'true' : 'false');
  };

  app.setDefendersRemoved = function setDefendersRemoved(removed, opts = {}) {
    const defenders = app.state.players.filter((p) => p.team === 'D');
    if (!defenders.length) return;
    defenders.forEach((p) => {
      p.hidden = !!removed;
    });
    if (app.state.dragTarget && app.state.dragTarget.team === 'D') {
      app.state.dragTarget = null;
    }
    app.updateDefenseToggleButton();
    if (app.draw) app.draw();
    if (opts.toast !== false && app.toast) {
      app.toast(app.t(removed ? 'toast_defense_removed' : 'toast_defense_restored'));
    }
  };

  app.updateCanvasAspect = function updateCanvasAspect() {
    if (app.state.court === 'half') {
      app.canvas.style.aspectRatio = '50 / 47';
    } else {
      app.canvas.style.aspectRatio = '94 / 50';
    }
    if (app.syncImmersiveLayoutByCourt) app.syncImmersiveLayoutByCourt();
  };

  app.resizeForDPI = function resizeForDPI() {
    const cssW = app.canvas.clientWidth;
    const cssH = app.canvas.clientHeight;
    const ratio = app.state.dpi;
    app.canvas.width = Math.round(cssW * ratio);
    app.canvas.height = Math.round(cssH * ratio);
    app.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    app.clampView();
  };

  app.snapshotCourtRect = function snapshotCourtRect() {
    const rect = app.getCourtRect();
    if (!rect) return null;
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return null;
    if (rect.width <= 0 || rect.height <= 0) return null;
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
  };

  app.remapPointBetweenRects = function remapPointBetweenRects(pt, fromRect, toRect) {
    if (!pt || !fromRect || !toRect) return;
    if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) return;
    const rx = (pt.x - fromRect.left) / fromRect.width;
    const ry = (pt.y - fromRect.top) / fromRect.height;
    pt.x = toRect.left + rx * toRect.width;
    pt.y = toRect.top + ry * toRect.height;
  };

  app.remapStateGeometryBetweenRects = function remapStateGeometryBetweenRects(fromRect, toRect) {
    if (!fromRect || !toRect) return;
    if (fromRect.width <= 0 || fromRect.height <= 0 || toRect.width <= 0 || toRect.height <= 0) return;
    app.state.players.forEach((p) => app.remapPointBetweenRects(p, fromRect, toRect));
    app.state.shapes.forEach((shape) => (shape.pts || []).forEach((pt) => app.remapPointBetweenRects(pt, fromRect, toRect)));
    if (app.state.currentLine?.pts) app.state.currentLine.pts.forEach((pt) => app.remapPointBetweenRects(pt, fromRect, toRect));
    if (app.state.replay?.flightBall) app.remapPointBetweenRects(app.state.replay.flightBall, fromRect, toRect);
    if (app.state.replay?.runs) app.state.replay.runs.forEach((run) => (run.pts || []).forEach((pt) => app.remapPointBetweenRects(pt, fromRect, toRect)));
    if (app.state.replay?.passes) {
      app.state.replay.passes.forEach((pass) => {
        app.remapPointBetweenRects(pass.p0, fromRect, toRect);
        app.remapPointBetweenRects(pass.p1, fromRect, toRect);
      });
    }
    if (app.state.replay?.snapshot?.players) {
      app.state.replay.snapshot.players.forEach((p) => app.remapPointBetweenRects(p, fromRect, toRect));
    }
  };

  app.seedPlayers = function seedPlayers() {
    app.state.players = [];
    for (let i = 1; i <= 5; i += 1) {
      app.state.players.push({ id: String(i), team: 'O', x: 0, y: 0, ball: i === 1, hidden: false });
    }
    for (let i = 1; i <= 5; i += 1) {
      app.state.players.push({ id: 'X' + i, team: 'D', x: 0, y: 0, hidden: true });
    }
  };

  app.layoutPlayers = function layoutPlayers() {
    const rect = app.getCourtRect();
    if (app.state.court === 'half') {
      const gap = rect.width * 0.15;
      const ox = rect.left + rect.width / 2 - 2 * gap;
      const oy = rect.top + rect.height * 0.35;
      for (let i = 0; i < 5; i += 1) {
        app.state.players[i].x = ox + i * gap;
        app.state.players[i].y = oy + (i % 2) * rect.height * 0.05;
      }
      const dy = rect.top + rect.height * 0.55;
      for (let i = 0; i < 5; i += 1) {
        app.state.players[5 + i].x = ox + i * gap;
        app.state.players[5 + i].y = dy + (i % 2) * rect.height * 0.05;
      }
      return;
    }

    const rows = 5;
    const stepY = rect.height / (rows + 1);
    const ox = rect.left + rect.width * 0.68;
    const dx = rect.left + rect.width * 0.32;
    for (let i = 0; i < 5; i += 1) {
      const y = rect.top + (i + 1) * stepY;
      const jitter = ((i % 2) ? 1 : -1) * rect.width * 0.015;
      app.state.players[i].x = ox + jitter;
      app.state.players[i].y = y;
      app.state.players[5 + i].x = dx - jitter;
      app.state.players[5 + i].y = y;
    }
  };

  app.playerRadiusPx = function playerRadiusPx() {
    const base = Math.max(18, Math.min(app.canvas.clientWidth, app.canvas.clientHeight) * 0.034);
    const scaleMap = { small: 0.82, normal: 1, large: 1.18, huge: 1.36 };
    const scale = scaleMap[app.normalizePlayerSize(app.state.playerSize)] || 1;
    return Math.min(74, base * scale);
  };

  app.getCourtRect = function getCourtRect() {
    const W = app.canvas.clientWidth;
    const H = app.canvas.clientHeight;
    const pad = Math.min(W, H) * 0.04;
    const availW = W - 2 * pad;
    const availH = H - 2 * pad;
    const ratio = app.state.court === 'half' ? (50 / 47) : (94 / 50);
    let w;
    let h;
    if (availW / availH > ratio) {
      h = availH;
      w = h * ratio;
    } else {
      w = availW;
      h = w / ratio;
    }
    const left = (W - w) / 2;
    const top = (H - h) / 2;
    return { left, top, width: w, height: h, right: left + w, bottom: top + h };
  };

  app.normToPx = function normToPx(pt) {
    const rect = app.getCourtRect();
    return {
      x: rect.left + pt.x * rect.width,
      y: rect.top + pt.y * rect.height
    };
  };

  app.clampView = function clampView() {
    const W = app.canvas.clientWidth || 0;
    const H = app.canvas.clientHeight || 0;
    const scaledW = W * app.state.view.scale;
    const scaledH = H * app.state.view.scale;
    const minX = Math.min(0, W - scaledW);
    const minY = Math.min(0, H - scaledH);
    app.state.view.offsetX = Math.min(0, Math.max(minX, app.state.view.offsetX));
    app.state.view.offsetY = Math.min(0, Math.max(minY, app.state.view.offsetY));
  };

  app.resetView = function resetView() {
    app.state.view.scale = 1;
    app.state.view.offsetX = 0;
    app.state.view.offsetY = 0;
    app.state.gesture.active = false;
    app.state.gesture.anchorWorld = null;
    app.clampView();
  };

  app.restoreScene = function restoreScene(scene, opts = {}) {
    if (!scene) return false;
    app.state.court = scene.court === 'full' ? 'full' : 'half';
    app.state.players = JSON.parse(JSON.stringify(scene.players || []));
    app.state.shapes = JSON.parse(JSON.stringify(scene.shapes || []));
    app.normalizePlayerVisibility();
    app.applied.id = scene.appliedPlayId || null;
    if (scene.ballHandlerId) {
      app.setBallHandlerById(String(scene.ballHandlerId), { silent: true, redraw: false });
    }
    if (typeof scene.defendersRemoved === 'boolean') {
      app.setDefendersRemoved(scene.defendersRemoved, { toast: false });
    }
    app.updateCanvasAspect();
    app.resizeForDPI();
    app.updateDefenseToggleButton();
    if (opts.redraw !== false && app.draw) app.draw();
    return true;
  };

  window.addEventListener('resize', () => {
    const prevRect = app.snapshotCourtRect();
    app.resizeForDPI();
    app.remapStateGeometryBetweenRects(prevRect, app.snapshotCourtRect());
    if (app.draw) app.draw();
  });
}
