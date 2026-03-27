import { LONG_PRESS_MS } from '../core/keys.js';

export function attachInteractionApi(app) {
  app.LONG_PRESS_MS = LONG_PRESS_MS;
  app.activePointers = new Map();
  app.longPressTimer = null;
  app.downPt = null;

  app.getPointerScreenPos = function getPointerScreenPos(e) {
    const rect = app.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  app.screenToWorld = function screenToWorld(pt) {
    return {
      x: (pt.x - app.state.view.offsetX) / app.state.view.scale,
      y: (pt.y - app.state.view.offsetY) / app.state.view.scale
    };
  };

  app.getPointerPos = function getPointerPos(e) {
    return app.screenToWorld(app.getPointerScreenPos(e));
  };

  app.clampScale = function clampScale(v) {
    return Math.max(app.state.view.minScale, Math.min(app.state.view.maxScale, v));
  };

  app.firstTwoPointers = function firstTwoPointers() {
    const pts = Array.from(app.activePointers.values());
    if (pts.length < 2) return null;
    return [pts[0], pts[1]];
  };

  app.startGestureFromPointers = function startGestureFromPointers() {
    const pair = app.firstTwoPointers();
    if (!pair) return;
    const [a, b] = pair;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y));
    app.state.gesture.active = true;
    app.state.gesture.startDist = dist;
    app.state.gesture.startScale = app.state.view.scale;
    app.state.gesture.anchorWorld = app.screenToWorld(center);
  };

  app.updateGestureFromPointers = function updateGestureFromPointers() {
    const pair = app.firstTwoPointers();
    if (!pair || !app.state.gesture.active || !app.state.gesture.anchorWorld) return;
    const [a, b] = pair;
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const dist = Math.max(12, Math.hypot(a.x - b.x, a.y - b.y));
    const nextScale = app.clampScale(app.state.gesture.startScale * (dist / app.state.gesture.startDist));
    app.state.view.scale = nextScale;
    app.state.view.offsetX = center.x - app.state.gesture.anchorWorld.x * nextScale;
    app.state.view.offsetY = center.y - app.state.gesture.anchorWorld.y * nextScale;
    app.clampView();
  };

  app.cancelCurrentInteraction = function cancelCurrentInteraction() {
    app.state.dragTarget = null;
    if (app.state.drawing) {
      app.state.drawing = false;
      app.state.currentLine = null;
    }
    clearTimeout(app.longPressTimer);
    app.longPressTimer = null;
    app.downPt = null;
  };

  app.nearestPlayer = function nearestPlayer(pt) {
    let hit = null;
    let min = 1e9;
    const R = app.playerRadiusPx();
    app.state.players.forEach((p) => {
      if (p.hidden) return;
      const d = Math.hypot(p.x - pt.x, p.y - pt.y);
      if (d < R * 1.2 && d < min) {
        min = d;
        hit = p;
      }
    });
    return hit;
  };

  app.onDown = function onDown(e) {
    e.preventDefault();
    app.canvas.setPointerCapture(e.pointerId);
    const spt = app.getPointerScreenPos(e);
    app.activePointers.set(e.pointerId, spt);

    if (app.activePointers.size >= 2) {
      app.cancelCurrentInteraction();
      app.startGestureFromPointers();
      app.draw();
      return;
    }

    if (app.state.gesture.active) return;
    const pt = app.screenToWorld(spt);
    if (app.state.mode === 'drag') {
      const hit = app.nearestPlayer(pt);
      if (hit) {
        app.state.dragTarget = hit;
        app.downPt = spt;
        clearTimeout(app.longPressTimer);
        app.longPressTimer = setTimeout(() => {
          if (hit.team === 'O') app.setBallHandler(hit);
        }, app.LONG_PRESS_MS);
      }
      return;
    }

    app.state.drawing = true;
    app.state.currentLine = { type: app.state.mode === 'run' ? 'run' : 'pass', pts: [pt] };
  };

  app.onMove = function onMove(e) {
    const spt = app.getPointerScreenPos(e);
    if (app.activePointers.has(e.pointerId)) app.activePointers.set(e.pointerId, spt);

    if (app.activePointers.size >= 2 || app.state.gesture.active) {
      if (!app.state.gesture.active) app.startGestureFromPointers();
      app.updateGestureFromPointers();
      app.draw();
      return;
    }

    const pt = app.screenToWorld(spt);
    if (app.longPressTimer && app.downPt) {
      const dx = spt.x - app.downPt.x;
      const dy = spt.y - app.downPt.y;
      if (dx * dx + dy * dy > 16) {
        clearTimeout(app.longPressTimer);
        app.longPressTimer = null;
      }
    }

    if (!e.pressure && e.pointerType === 'mouse' && e.buttons === 0) return;

    if (app.state.mode === 'drag') {
      if (app.state.dragTarget) {
        app.state.dragTarget.x = pt.x;
        app.state.dragTarget.y = pt.y;
        app.draw();
      }
      return;
    }

    if (app.state.drawing) {
      const last = app.state.currentLine.pts[app.state.currentLine.pts.length - 1];
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      if (dx * dx + dy * dy > 16) {
        app.state.currentLine.pts.push(pt);
        app.draw();
      }
    }
  };

  app.onUp = function onUp(e) {
    clearTimeout(app.longPressTimer);
    app.longPressTimer = null;
    app.downPt = null;
    app.activePointers.delete(e.pointerId);

    if (app.state.gesture.active) {
      if (app.activePointers.size >= 2) {
        app.startGestureFromPointers();
        return;
      }
      app.state.gesture.active = false;
      app.state.gesture.anchorWorld = null;
      return;
    }

    if (app.state.mode === 'drag') {
      app.state.dragTarget = null;
      return;
    }

    if (app.state.drawing) {
      app.state.drawing = false;
      if (app.state.currentLine && app.state.currentLine.pts.length > 1) {
        app.pushUndo();
        app.state.shapes.push(app.state.currentLine);
      }
      app.state.currentLine = null;
      app.draw();
    }
  };

  app.bindPointerEvents = function bindPointerEvents() {
    app.canvas.addEventListener('pointerdown', app.onDown);
    app.canvas.addEventListener('pointermove', app.onMove);
    app.canvas.addEventListener('pointerup', app.onUp);
    app.canvas.addEventListener('pointercancel', app.onUp);
    app.canvas.addEventListener('pointerleave', app.onUp);
  };

  app.setMode = function setMode(mode) {
    app.state.mode = mode;
    Object.entries(app.refs.modeButtons).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('active', key === mode);
    });
  };
}
