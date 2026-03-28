import { getPreset } from '../../plays/presets.js';
import { loadCatalog } from './cache.js';
import {
  PLAY_FAVORITES_KEY,
  PLAY_RECENTS_KEY,
  PLAY_RECENTS_LIMIT
} from '../core/keys.js';

export function attachPlaysApi(app) {
  app.playsCatalog = [];
  app.playsCatalogLoaded = false;

  app.readStoredIds = function readStoredIds(key, limit = 50) {
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
  };

  app.writeStoredIds = function writeStoredIds(key, ids, limit = 50) {
    const seen = new Set();
    const out = [];
    (ids || []).forEach((v) => {
      const id = String(v || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(id);
    });
    try {
      localStorage.setItem(key, JSON.stringify(out.slice(0, limit)));
    } catch (_) {}
  };

  app.markPlayRecent = function markPlayRecent(id) {
    const pid = String(id || '').trim();
    if (!pid) return;
    const old = app.readStoredIds(PLAY_RECENTS_KEY, PLAY_RECENTS_LIMIT);
    const next = [pid, ...old.filter((x) => x !== pid)];
    app.writeStoredIds(PLAY_RECENTS_KEY, next, PLAY_RECENTS_LIMIT);
  };

  app.getPlayByIdFromCatalog = function getPlayByIdFromCatalog(id) {
    const key = String(id || '').trim().toLowerCase();
    if (!key) return null;
    return app.playsCatalog.find((p) => String(p?.id || '').trim().toLowerCase() === key) || null;
  };

  app.playLabel = function playLabel(play, fallbackId) {
    if (!play) return String(fallbackId || '');
    const title = String(play.name || play.id || fallbackId || '').trim();
    const type = String(play.type || '').trim();
    return type ? `${title} · ${type}` : title;
  };

  app.refreshQuickPlayOptions = function refreshQuickPlayOptions() {
    if (!app.refs.quickPlaySelect) return;
    const keep = app.refs.quickPlaySelect.value;
    app.refs.quickPlaySelect.innerHTML = '';
    const first = document.createElement('option');
    first.value = '';
    first.textContent = app.t('quick_play_pick');
    app.refs.quickPlaySelect.appendChild(first);

    const favorites = app.readStoredIds(PLAY_FAVORITES_KEY, 200)
      .map((id) => ({ id, play: app.getPlayByIdFromCatalog(id) }))
      .filter((x) => x.play);
    const recents = app.readStoredIds(PLAY_RECENTS_KEY, PLAY_RECENTS_LIMIT)
      .map((id) => ({ id, play: app.getPlayByIdFromCatalog(id) }))
      .filter((x) => x.play);
    const all = app.playsCatalog
      .filter((p) => p && p.id)
      .slice()
      .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), app.state.uiLang === 'en' ? 'en' : 'zh-Hans-CN'));

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
        op.textContent = `${prefix}${app.playLabel(play, id)}`;
        group.appendChild(op);
      });
      app.refs.quickPlaySelect.appendChild(group);
    };

    appendGroup(app.t('group_favorites'), favorites, '★ ');
    appendGroup(app.t('group_recent'), recents, '• ');
    appendGroup(app.t('group_all'), all);

    if (keep && Array.from(app.refs.quickPlaySelect.options).some((op) => op.value === keep)) {
      app.refs.quickPlaySelect.value = keep;
    }
  };

  app.ensurePlaysCatalog = async function ensurePlaysCatalog(force = false) {
    const result = await loadCatalog('plays', './plays/plays.json', { force });
    app.playsCatalog = Array.isArray(result.items) ? result.items : [];
    app.playsCatalogLoaded = !!result.status?.loaded;
    app.playsCatalogStatus = result.status;
    app.refreshQuickPlayOptions();
    return app.playsCatalog;
  };

  app.resolvePlayGeometry = function resolvePlayGeometry(play, rawId) {
    if (play && play.geometry) return { geom: play.geometry, sourceKey: 'geom_json' };
    if (play && (play.offense || play.shapes || play.defense)) return { geom: play, sourceKey: 'geom_simple' };
    if (play) {
      const pid = play.preset || play.presetId || play.alias || play.id;
      if (pid) {
        const byPreset = getPreset(pid);
        if (byPreset) return { geom: byPreset, sourceKey: 'geom_preset_alias' };
      }
    }
    const byId = getPreset(rawId);
    if (byId) return { geom: byId, sourceKey: 'geom_preset' };
    return { geom: getPreset('fiveOut'), sourceKey: 'geom_fallback' };
  };

  app.syncAppliedMeta = function syncAppliedMeta(play, rawId) {
    app.applied.id = rawId;
    app.applied.name = (play && (play.name || play.id)) || rawId;
    app.applied.meta = play ? {
      cues: Array.isArray(play.cues) ? play.cues : [],
      errors: Array.isArray(play.errors) ? play.errors : [],
      drills: Array.isArray(play.drills) ? play.drills : [],
      type: play.type || '',
      vs: Array.isArray(play.vs) ? play.vs : []
    } : null;
  };

  app.applyPlay = function applyPlay(play) {
    if (!play) return;
    app.pushUndo();
    if (play.court === 'half' || play.court === 'full') {
      app.state.court = play.court;
      app.updateCanvasAspect();
      app.resizeForDPI();
    }
    if (Array.isArray(play.offense)) {
      for (let i = 0; i < Math.min(5, play.offense.length); i += 1) {
        const p = app.state.players[i];
        const n = play.offense[i];
        if (p && n) {
          const px = app.normToPx(n);
          p.x = px.x;
          p.y = px.y;
        }
      }
    }
    if (Array.isArray(play.defense)) {
      for (let i = 0; i < Math.min(5, play.defense.length); i += 1) {
        const p = app.state.players[5 + i];
        const n = play.defense[i];
        if (p && n) {
          const px = app.normToPx(n);
          p.x = px.x;
          p.y = px.y;
        }
      }
    }
    if (Array.isArray(play.shapes)) {
      app.state.shapes = play.shapes.map((s) => ({
        type: s.type === 'pass' ? 'pass' : 'run',
        pts: (s.pts || []).map(app.normToPx)
      }));
    }
    if (play.ballHandler) {
      app.setBallHandlerById(String(play.ballHandler), { silent: true, redraw: false });
    }
    app.draw();
  };

  app.applyPlayById = async function applyPlayById(rawId, opts = {}) {
    const id = String(rawId || '').trim();
    if (!id) return false;
    await app.ensurePlaysCatalog();
    let play = app.getPlayByIdFromCatalog(id);
    if (!play && !app.playsCatalog.length) {
      await app.ensurePlaysCatalog(true);
      play = app.getPlayByIdFromCatalog(id);
    }
    app.syncAppliedMeta(play, id);
    const resolved = app.resolvePlayGeometry(play, id);
    if (!resolved.geom) {
      app.toast(app.t('toast_no_geom'));
      return false;
    }
    app.applyPlay(resolved.geom);
    const recentId = String((play && play.id) || id);
    app.markPlayRecent(recentId);
    app.refreshQuickPlayOptions();
    if (opts.toast !== false) {
      const src = opts.sourceKey ? `${app.t(opts.sourceKey)} · ` : '';
      app.toast(app.t('toast_applied', { name: app.applied.name, src, kind: app.t(resolved.sourceKey) }));
    }
    return true;
  };

  app.applyRandomPlay = async function applyRandomPlay() {
    await app.ensurePlaysCatalog();
    const favoritePool = app.readStoredIds(PLAY_FAVORITES_KEY, 200)
      .filter((id) => !!app.getPlayByIdFromCatalog(id));
    const fullPool = app.playsCatalog.map((p) => String(p?.id || '').trim()).filter(Boolean);
    const pool = favoritePool.length ? favoritePool : fullPool;
    if (!pool.length) {
      app.toast(app.t('toast_no_plays'));
      return;
    }
    const id = pool[Math.floor(Math.random() * pool.length)];
    await app.applyPlayById(id, { sourceKey: favoritePool.length ? 'source_random_fav' : 'source_random' });
  };

  app.readAppliedPlay = async function readAppliedPlay() {
    const urlId = new URLSearchParams(location.search).get('apply');
    const lsId = localStorage.getItem('applyPlayId');
    const idRaw = (urlId || lsId || '').trim();
    if (!idRaw) return;
    try {
      await app.applyPlayById(idRaw, { sourceKey: 'source_link' });
    } catch (_) {
      const fallback = getPreset(idRaw) || getPreset('fiveOut');
      if (fallback) {
        app.applied.id = idRaw;
        app.applied.name = idRaw;
        app.applied.meta = null;
        app.applyPlay(fallback);
        app.markPlayRecent(idRaw);
        app.refreshQuickPlayOptions();
        app.toast(app.t('toast_applied_offline', { id: idRaw }));
      } else {
        app.toast(app.t('toast_no_geom'));
      }
    } finally {
      localStorage.removeItem('applyPlayId');
    }
  };
}
