const DB_NAME = 'ai-hoops-board-playbook';
const DB_VERSION = 1;
const STORE_NAME = 'boards';

export const PLAYBOOK_AUTOSAVE_KEY = 'playbookLatestSessionV1';

function now() {
  return Date.now();
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return `pb_${globalThis.crypto.randomUUID()}`;
  return `pb_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeName(name) {
  const txt = String(name || '').trim().replace(/\s+/g, ' ');
  return txt || 'Untitled';
}

function normalizeScene(scene) {
  if (!scene || typeof scene !== 'object') return null;
  const next = clone(scene);
  next.schema = Number.isFinite(next.schema) ? next.schema : 1;
  next.court = next.court === 'full' ? 'full' : 'half';
  next.players = Array.isArray(next.players) ? next.players : [];
  next.shapes = Array.isArray(next.shapes) ? next.shapes : [];
  next.ballHandlerId = String(next.ballHandlerId || '');
  next.defendersRemoved = !!next.defendersRemoved;
  next.appliedPlayId = next.appliedPlayId ? String(next.appliedPlayId) : null;
  return next;
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const scene = normalizeScene(record.scene);
  if (!scene) return null;
  const createdAt = Number.isFinite(record.createdAt) ? record.createdAt : now();
  const updatedAt = Number.isFinite(record.updatedAt) ? record.updatedAt : createdAt;
  return {
    id: String(record.id || randomId()),
    name: normalizeName(record.name),
    createdAt,
    updatedAt,
    scene,
    thumbnail: typeof record.thumbnail === 'string' ? record.thumbnail : '',
    source: record.source ? String(record.source) : 'manual'
  };
}

function openRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function waitForTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

async function openDatabase() {
  if (!globalThis.indexedDB) throw new Error('IndexedDB is not available');
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt', { unique: false });
      store.createIndex('createdAt', 'createdAt', { unique: false });
    }
  };
  return openRequest(request);
}

async function readAllBoards() {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    const items = await openRequest(request);
    await waitForTransaction(tx);
    return Array.isArray(items) ? items.map(normalizeRecord).filter(Boolean) : [];
  } finally {
    db.close();
  }
}

async function readBoard(id) {
  const boardId = String(id || '').trim();
  if (!boardId) return null;
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(boardId);
    const item = await openRequest(request);
    await waitForTransaction(tx);
    return normalizeRecord(item);
  } finally {
    db.close();
  }
}

async function writeBoard(record) {
  const next = normalizeRecord(record);
  if (!next) throw new Error('Cannot save empty board record');
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(next);
    await waitForTransaction(tx);
    return clone(next);
  } finally {
    db.close();
  }
}

async function removeBoard(id) {
  const boardId = String(id || '').trim();
  if (!boardId) return false;
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(boardId);
    await waitForTransaction(tx);
    return true;
  } finally {
    db.close();
  }
}

export async function listBoards() {
  const items = await readAllBoards();
  items.sort((a, b) => (b.updatedAt - a.updatedAt) || (b.createdAt - a.createdAt));
  return items;
}

export async function getBoard(id) {
  return readBoard(id);
}

export async function saveBoard(record) {
  return writeBoard(record);
}

export async function deleteBoard(id) {
  return removeBoard(id);
}

export function buildBoardRecord({ name, scene, thumbnail = '', id = randomId(), createdAt, updatedAt, source = 'manual' }) {
  const normalizedScene = normalizeScene(scene);
  if (!normalizedScene) return null;
  const created = Number.isFinite(createdAt) ? createdAt : now();
  const updated = Number.isFinite(updatedAt) ? updatedAt : now();
  return normalizeRecord({
    id,
    name,
    scene: normalizedScene,
    thumbnail,
    createdAt: created,
    updatedAt: updated,
    source
  });
}

export function buildBoardExportPayload(record) {
  const next = normalizeRecord(record);
  if (!next) return null;
  return {
    kind: 'ai-hoops-playbook',
    version: 1,
    exportedAt: now(),
    board: next
  };
}

export function parseBoardImportPayload(raw) {
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => parseBoardImportPayload(item));
  }
  if (!raw || typeof raw !== 'object') return [];
  if (raw.court || raw.players || raw.shapes) {
    const scene = normalizeScene(raw);
    return scene ? [normalizeRecord({
      id: randomId(),
      name: normalizeName(raw.name || raw.title || 'Imported Board'),
      scene,
      thumbnail: typeof raw.thumbnail === 'string' ? raw.thumbnail : '',
      source: 'import'
    })].filter(Boolean) : [];
  }
  const candidate = raw.board && typeof raw.board === 'object'
    ? raw.board
    : raw.playbook && typeof raw.playbook === 'object'
      ? raw.playbook
      : raw;

  if (Array.isArray(raw.boards)) {
    return raw.boards.flatMap((item) => parseBoardImportPayload(item)).filter(Boolean);
  }

  const board = normalizeRecord(candidate);
  return board ? [board] : [];
}

export function readAutosave() {
  try {
    const raw = localStorage.getItem(PLAYBOOK_AUTOSAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const scene = normalizeScene(data.scene);
    if (!scene) return null;
    return {
      ts: Number.isFinite(data.ts) ? data.ts : now(),
      boardId: data.boardId ? String(data.boardId) : '',
      name: normalizeName(data.name),
      scene
    };
  } catch (_) {
    return null;
  }
}

export function writeAutosave({ boardId = '', name = '', scene }) {
  const nextScene = normalizeScene(scene);
  if (!nextScene) return false;
  try {
    localStorage.setItem(PLAYBOOK_AUTOSAVE_KEY, JSON.stringify({
      ts: now(),
      boardId: String(boardId || ''),
      name: normalizeName(name),
      scene: nextScene
    }));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearAutosave() {
  try {
    localStorage.removeItem(PLAYBOOK_AUTOSAVE_KEY);
  } catch (_) {}
}
