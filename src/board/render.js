export function attachRenderApi(app) {
  app.courtPalette = function courtPalette() {
    const theme = app.normalizeTheme(document.documentElement.getAttribute('data-theme'));
    const style = app.normalizeStyle(document.documentElement.getAttribute('data-style'));
    if (theme === 'dark' && style === 'vivid') {
      return {
        surfaceA: '#063640',
        surfaceB: '#0b2137',
        grain: 'rgba(148, 231, 221, 0.08)',
        lines: '#eaf4ff',
        keyFill: 'rgba(45, 212, 191, 0.14)',
        centerFill: 'rgba(45, 212, 191, 0.12)',
        rim: '#fb923c',
        board: '#f8fafc'
      };
    }
    if (theme === 'dark') {
      return {
        surfaceA: '#05142c',
        surfaceB: '#0a1f3f',
        grain: 'rgba(148, 163, 184, 0.08)',
        lines: '#e5edf8',
        keyFill: 'rgba(96, 165, 250, 0.14)',
        centerFill: 'rgba(96, 165, 250, 0.10)',
        rim: '#fb923c',
        board: '#f8fafc'
      };
    }
    if (style === 'vivid') {
      return {
        surfaceA: '#fff7ed',
        surfaceB: '#ffe7cf',
        grain: 'rgba(124, 92, 61, 0.11)',
        lines: '#334155',
        keyFill: 'rgba(15, 118, 110, 0.12)',
        centerFill: 'rgba(15, 118, 110, 0.10)',
        rim: '#ea580c',
        board: '#334155'
      };
    }
    return {
      surfaceA: '#f8fbff',
      surfaceB: '#e9f1ff',
      grain: 'rgba(100, 116, 139, 0.10)',
      lines: '#334155',
      keyFill: 'rgba(37, 99, 235, 0.10)',
      centerFill: 'rgba(37, 99, 235, 0.08)',
      rim: '#ea580c',
      board: '#334155'
    };
  };

  app.drawCourt = function drawCourt() {
    const ctx = app.ctx;
    const rect = app.getCourtRect();
    const pal = app.courtPalette();
    const ft = app.state.court === 'half' ? (rect.width / 50) : (rect.height / 50);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    ctx.save();
    const grad = ctx.createLinearGradient(rect.left, rect.top, rect.right, rect.bottom);
    grad.addColorStop(0, pal.surfaceA);
    grad.addColorStop(1, pal.surfaceB);
    ctx.fillStyle = grad;
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);

    ctx.strokeStyle = pal.grain;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    const grainCount = Math.round(rect.height / (4 * ft));
    for (let i = 1; i < grainCount; i += 1) {
      const y = rect.top + (rect.height * i) / grainCount;
      ctx.moveTo(rect.left, y);
      ctx.lineTo(rect.right, y);
    }
    ctx.stroke();

    ctx.strokeStyle = pal.lines;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    const drawHalfEnd = (baselineY, dir) => {
      const hoopY = baselineY + dir * 5.25 * ft;
      const boardY = baselineY + dir * 4 * ft;
      const ftLineY = baselineY + dir * 19 * ft;
      const laneW = 16 * ft;
      const laneH = 19 * ft;
      const laneTop = dir > 0 ? baselineY : baselineY - laneH;
      ctx.fillStyle = pal.keyFill;
      ctx.fillRect(cx - laneW / 2, laneTop, laneW, laneH);
      ctx.strokeRect(cx - laneW / 2, laneTop, laneW, laneH);

      const tickW = 1 * ft;
      const tickPositions = [7, 8, 11, 14];
      ctx.lineWidth = 1.5;
      tickPositions.forEach((d) => {
        const ty = baselineY + dir * d * ft;
        ctx.beginPath();
        ctx.moveTo(cx - laneW / 2 - tickW, ty);
        ctx.lineTo(cx - laneW / 2, ty);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + laneW / 2, ty);
        ctx.lineTo(cx + laneW / 2 + tickW, ty);
        ctx.stroke();
      });
      ctx.lineWidth = 2;

      ctx.fillStyle = pal.centerFill;
      ctx.beginPath();
      ctx.arc(cx, ftLineY, 6 * ft, 0, Math.PI * 2);
      ctx.fill();
      if (dir > 0) {
        ctx.beginPath();
        ctx.arc(cx, ftLineY, 6 * ft, 0, Math.PI);
        ctx.stroke();
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(cx, ftLineY, 6 * ft, Math.PI, 0);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, ftLineY, 6 * ft, Math.PI, 0, true);
        ctx.stroke();
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(cx, ftLineY, 6 * ft, 0, Math.PI, true);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const cornerDist = 22 * ft;
      const arcR = 23.75 * ft;
      const breakDist = Math.sqrt(arcR * arcR - cornerDist * cornerDist);
      const breakY = hoopY + dir * breakDist;
      ctx.beginPath();
      ctx.moveTo(cx - cornerDist, baselineY);
      ctx.lineTo(cx - cornerDist, breakY);
      const angL = Math.atan2((breakY - hoopY), -cornerDist);
      const angR = Math.atan2((breakY - hoopY), cornerDist);
      ctx.arc(cx, hoopY, arcR, angL, angR, dir > 0);
      ctx.lineTo(cx + cornerDist, baselineY);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (dir > 0) ctx.arc(cx, hoopY, 4 * ft, 0, Math.PI);
      else ctx.arc(cx, hoopY, 4 * ft, Math.PI, 0);
      ctx.stroke();
      ctx.lineWidth = 2;

      ctx.strokeStyle = pal.board;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 3 * ft, boardY);
      ctx.lineTo(cx + 3 * ft, boardY);
      ctx.stroke();

      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, hoopY, 0.75 * ft, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      const netDir = -dir;
      const netBottom = hoopY + netDir * 1.5 * ft;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 0.3 * ft, hoopY + netDir * 0.75 * ft);
        ctx.lineTo(cx + i * 0.2 * ft, netBottom);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.lines;
      ctx.lineWidth = 2;
    };

    const drawSideEnd = (baselineX, dir) => {
      const hoopX = baselineX + dir * 5.25 * ft;
      const boardX = baselineX + dir * 4 * ft;
      const ftLineX = baselineX + dir * 19 * ft;
      const laneLen = 19 * ft;
      const laneW = 16 * ft;
      const laneX = dir > 0 ? baselineX : baselineX - laneLen;
      const laneY = cy - laneW / 2;
      ctx.fillStyle = pal.keyFill;
      ctx.fillRect(laneX, laneY, laneLen, laneW);
      ctx.strokeRect(laneX, laneY, laneLen, laneW);

      const tickW = 1 * ft;
      const tickPositions = [7, 8, 11, 14];
      ctx.lineWidth = 1.5;
      tickPositions.forEach((d) => {
        const tx = baselineX + dir * d * ft;
        ctx.beginPath();
        ctx.moveTo(tx, laneY - tickW);
        ctx.lineTo(tx, laneY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(tx, laneY + laneW);
        ctx.lineTo(tx, laneY + laneW + tickW);
        ctx.stroke();
      });
      ctx.lineWidth = 2;

      ctx.fillStyle = pal.centerFill;
      ctx.beginPath();
      ctx.arc(ftLineX, cy, 6 * ft, 0, Math.PI * 2);
      ctx.fill();
      if (dir > 0) {
        ctx.beginPath();
        ctx.arc(ftLineX, cy, 6 * ft, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(ftLineX, cy, 6 * ft, Math.PI / 2, -Math.PI / 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(ftLineX, cy, 6 * ft, Math.PI / 2, -Math.PI / 2, true);
        ctx.stroke();
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.arc(ftLineX, cy, 6 * ft, -Math.PI / 2, Math.PI / 2, true);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const cornerDist = 22 * ft;
      const arcR = 23.75 * ft;
      const breakDist = Math.sqrt(arcR * arcR - cornerDist * cornerDist);
      const breakX = hoopX + dir * breakDist;
      ctx.beginPath();
      ctx.moveTo(baselineX, cy - cornerDist);
      ctx.lineTo(breakX, cy - cornerDist);
      const startAng = Math.atan2(-cornerDist, dir * breakDist);
      const endAng = Math.atan2(cornerDist, dir * breakDist);
      ctx.arc(hoopX, cy, arcR, startAng, endAng, dir < 0);
      ctx.lineTo(baselineX, cy + cornerDist);
      ctx.stroke();

      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (dir > 0) ctx.arc(hoopX, cy, 4 * ft, -Math.PI / 2, Math.PI / 2);
      else ctx.arc(hoopX, cy, 4 * ft, Math.PI / 2, -Math.PI / 2, true);
      ctx.stroke();
      ctx.lineWidth = 2;

      ctx.strokeStyle = pal.board;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boardX, cy - 3 * ft);
      ctx.lineTo(boardX, cy + 3 * ft);
      ctx.stroke();

      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hoopX, cy, 0.75 * ft, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = pal.rim;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      const netDir = -dir;
      const netEndX = hoopX + netDir * 1.5 * ft;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.moveTo(hoopX + netDir * 0.75 * ft, cy + i * 0.3 * ft);
        ctx.lineTo(netEndX, cy + i * 0.2 * ft);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = pal.lines;
      ctx.lineWidth = 2;
    };

    if (app.state.court === 'half') {
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      drawHalfEnd(rect.bottom, -1);
      ctx.beginPath();
      ctx.arc(cx, rect.top, 6 * ft, 0, Math.PI);
      ctx.stroke();
    } else {
      ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
      ctx.beginPath();
      ctx.moveTo(cx, rect.top);
      ctx.lineTo(cx, rect.bottom);
      ctx.stroke();
      ctx.fillStyle = pal.centerFill;
      ctx.beginPath();
      ctx.arc(cx, cy, 6 * ft, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawSideEnd(rect.left, 1);
      drawSideEnd(rect.right, -1);
    }

    ctx.restore();
  };

  app.drawPlayers = function drawPlayers(opts = {}) {
    const hideDefense = !!opts.hideDefense;
    const ctx = app.ctx;
    const R = app.playerRadiusPx();
    app.state.players.forEach((p) => {
      if (p.hidden) return;
      if (hideDefense && p.team === 'D') return;
      ctx.save();
      if (p.team === 'O') {
        ctx.fillStyle = '#2563EB';
        ctx.beginPath();
        ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
        ctx.fill();
        if (p.ball) {
          ctx.fillStyle = '#FF7A1A';
          ctx.beginPath();
          ctx.arc(p.x + R * 0.6, p.y - R * 0.6, R * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.floor(R)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.id, p.x, p.y);
      } else {
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#DC2626';
        ctx.font = `bold ${Math.floor(R)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.id, p.x, p.y + 1);
      }
      ctx.restore();
    });
  };

  app.drawPolyline = function drawPolyline(pts, color, dashed = false) {
    const ctx = app.ctx;
    if (pts.length < 2) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.setLineDash(dashed ? [10, 10] : []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  };

  app.drawArrow = function drawArrow(p0, p1, color) {
    const ctx = app.ctx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const len = 16;
    const a1 = { x: p1.x - len * Math.cos(ang - Math.PI / 6), y: p1.y - len * Math.sin(ang - Math.PI / 6) };
    const a2 = { x: p1.x - len * Math.cos(ang + Math.PI / 6), y: p1.y - len * Math.sin(ang + Math.PI / 6) };
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.lineTo(a2.x, a2.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  app.drawShapes = function drawShapes() {
    app.state.shapes.forEach((shape) => {
      if (shape.type === 'run') app.drawPolyline(shape.pts, '#F59E0B', true);
      else if (shape.type === 'pass') app.drawArrow(shape.pts[0], shape.pts[shape.pts.length - 1], '#FF7A1A');
    });
    if (app.state.currentLine) {
      if (app.state.currentLine.type === 'run') app.drawPolyline(app.state.currentLine.pts, '#F59E0B', true);
      else app.drawArrow(app.state.currentLine.pts[0], app.state.currentLine.pts[app.state.currentLine.pts.length - 1], '#FF7A1A');
    }
  };

  app.spacingThresholdPx = function spacingThresholdPx() {
    return Math.min(app.canvas.clientWidth, app.canvas.clientHeight) * 0.09;
  };

  app.drawSpacingAlerts = function drawSpacingAlerts() {
    const ctx = app.ctx;
    const thr = app.spacingThresholdPx();
    const offense = app.state.players.filter((p) => p.team === 'O');
    for (let i = 0; i < offense.length; i += 1) {
      for (let j = i + 1; j < offense.length; j += 1) {
        const a = offense[i];
        const b = offense[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < thr) {
          const R = app.playerRadiusPx();
          const midx = (a.x + b.x) / 2;
          const midy = (a.y + b.y) / 2;
          [a, b].forEach((p) => {
            ctx.save();
            ctx.strokeStyle = '#F87171';
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, R + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          });
          ctx.save();
          ctx.fillStyle = '#B91C1C';
          ctx.font = 'bold 12px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(app.t('spacing_alert'), midx, midy);
          ctx.restore();
        }
      }
    }
  };

  app.findClosestOffensePair = function findClosestOffensePair() {
    const offense = app.state.players.filter((p) => p.team === 'O');
    let best = null;
    for (let i = 0; i < offense.length; i += 1) {
      for (let j = i + 1; j < offense.length; j += 1) {
        const a = offense[i];
        const b = offense[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    return best;
  };

  app.dedupeStrings = function dedupeStrings(items = []) {
    const seen = new Set();
    const out = [];
    items.forEach((txt) => {
      const key = (txt || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });
    return out;
  };

  app.buildAITips = function buildAITips() {
    const tips = [];
    const runCount = app.state.shapes.filter((s) => s.type === 'run').length;
    const passCount = app.state.shapes.filter((s) => s.type === 'pass').length;
    const ball = app.state.players.find((p) => p.team === 'O' && p.ball);
    const close = app.findClosestOffensePair();
    const thr = app.spacingThresholdPx();
    if (close && close.d < thr) tips.push(app.t('ai_close_pair', { a: close.a.id, b: close.b.id }));
    if (!app.state.shapes.length) tips.push(app.t('ai_first_action'));
    else {
      if (runCount >= 2 && passCount === 0) tips.push(app.t('ai_need_pass'));
      if (passCount >= 1 && runCount === 0) tips.push(app.t('ai_need_run'));
      if (runCount > 0 && passCount > 0) tips.push(app.t('ai_good_shape'));
    }
    if (ball && app.state.mode === 'drag' && app.state.shapes.length < 2) {
      tips.push(app.t('ai_ball_handler_now', { id: ball.id }));
    }
    if (app.applied.meta?.cues?.length) tips.push(app.t('ai_cues', { text: app.applied.meta.cues.slice(0, 2).join(' / ') }));
    if (app.applied.meta?.errors?.length) tips.push(app.t('ai_errors', { text: app.applied.meta.errors[0] }));
    if (app.state.court === 'full' && app.state.shapes.length) tips.push(app.t('ai_full_court'));
    return app.dedupeStrings(tips).slice(0, 6);
  };

  app.renderAITip = function renderAITip() {
    if (!app.refs.aiStrip) return;
    if (!app.state.ai.tips.length) {
      app.refs.aiStrip.textContent = app.t('ai_no_tip');
      return;
    }
    const idx = Math.max(0, Math.min(app.state.ai.idx, app.state.ai.tips.length - 1));
    const prefix = app.state.ai.tips.length > 1
      ? app.t('ai_prefix_multi', { i: idx + 1, n: app.state.ai.tips.length })
      : app.t('ai_prefix_one');
    app.refs.aiStrip.textContent = `${prefix}${app.state.ai.tips[idx]}`;
  };

  app.refreshAITips = function refreshAITips(force = false) {
    if (!app.refs.aiStrip) return;
    const tips = app.buildAITips();
    const signature = tips.join('||');
    if (!force && signature === app.state.ai.signature) return;
    app.state.ai.signature = signature;
    app.state.ai.tips = tips;
    app.state.ai.idx = 0;
    app.renderAITip();
  };

  app.initAITips = function initAITips() {
    if (!app.refs.aiStrip) return;
    app.refreshAITips(true);
    if (app.state.ai.timer) clearInterval(app.state.ai.timer);
    app.state.ai.timer = setInterval(() => {
      if (!app.state.ai.tips || app.state.ai.tips.length <= 1) return;
      app.state.ai.idx = (app.state.ai.idx + 1) % app.state.ai.tips.length;
      app.renderAITip();
    }, 4200);
  };

  app.draw = function draw(opts = {}) {
    const ctx = app.ctx;
    const bg = opts.bg || 'court';
    const hideDefense = !!opts.hideDefense;
    const useView = opts.useView !== false;
    const W = app.canvas.clientWidth;
    const H = app.canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    if (bg === 'white') {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    ctx.save();
    if (useView) {
      ctx.translate(app.state.view.offsetX, app.state.view.offsetY);
      ctx.scale(app.state.view.scale, app.state.view.scale);
    }
    if (bg !== 'white') app.drawCourt();
    app.drawShapes();
    app.drawPlayers({ hideDefense });
    app.drawSpacingAlerts();
    ctx.restore();
    app.syncOffenseSelect();
    app.refreshAITips();
  };
}
