import { PATHING_AVOIDANCE_KEY } from '../core/keys.js';

export function attachReplayApi(app) {
  app.state.replay = {
    playing: false,
    paused: false,
    speed: 1,
    startStamp: 0,
    lastStamp: 0,
    timeMs: 0,
    durationMs: 0,
    runs: [],
    passes: [],
    snapshot: null,
    flightBall: null
  };

  const MOVE_SPEED = 220;
  const PASS_SPEED = 620;
  const BASE_DELAY = 900;

  app.state.pathingAvoidance = (() => {
    try {
      return JSON.parse(localStorage.getItem(PATHING_AVOIDANCE_KEY) || 'true');
    } catch (_) {
      return true;
    }
  })();

  app.setPathingAvoidance = function setPathingAvoidance(on) {
    app.state.pathingAvoidance = !!on;
    try {
      localStorage.setItem(PATHING_AVOIDANCE_KEY, JSON.stringify(app.state.pathingAvoidance));
    } catch (_) {}
  };

  app.catmullRom = function catmullRom(a, b, c, d, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
      x: 0.5 * ((2 * b.x) + (-a.x + c.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (-a.x + 3 * b.x - 3 * c.x + d.x) * t3),
      y: 0.5 * ((2 * b.y) + (-a.y + c.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (-a.y + 3 * b.y - 3 * c.y + d.y) * t3)
    };
  };

  app.sampleSpline = function sampleSpline(pts, n = 64) {
    if (!pts || pts.length < 3) return pts?.slice() || [];
    const result = [];
    const L = pts.length;
    for (let i = 0; i < L - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(L - 1, i + 2)];
      for (let k = 0; k < (i < L - 2 ? n : 1); k += 1) {
        const t = k / n;
        result.push(app.catmullRom(p0, p1, p2, p3, t));
      }
    }
    result.push(pts[L - 1]);
    return result;
  };

  app.polyLength = function polyLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i += 1) {
      L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return L;
  };

  app.polyLerp = function polyLerp(pts, u) {
    if (!pts || !pts.length) return { x: 0, y: 0 };
    if (pts.length === 1) return pts[0];
    const tot = app.polyLength(pts);
    if (!tot) return pts[0];
    let d = u * tot;
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1];
      const b = pts[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (d <= seg) {
        const t = seg ? d / seg : 0;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      d -= seg;
    }
    return pts.at(-1);
  };

  app.adjustPathForTeammates = function adjustPathForTeammates(pts, player, teammates, minGapPx) {
    if (!app.state.pathingAvoidance) return pts;
    if (!pts || pts.length < 2) return pts;
    const out = pts.map((p) => ({ x: p.x, y: p.y }));
    const R = app.playerRadiusPx();
    const thr = Math.max(minGapPx || app.spacingThresholdPx() * 0.65, R * 1.2);
    for (let iter = 0; iter < 2; iter += 1) {
      for (let i = 0; i < out.length; i += 1) {
        const p = out[i];
        for (const tm of teammates) {
          if (tm.id === player.id) continue;
          const d = Math.hypot(p.x - tm.x, p.y - tm.y);
          if (d < thr) {
            const nx = (p.x - tm.x) / (d || 1);
            const ny = (p.y - tm.y) / (d || 1);
            const push = (thr - d) * 0.55;
            p.x += nx * push;
            p.y += ny * push;
          }
        }
      }
    }
    return out;
  };

  app.compileTimeline = function compileTimeline() {
    const runs = [];
    const passes = [];
    const offense = app.state.players.filter((p) => p.team === 'O');
    const nearest = (pt) => offense.reduce((memo, player) => {
      const d = Math.hypot(pt.x - player.x, pt.y - player.y);
      return (!memo || d < memo.d) ? { p: player, d } : memo;
    }, null)?.p;

    app.state.shapes.filter((s) => s.type === 'run' && s.pts?.length >= 2).forEach((shape) => {
      const player = nearest(shape.pts[0]);
      if (!player) return;
      const smooth = app.sampleSpline(shape.pts, 64);
      const adjusted = app.adjustPathForTeammates(smooth, player, offense);
      const dur = Math.max(0.2, app.polyLength(adjusted) / MOVE_SPEED);
      runs.push({ player, pts: adjusted, t0: 0, t1: dur * 1000 });
    });

    let idx = 0;
    app.state.shapes.filter((s) => s.type === 'pass' && s.pts?.length >= 2).forEach((shape) => {
      const a = shape.pts[0];
      const b = shape.pts.at(-1);
      const from = nearest(a);
      const to = nearest(b);
      if (!from || !to) return;
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const dur = Math.max(0.2, dist / PASS_SPEED);
      const t0 = BASE_DELAY + idx * 300;
      const arc = Math.max(28, Math.min(84, dist * 0.18));
      passes.push({ from, to, p0: a, p1: b, t0, dur: dur * 1000, arc });
      idx += 1;
    });

    const durationMs = Math.max(
      runs.reduce((memo, run) => Math.max(memo, run.t1), 0),
      passes.reduce((memo, pass) => Math.max(memo, pass.t0 + pass.dur), 0)
    ) || 0;

    return { runs, passes, durationMs };
  };

  app.startReplay = function startReplay() {
    app.state.replay.snapshot = {
      players: JSON.parse(JSON.stringify(app.state.players)),
      ballOwnerId: app.state.players.find((p) => p.team === 'O' && p.ball)?.id || null
    };
    app.canvas.style.pointerEvents = 'none';
    const tl = app.compileTimeline();
    app.state.replay.runs = tl.runs;
    app.state.replay.passes = tl.passes;
    app.state.replay.durationMs = Math.max(100, tl.durationMs);
    app.state.replay.timeMs = 0;
    app.state.replay.playing = true;
    app.state.replay.paused = false;
    const sel = app.refs.$('speed');
    app.state.replay.speed = parseFloat((sel && sel.value) ? sel.value : '0.5');
    app.state.replay.startStamp = performance.now();
    app.state.replay.lastStamp = app.state.replay.startStamp;
    app.updateReplayButtonLabel();
    requestAnimationFrame(app.tickReplay);
  };

  app.stopReplay = function stopReplay(restore = true) {
    app.state.replay.playing = false;
    app.state.replay.paused = false;
    app.canvas.style.pointerEvents = 'auto';
    if (restore && app.state.replay.snapshot) {
      app.state.players = JSON.parse(JSON.stringify(app.state.replay.snapshot.players));
      app.state.players.forEach((p) => {
        p.ball = p.team === 'O' && p.id === app.state.replay.snapshot.ballOwnerId;
      });
    }
    app.state.replay.flightBall = null;
    app.draw();
    app.updateReplayButtonLabel();
    const seek = app.refs.$('seek');
    if (seek) seek.value = 0;
    app.state.replay.timeMs = 0;
  };

  app.pauseReplay = function pauseReplay() {
    app.state.replay.paused = true;
  };

  app.resumeReplay = function resumeReplay() {
    app.state.replay.paused = false;
    app.state.replay.lastStamp = performance.now();
  };

  app.setSpeed = function setSpeed(k) {
    app.state.replay.speed = Math.max(0.25, Math.min(3, k || 1));
  };

  app.setReplayTime = function setReplayTime(ms) {
    const t = Math.max(0, Math.min(app.state.replay.durationMs, ms | 0));
    app.state.replay.timeMs = t;
    app.state.replay.runs.forEach((run) => {
      const u = (t < run.t0) ? 0 : (t > run.t1 ? 1 : (t - run.t0) / (run.t1 - run.t0));
      const pos = app.polyLerp(run.pts, Math.max(0, Math.min(1, u)));
      run.player.x = pos.x;
      run.player.y = pos.y;
    });
    app.state.players.forEach((p) => {
      if (p.team === 'O') p.ball = false;
    });
    app.state.replay.flightBall = null;
    let inFlight = null;
    let lastDone = null;
    app.state.replay.passes.forEach((pass) => {
      if (t >= pass.t0 + pass.dur) lastDone = pass;
      else if (t >= pass.t0 && t < pass.t0 + pass.dur) inFlight = pass;
    });
    if (inFlight) {
      const u = (t - inFlight.t0) / inFlight.dur;
      const base = app.polyLerp([inFlight.p0, inFlight.p1], Math.max(0, Math.min(1, u)));
      const arcY = -4 * inFlight.arc * u * (1 - u);
      app.state.replay.flightBall = { x: base.x, y: base.y + arcY };
    } else {
      const targetId = lastDone ? lastDone.to.id : app.state.replay.snapshot.ballOwnerId;
      const holder = app.state.players.find((p) => p.team === 'O' && p.id === targetId);
      if (holder) holder.ball = true;
    }
    app.draw();
    const seek = app.refs.$('seek');
    if (seek) seek.value = (t / app.state.replay.durationMs) * 100;
  };

  app.tickReplay = function tickReplay(now) {
    if (!app.state.replay.playing) return;
    if (!app.state.replay.paused) {
      const dt = Math.min(50, now - app.state.replay.lastStamp);
      const next = app.state.replay.timeMs + dt * app.state.replay.speed;
      app.setReplayTime(next);
      app.state.replay.lastStamp = now;
      if (next >= app.state.replay.durationMs) {
        app.stopReplay(true);
        return;
      }
    }
    requestAnimationFrame(app.tickReplay);
  };

  const baseDraw = app.draw;
  app.draw = function drawWithReplay(opts = {}) {
    baseDraw(opts);
    if (app.state.replay && app.state.replay.flightBall) {
      const b = app.state.replay.flightBall;
      app.ctx.save();
      app.ctx.fillStyle = '#FF7A1A';
      app.ctx.beginPath();
      app.ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      app.ctx.fill();
      app.ctx.restore();
    }
  };

  app.bindReplayControls = function bindReplayControls() {
    const bp = app.refs.$('btn-playpause');
    const bs = app.refs.$('btn-stop');
    const seek = app.refs.$('seek');
    const speed = app.refs.$('speed');
    if (bp) {
      bp.onclick = () => {
        if (!app.state.replay.playing) {
          app.startReplay();
          app.updateReplayButtonLabel();
          return;
        }
        if (app.state.replay.paused) app.resumeReplay();
        else app.pauseReplay();
        app.updateReplayButtonLabel();
      };
    }
    if (bs) bs.onclick = () => app.stopReplay();
    if (seek) {
      seek.oninput = (e) => {
        if (!app.state.replay.playing) {
          const tl = app.compileTimeline();
          app.state.replay.runs = tl.runs;
          app.state.replay.passes = tl.passes;
          app.state.replay.durationMs = Math.max(100, tl.durationMs);
        }
        app.setReplayTime((parseFloat(e.target.value || '0') / 100) * app.state.replay.durationMs);
      };
    }
    if (speed) speed.onchange = (e) => app.setSpeed(parseFloat(e.target.value || '1'));
    const showAdvBtn = app.refs.$('show-advanced');
    if (showAdvBtn && app.refs.advancedToolbar) {
      showAdvBtn.onclick = () => {
        const isVisible = app.refs.advancedToolbar.classList.toggle('show');
        showAdvBtn.textContent = isVisible ? app.t('show_less') : app.t('show_more');
      };
    }
  };
}
