function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function shapeSeqFromId(id) {
  const match = /-(\d+)$/.exec(String(id || ''));
  return match ? Number(match[1]) : 0;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function attachEditorApi(app) {
  if (!app.state.editor) {
    app.state.editor = {
      selection: null,
      editSession: null
    };
  }
  app.shapeSeq = 0;

  app.captureSceneSnapshot = function captureSceneSnapshot() {
    return clone(app.serializeScene());
  };

  app.allocateShapeId = function allocateShapeId(prefix = 'shape') {
    app.shapeSeq += 1;
    return `${prefix}-${app.shapeSeq}`;
  };

  app.ensureShapeIds = function ensureShapeIds(shapes = app.state.shapes) {
    let maxSeq = app.shapeSeq;
    (shapes || []).forEach((shape, idx) => {
      if (!shape) return;
      shape.type = shape.type === 'pass' ? 'pass' : 'run';
      if (!Array.isArray(shape.pts)) shape.pts = [];
      if (!shape.id) shape.id = app.allocateShapeId(shape.type || 'shape');
      maxSeq = Math.max(maxSeq, shapeSeqFromId(shape.id), idx + 1);
    });
    app.shapeSeq = maxSeq;
    return shapes;
  };

  app.setSelection = function setSelection(selection, opts = {}) {
    app.state.editor.selection = selection ? clone(selection) : null;
    if (opts.redraw !== false && app.draw) app.draw();
    return app.state.editor.selection;
  };

  app.clearSelection = function clearSelection(opts = {}) {
    return app.setSelection(null, opts);
  };

  app.getSelection = function getSelection() {
    return app.state.editor.selection;
  };

  app.getSelectedPlayer = function getSelectedPlayer() {
    const sel = app.getSelection();
    if (!sel || sel.kind !== 'player') return null;
    return app.state.players.find((player) => player.id === sel.id) || null;
  };

  app.getSelectedShape = function getSelectedShape() {
    const sel = app.getSelection();
    if (!sel || sel.kind !== 'shape') return null;
    return app.state.shapes.find((shape) => shape.id === sel.id) || null;
  };

  app.distanceToSegment = function distanceToSegment(pt, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (!len2) return dist(pt, a);
    let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const x = a.x + t * dx;
    const y = a.y + t * dy;
    return { d: Math.hypot(pt.x - x, pt.y - y), x, y, t };
  };

  app.hitTestPlayer = function hitTestPlayer(pt) {
    let hit = null;
    let min = Infinity;
    const R = app.playerRadiusPx();
    app.state.players.forEach((player) => {
      if (!player || player.hidden) return;
      const d = dist(pt, player);
      if (d <= R * 1.2 && d < min) {
        min = d;
        hit = player;
      }
    });
    return hit;
  };

  app.nearestPlayer = app.hitTestPlayer;

  app.hitTestShape = function hitTestShape(pt) {
    const threshold = Math.max(12, app.playerRadiusPx() * 0.75);
    for (let i = app.state.shapes.length - 1; i >= 0; i -= 1) {
      const shape = app.state.shapes[i];
      const pts = Array.isArray(shape?.pts) ? shape.pts : [];
      if (pts.length < 2) continue;

      for (let p = 0; p < pts.length; p += 1) {
        if (dist(pt, pts[p]) <= threshold) {
          return { shape, kind: 'vertex', pointIndex: p, point: clone(pts[p]) };
        }
      }

      let best = null;
      for (let s = 1; s < pts.length; s += 1) {
        const probe = app.distanceToSegment(pt, pts[s - 1], pts[s]);
        if (!best || probe.d < best.d) {
          best = { ...probe, segmentIndex: s - 1 };
        }
      }
      if (best && best.d <= threshold) {
        if (shape.type === 'pass') {
          return { shape, kind: 'body', segmentIndex: best.segmentIndex, point: { x: best.x, y: best.y } };
        }
        return {
          shape,
          kind: 'insert',
          segmentIndex: best.segmentIndex,
          pointIndex: best.segmentIndex + 1,
          point: { x: best.x, y: best.y }
        };
      }
    }
    return null;
  };

  app.startSceneEdit = function startSceneEdit(session) {
    app.state.editor.editSession = {
      beforeScene: session.beforeScene ? clone(session.beforeScene) : app.captureSceneSnapshot(),
      kind: session.kind || 'shape',
      id: session.id || null,
      pointIndex: Number.isInteger(session.pointIndex) ? session.pointIndex : null,
      segmentIndex: Number.isInteger(session.segmentIndex) ? session.segmentIndex : null,
      changed: false
    };
    return app.state.editor.editSession;
  };

  app.markSceneEditChanged = function markSceneEditChanged() {
    if (app.state.editor.editSession) app.state.editor.editSession.changed = true;
  };

  app.finishSceneEdit = function finishSceneEdit() {
    const edit = app.state.editor.editSession;
    app.state.editor.editSession = null;
    return edit;
  };

  app.cancelSceneEdit = function cancelSceneEdit() {
    app.state.editor.editSession = null;
  };

  app.abortSceneEdit = function abortSceneEdit() {
    const edit = app.state.editor.editSession;
    if (edit?.beforeScene) {
      app.restoreScene(edit.beforeScene, { redraw: false });
      return true;
    }
    app.cancelSceneEdit();
    return false;
  };

  app.moveSelectedHandle = function moveSelectedHandle(pt) {
    const edit = app.state.editor.editSession;
    if (!edit || !Number.isFinite(pt?.x) || !Number.isFinite(pt?.y)) return false;
    if (edit.kind === 'player') {
      const player = app.state.players.find((item) => item.id === edit.id);
      if (!player) return false;
      player.x = pt.x;
      player.y = pt.y;
      app.markSceneEditChanged();
      return true;
    }
    if (edit.kind === 'shape') {
      const shape = app.state.shapes.find((item) => item.id === edit.id);
      if (!shape || !Array.isArray(shape.pts)) return false;
      if (!Number.isInteger(edit.pointIndex) || !shape.pts[edit.pointIndex]) return false;
      shape.pts[edit.pointIndex] = { x: pt.x, y: pt.y };
      app.markSceneEditChanged();
      return true;
    }
    return false;
  };

  app.insertShapePoint = function insertShapePoint(shape, segmentIndex, pt) {
    if (!shape || !Array.isArray(shape.pts)) return null;
    const insertAt = Math.max(0, Math.min(shape.pts.length, segmentIndex + 1));
    shape.pts.splice(insertAt, 0, { x: pt.x, y: pt.y });
    return insertAt;
  };

  app.deleteSelectedObject = function deleteSelectedObject() {
    const sel = app.getSelection();
    if (!sel) return false;
    const before = app.captureSceneSnapshot();
    if (app.cancelCurrentInteraction) app.cancelCurrentInteraction();

    if (sel.kind === 'shape') {
      const idx = app.state.shapes.findIndex((shape) => shape.id === sel.id);
      if (idx < 0) return false;
      app.pushUndo(before);
      app.state.shapes.splice(idx, 1);
      app.clearSelection({ redraw: false });
      if (app.draw) app.draw();
      return true;
    }

    if (sel.kind === 'player') {
      const player = app.state.players.find((item) => item.id === sel.id);
      if (!player || player.team !== 'D') return false;
      app.pushUndo(before);
      player.hidden = true;
      if (player.ball) player.ball = false;
      app.clearSelection({ redraw: false });
      if (app.updateDefenseToggleButton) app.updateDefenseToggleButton();
      if (app.draw) app.draw();
      return true;
    }

    return false;
  };
}
