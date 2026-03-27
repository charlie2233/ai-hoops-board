import {
  buildBoardExportPayload,
  buildBoardRecord,
  deleteBoard,
  listBoards,
  parseBoardImportPayload,
  readAutosave,
  saveBoard,
  writeAutosave
} from '../features/playbook/store.js';

const AUTOSAVE_DEBOUNCE_MS = 1200;
const STYLE_ID = 'playbook-style';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeName(value) {
  const txt = String(value ?? '').trim().replace(/\s+/g, ' ');
  return txt || 'Untitled';
}

function formatStamp(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString();
  } catch (_) {
    return '';
  }
}

function boardCounts(scene) {
  const players = Array.isArray(scene?.players) ? scene.players : [];
  const offense = players.filter((p) => p && p.team === 'O').length;
  const defense = players.filter((p) => p && p.team === 'D' && !p.hidden).length;
  const shapes = Array.isArray(scene?.shapes) ? scene.shapes.length : 0;
  return { offense, defense, shapes };
}

function sceneLabel(app, scene) {
  return app.t(scene?.court === 'full' ? 'court_full' : 'court_half');
}

function captureThumbnail(app) {
  const src = app.canvas;
  if (!src || !src.width || !src.height) return '';
  const ratio = 0.22;
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(src.width * ratio));
  thumb.height = Math.max(1, Math.round(src.height * ratio));
  const ctx = thumb.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(src, 0, 0, thumb.width, thumb.height);
  try {
    return thumb.toDataURL('image/jpeg', 0.78);
  } catch (_) {
    return '';
  }
}

function fallbackThumb(record, app) {
  const label = escapeHtml(record?.name || app.t('playbook_untitled'));
  const court = escapeHtml(sceneLabel(app, record?.scene));
  const stats = boardCounts(record?.scene);
  const body = `${stats.offense} O · ${stats.defense} D · ${stats.shapes} ${app.t('playbook_shapes')}`;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 184" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#1d4ed8"/>
        </linearGradient>
      </defs>
      <rect width="320" height="184" rx="22" fill="url(#g)"/>
      <rect x="18" y="18" width="284" height="148" rx="16" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.22)"/>
      <text x="36" y="56" fill="#fff" font-family="system-ui" font-size="24" font-weight="700">${label}</text>
      <text x="36" y="88" fill="rgba(255,255,255,0.82)" font-family="system-ui" font-size="16">${court}</text>
      <text x="36" y="124" fill="rgba(255,255,255,0.78)" font-family="system-ui" font-size="15">${escapeHtml(body)}</text>
    </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function boardThumb(record, app) {
  return record?.thumbnail || fallbackThumb(record, app);
}

function injectStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-overlay="playbook"] {
      position: fixed;
      inset: 0;
      z-index: 2400;
      display: grid;
      place-items: center;
      padding: 16px;
      background: rgba(2, 6, 23, 0.62);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .playbook-shell {
      width: min(1180px, 100%);
      max-height: min(92vh, 1080px);
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 14px;
      padding: 16px;
      border-radius: 28px;
      border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
      background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 92%, transparent), color-mix(in srgb, var(--panel) 80%, transparent));
      box-shadow: 0 36px 90px rgba(0, 0, 0, 0.35);
      overflow: hidden;
    }

    .playbook-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .playbook-title {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.03em;
      color: var(--text);
      margin: 0;
    }

    .playbook-subtitle {
      margin: 6px 0 0;
      color: var(--muted);
      max-width: 70ch;
      font-size: 13px;
      line-height: 1.5;
    }

    .playbook-head-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .playbook-body {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      gap: 14px;
    }

    .playbook-column,
    .playbook-detail {
      min-height: 0;
      display: grid;
      gap: 12px;
      padding: 14px;
      border-radius: 22px;
      background: color-mix(in srgb, var(--panel) 82%, transparent);
      border: 1px solid color-mix(in srgb, var(--line) 74%, transparent);
      overflow: hidden;
    }

    .playbook-column {
      grid-template-rows: auto auto 1fr;
    }

    .playbook-create {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }

    .playbook-create input,
    .playbook-detail input,
    .playbook-detail textarea {
      width: 100%;
      border-radius: 14px;
      border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
      background: color-mix(in srgb, var(--bg) 88%, transparent);
      color: var(--text);
      padding: 12px 14px;
      font: inherit;
      outline: none;
    }

    .playbook-create input:focus,
    .playbook-detail input:focus,
    .playbook-detail textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
    }

    .playbook-status {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      font-size: 12px;
      color: var(--muted);
    }

    .playbook-status strong {
      color: var(--text);
    }

    .playbook-list {
      min-height: 0;
      overflow: auto;
      display: grid;
      gap: 10px;
      padding-right: 4px;
    }

    .playbook-card {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr);
      gap: 12px;
      align-items: stretch;
      padding: 10px;
      border-radius: 18px;
      border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
      background: color-mix(in srgb, var(--bg) 84%, transparent);
      cursor: pointer;
      transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
    }

    .playbook-card:hover {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);
    }

    .playbook-card.is-selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
    }

    .playbook-thumb {
      width: 100%;
      min-height: 82px;
      aspect-ratio: 16 / 9;
      border-radius: 14px;
      object-fit: cover;
      background: color-mix(in srgb, var(--line) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
    }

    .playbook-card-main {
      min-width: 0;
      display: grid;
      gap: 8px;
    }

    .playbook-card-title {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: flex-start;
    }

    .playbook-card-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .playbook-card-title span {
      flex: none;
      font-size: 11px;
      color: var(--muted);
    }

    .playbook-card-meta,
    .playbook-card-foot {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.4;
    }

    .playbook-card-foot {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }

    .playbook-card-actions,
    .playbook-detail-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .playbook-detail {
      align-content: start;
      grid-template-rows: auto auto auto 1fr;
    }

    .playbook-preview {
      display: grid;
      gap: 10px;
    }

    .playbook-preview img {
      width: 100%;
      aspect-ratio: 16 / 9;
      object-fit: cover;
      border-radius: 18px;
      border: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
      background: color-mix(in srgb, var(--line) 18%, transparent);
    }

    .playbook-detail h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 900;
      color: var(--text);
    }

    .playbook-detail p {
      margin: 0;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.55;
    }

    .playbook-empty {
      padding: 22px;
      border-radius: 18px;
      border: 1px dashed color-mix(in srgb, var(--line) 72%, transparent);
      color: var(--muted);
      background: color-mix(in srgb, var(--bg) 78%, transparent);
    }

    .playbook-hidden-input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 980px) {
      .playbook-shell {
        max-height: 94vh;
      }

      .playbook-body {
        grid-template-columns: 1fr;
      }
    }
  `;
  doc.head.appendChild(style);
}

function makeDetailText(app, record) {
  if (!record) return app.t('playbook_empty_detail');
  const counts = boardCounts(record.scene);
  const updated = formatStamp(record.updatedAt);
  const created = formatStamp(record.createdAt);
  return `${sceneLabel(app, record.scene)} · ${counts.offense} ${app.t('playbook_offense')} · ${counts.defense} ${app.t('playbook_defense')} · ${counts.shapes} ${app.t('playbook_shapes')} · ${app.t('playbook_created_at')}: ${created} · ${app.t('playbook_updated_at')}: ${updated}`;
}

function fileNameFor(record, app) {
  const base = normalizeName(record?.name || app.t('playbook_untitled'));
  return `${base.replace(/[\\/]+/g, '-')}.json`;
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function registerPlaybook(app) {
  const state = {
    boards: [],
    selectedId: '',
    overlayOpen: false,
    loading: false,
    status: '',
    autosave: readAutosave(),
    autosaveTimer: null,
    ready: false
  };

  app.playbook = state;

  function selectedBoard() {
    return state.boards.find((board) => board.id === state.selectedId) || null;
  }

  function setStatus(text) {
    state.status = text || '';
    if (state.overlayOpen) renderOverlay();
  }

  function scheduleAutosave() {
    if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
    if (app.state.replay?.playing) return;
    state.autosaveTimer = setTimeout(() => {
      state.autosaveTimer = null;
      if (app.state.replay?.playing) return;
      try {
        const scene = app.serializeScene();
        const current = selectedBoard();
        const name = current?.name || app.applied.name || app.t('playbook_autosave_name');
        writeAutosave({ boardId: current?.id || '', name, scene });
        state.autosave = readAutosave();
      } catch (_) {}
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  function refreshBoardList() {
    return listBoards().then((boards) => {
      state.boards = boards;
      const stillSelected = state.boards.some((board) => board.id === state.selectedId);
      if (!stillSelected) {
        const autosaveBoard = state.autosave?.boardId ? state.boards.find((board) => board.id === state.autosave.boardId) : null;
        state.selectedId = autosaveBoard?.id || state.boards[0]?.id || '';
      }
      if (state.overlayOpen) renderOverlay();
      return state.boards;
    }).catch((error) => {
      console.warn('Playbook storage unavailable', error);
      state.boards = [];
      state.selectedId = '';
      setStatus(app.t('playbook_storage_unavailable'));
      if (state.overlayOpen) renderOverlay();
      return state.boards;
    });
  }

  async function saveSceneAsBoard({ createNew = false, nameOverride = '' } = {}) {
    const current = selectedBoard();
    const input = app.refs.overlayRoot?.querySelector('[data-playbook-name]');
    const scene = app.serializeScene();
    const name = normalizeName(nameOverride || input?.value || current?.name || app.applied.name || app.t('playbook_untitled'));
    const record = buildBoardRecord({
      id: createNew ? undefined : current?.id,
      name,
      scene,
      thumbnail: captureThumbnail(app),
      createdAt: current?.createdAt,
      source: current ? 'manual' : 'create'
    });
    if (!record) return null;
    const saved = await saveBoard(record);
    state.selectedId = saved.id;
    app.applied.id = saved.id;
    app.applied.name = saved.name;
    app.applied.meta = { source: 'playbook', boardId: saved.id };
    state.autosave = readAutosave();
    await refreshBoardList();
    app.toast(app.t(createNew || !current ? 'playbook_created' : 'playbook_saved', { name: saved.name }));
    setStatus(app.t('playbook_status_saved', { name: saved.name }));
    return saved;
  }

  async function renameSelectedBoard() {
    const current = selectedBoard();
    if (!current) return;
    const input = app.refs.overlayRoot?.querySelector('[data-playbook-name]');
    const name = normalizeName(input?.value || current.name);
    const record = buildBoardRecord({
      id: current.id,
      name,
      scene: current.scene,
      thumbnail: current.thumbnail,
      createdAt: current.createdAt,
      source: current.source
    });
    if (!record) return;
    await saveBoard(record);
    app.applied.name = record.name;
    state.selectedId = record.id;
    await refreshBoardList();
    app.toast(app.t('playbook_renamed', { name: record.name }));
    setStatus(app.t('playbook_status_renamed', { name: record.name }));
  }

  async function duplicateSelectedBoard() {
    const current = selectedBoard();
    if (!current) return;
    const base = normalizeName(current.name || app.t('playbook_untitled'));
    const name = `${base} Copy`;
    const record = buildBoardRecord({
      name,
      scene: current.scene,
      thumbnail: current.thumbnail || captureThumbnail(app),
      source: 'duplicate'
    });
    if (!record) return;
    const saved = await saveBoard(record);
    state.selectedId = saved.id;
    await refreshBoardList();
    app.toast(app.t('playbook_duplicated', { name: saved.name }));
    setStatus(app.t('playbook_status_duplicated', { name: saved.name }));
  }

  async function deleteSelectedBoard() {
    const current = selectedBoard();
    if (!current) return;
    const ok = window.confirm(app.t('playbook_confirm_delete', { name: current.name }));
    if (!ok) return;
    await deleteBoard(current.id);
    const next = state.boards.find((board) => board.id !== current.id) || null;
    state.selectedId = next?.id || '';
    await refreshBoardList();
    app.toast(app.t('playbook_deleted', { name: current.name }));
    setStatus(app.t('playbook_status_deleted'));
  }

  async function loadSelectedBoard() {
    const current = selectedBoard();
    if (!current) return;
    app.pushUndo();
    app.restoreScene(current.scene);
    app.applied.id = current.id;
    app.applied.name = current.name;
    app.applied.meta = { source: 'playbook', boardId: current.id };
    scheduleAutosave();
    app.toast(app.t('playbook_loaded', { name: current.name }));
    setStatus(app.t('playbook_status_loaded', { name: current.name }));
    if (state.overlayOpen) renderOverlay();
  }

  async function exportSelectedBoard() {
    const current = selectedBoard();
    if (!current) return;
    const payload = buildBoardExportPayload(current);
    if (!payload) return;
    downloadJson(fileNameFor(current, app), payload);
    app.toast(app.t('playbook_exported', { name: current.name }));
  }

  async function importBoardsFromFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    let imported = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = parseBoardImportPayload(JSON.parse(text));
        for (const board of parsed) {
          const saved = await saveBoard(buildBoardRecord({
            name: board.name,
            scene: board.scene,
            thumbnail: board.thumbnail,
            source: 'import'
          }));
          if (saved) {
            state.selectedId = saved.id;
            imported += 1;
          }
        }
      } catch (_) {
        app.toast(app.t('playbook_import_failed', { file: file.name }));
      }
    }
    await refreshBoardList();
    state.autosave = readAutosave();
    if (imported) {
      app.toast(app.t('playbook_imported', { count: imported }));
      setStatus(app.t('playbook_status_imported', { count: imported }));
    }
  }

  function restoreLatestSession() {
    const autosave = readAutosave();
    if (!autosave) return false;
    state.autosave = autosave;
    try {
      app.restoreScene(autosave.scene, { redraw: false });
      app.applied.id = autosave.boardId || autosave.scene.appliedPlayId || null;
      app.applied.name = autosave.name || app.applied.name || app.t('playbook_autosave_name');
      app.applied.meta = { source: 'autosave' };
      state.selectedId = autosave.boardId || state.selectedId || '';
      if (app.draw) app.draw();
      setStatus(app.t('playbook_autosave_restored', { name: autosave.name }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function renderOverlay() {
    const root = app.refs.overlayRoot;
    if (!root) return;
    injectStyles(document);
    state.overlayOpen = true;
    const current = selectedBoard();
    const title = app.t('playbook_title');
    const subtitle = app.t('playbook_subtitle');
    const currentName = current?.name || state.autosave?.name || '';
    const boardsHtml = state.loading
      ? `<div class="playbook-empty">${escapeHtml(app.t('playbook_loading'))}</div>`
      : state.boards.length
        ? state.boards.map((board) => {
          const counts = boardCounts(board.scene);
          const selected = board.id === state.selectedId;
          return `
            <button type="button" class="playbook-card ${selected ? 'is-selected' : ''}" data-playbook-board="${escapeHtml(board.id)}" aria-selected="${selected ? 'true' : 'false'}">
              <img class="playbook-thumb" src="${boardThumb(board, app)}" alt="${escapeHtml(board.name)}" />
              <div class="playbook-card-main">
                <div class="playbook-card-title">
                  <h3>${escapeHtml(board.name)}</h3>
                  <span>${escapeHtml(formatStamp(board.updatedAt))}</span>
                </div>
                <div class="playbook-card-meta">${escapeHtml(sceneLabel(app, board.scene))} · ${counts.offense} ${escapeHtml(app.t('playbook_offense'))} · ${counts.defense} ${escapeHtml(app.t('playbook_defense'))} · ${counts.shapes} ${escapeHtml(app.t('playbook_shapes'))}</div>
                <div class="playbook-card-foot">
                  <span>${escapeHtml(app.t('playbook_created_at'))}: ${escapeHtml(formatStamp(board.createdAt))}</span>
                  <span>${escapeHtml(board.scene.appliedPlayId || app.t('playbook_scene_custom'))}</span>
                </div>
              </div>
            </button>`;
        }).join('')
        : `<div class="playbook-empty">${escapeHtml(app.t('playbook_empty'))}</div>`;

    const previewThumb = current ? boardThumb(current, app) : fallbackThumb({ name: currentName, scene: app.serializeScene() }, app);
    const detailText = current ? makeDetailText(app, current) : app.t('playbook_empty_detail');
    const detailName = currentName || app.t('playbook_untitled');

    root.innerHTML = `
      <div class="playbook-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="playbook-head">
          <div>
            <h2 class="playbook-title">${escapeHtml(title)}</h2>
            <p class="playbook-subtitle">${escapeHtml(subtitle)}</p>
          </div>
          <div class="playbook-head-actions">
            <button class="btn" type="button" data-playbook-act="close">${escapeHtml(app.t('playbook_close'))}</button>
          </div>
        </div>
        <div class="playbook-body">
          <section class="playbook-column">
            <div class="playbook-create">
              <input class="playbook-name-input" data-playbook-name value="${escapeHtml(currentName)}" placeholder="${escapeHtml(app.t('playbook_name_placeholder'))}" />
              <button class="btn primary" type="button" data-playbook-act="save-new">${escapeHtml(app.t('playbook_new'))}</button>
            </div>
            <div class="playbook-status"><span>${escapeHtml(app.t('playbook_status_label'))}</span><strong>${escapeHtml(state.status || app.t('playbook_status_idle'))}</strong></div>
            <div class="playbook-card-actions">
              <button class="btn" type="button" data-playbook-act="save">${escapeHtml(app.t('playbook_save'))}</button>
              <button class="btn" type="button" data-playbook-act="load">${escapeHtml(app.t('playbook_load'))}</button>
              <button class="btn" type="button" data-playbook-act="rename">${escapeHtml(app.t('playbook_rename'))}</button>
              <button class="btn" type="button" data-playbook-act="duplicate">${escapeHtml(app.t('playbook_duplicate'))}</button>
              <button class="btn" type="button" data-playbook-act="export">${escapeHtml(app.t('playbook_export'))}</button>
              <button class="btn danger" type="button" data-playbook-act="delete">${escapeHtml(app.t('playbook_delete'))}</button>
              <button class="btn" type="button" data-playbook-act="import">${escapeHtml(app.t('playbook_import'))}</button>
            </div>
            <div class="playbook-list">
              ${boardsHtml}
            </div>
          </section>
          <aside class="playbook-detail">
            <div class="playbook-preview">
              <img src="${escapeHtml(previewThumb)}" alt="${escapeHtml(detailName)}" />
              <div>
                <h3>${escapeHtml(detailName)}</h3>
                <p>${escapeHtml(detailText)}</p>
              </div>
            </div>
            <div class="playbook-detail-actions">
              <button class="btn primary" type="button" data-playbook-act="load">${escapeHtml(app.t('playbook_load_current'))}</button>
              <button class="btn" type="button" data-playbook-act="save">${escapeHtml(app.t('playbook_save_current'))}</button>
              <button class="btn" type="button" data-playbook-act="duplicate">${escapeHtml(app.t('playbook_duplicate'))}</button>
              <button class="btn" type="button" data-playbook-act="export">${escapeHtml(app.t('playbook_export'))}</button>
            </div>
            <p>${escapeHtml(app.t('playbook_help'))}</p>
          </aside>
        </div>
        <input class="playbook-hidden-input" type="file" accept="application/json" data-playbook-file hidden />
      </div>`;

    const nameInput = root.querySelector('[data-playbook-name]');
    if (nameInput) nameInput.value = current?.name || state.autosave?.name || '';
  }

  function openOverlay() {
    state.overlayOpen = true;
    if (app.openOverlay) app.openOverlay('playbook');
    return refreshBoardList().then(() => {
      if (!state.overlayOpen) return;
      renderOverlay();
      const root = app.refs.overlayRoot;
      const input = root?.querySelector('[data-playbook-name]');
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  function closeOverlay() {
    state.overlayOpen = false;
    if (app.closeOverlay) app.closeOverlay();
  }

  async function handleAction(action, root) {
    try {
      switch (action) {
        case 'close':
          closeOverlay();
          break;
        case 'save-new':
          await saveSceneAsBoard({ createNew: true });
          break;
        case 'save':
          await saveSceneAsBoard({ createNew: false });
          break;
        case 'rename':
          await renameSelectedBoard();
          break;
        case 'duplicate':
          await duplicateSelectedBoard();
          break;
        case 'delete':
          await deleteSelectedBoard();
          break;
        case 'load':
          await loadSelectedBoard();
          break;
        case 'export':
          await exportSelectedBoard();
          break;
        case 'import':
          root.querySelector('[data-playbook-file]')?.click();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error(error);
      app.toast(app.t('playbook_storage_unavailable'));
      setStatus(app.t('playbook_storage_unavailable'));
    }
  }

  const baseDraw = app.draw;
  app.draw = function drawWithPlaybookAutosave(opts = {}) {
    const result = baseDraw(opts);
    if (state.ready && !app.state.replay?.playing) scheduleAutosave();
    return result;
  };

  app.restoreLatestPlaybookSession = function restoreLatestPlaybookSession() {
    return restoreLatestSession();
  };

  app.openPlaybookOverlay = function openPlaybookOverlay() {
    return openOverlay();
  };

  app.closePlaybookOverlay = function closePlaybookOverlay() {
    closeOverlay();
  };

  app.refreshPlaybookOverlay = function refreshPlaybookOverlay() {
    if (state.overlayOpen) renderOverlay();
  };

  app.ensurePlaybookCatalog = function ensurePlaybookCatalog() {
    return refreshBoardList();
  };

  if (app.refs.playbookBtn) {
    app.refs.playbookBtn.onclick = () => { void openOverlay(); };
  }

  if (app.refs.overlayRoot) {
    app.refs.overlayRoot.addEventListener('click', (e) => {
      const root = app.refs.overlayRoot;
      const act = e.target.closest('[data-playbook-act]')?.dataset.playbookAct;
      const item = e.target.closest('[data-playbook-board]')?.dataset.playbookBoard;
      const fileInput = root.querySelector('[data-playbook-file]');
      if (item) {
        state.selectedId = item;
        renderOverlay();
        return;
      }
      if (!act) return;
      void handleAction(act, root);
      if (act === 'import' && fileInput) {
        fileInput.value = '';
      }
    });

    app.refs.overlayRoot.addEventListener('change', (e) => {
      const input = e.target.closest('[data-playbook-file]');
      if (!input || !input.files?.length) return;
      void importBoardsFromFiles(input.files).then(() => {
        input.value = '';
        renderOverlay();
      });
    });

    app.refs.overlayRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeOverlay();
      }
    });
  }

  const baseApplyLanguage = app.applyLanguage;
  app.applyLanguage = function applyLanguageWithPlaybook(lang, opts = {}) {
    const next = baseApplyLanguage(lang, opts);
    if (state.overlayOpen) renderOverlay();
    return next;
  };

  window.addEventListener('beforeunload', () => {
    if (state.autosaveTimer) clearTimeout(state.autosaveTimer);
    if (!app.state.replay?.playing) {
      try {
        writeAutosave({
          boardId: state.selectedId || '',
          name: selectedBoard()?.name || app.applied.name || app.t('playbook_autosave_name'),
          scene: app.serializeScene()
        });
      } catch (_) {}
    }
  });

  state.ready = true;
  app.playbook.restoreLatestSession = restoreLatestSession;
  app.playbook.renderOverlay = renderOverlay;
  app.playbook.scheduleAutosave = scheduleAutosave;
}
