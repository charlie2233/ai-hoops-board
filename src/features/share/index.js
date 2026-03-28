function sanitizeFileBaseName(value) {
  return String(value || 'board')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'board';
}

function formatShareTimestamp(ts, lang) {
  const locale = lang === 'en' ? 'en-US' : 'zh-CN';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(ts));
  } catch (_) {
    return new Date(ts).toLocaleString(locale);
  }
}

function countVisibleDefenders(players) {
  return (players || []).filter((player) => player?.team === 'D' && !player.hidden).length;
}

function createFallbackModal(app) {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(2,6,23,.46)',
    'z-index:2000',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'padding:16px'
  ].join(';');

  const box = document.createElement('div');
  box.style.cssText = [
    'width:min(92vw,420px)',
    'background:#fff',
    'border:1px solid #E5E7EB',
    'border-radius:14px',
    'box-shadow:0 20px 60px rgba(0,0,0,.18)',
    'font:14px/1.5 system-ui',
    'color:#0F172A'
  ].join(';');

  const actionMarkup = [
    { id: 'summary', key: 'share_copy_summary' },
    { id: 'json', key: 'share_copy_json' },
    { id: 'download', key: 'share_download_json' }
  ].map((action) => (
    `<button data-act="${action.id}" style="height:42px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;font-weight:700;padding:0 12px;cursor:pointer;">${app.t(action.key)}</button>`
  )).join('');

  box.innerHTML = `
    <div style="padding:14px 16px; border-bottom:1px solid #E5E7EB; font-weight:700;">${app.t('share_title')}</div>
    <div style="padding:16px; display:grid; gap:10px;">
      <div style="color:#475569;">${app.t('share_fallback_hint')}</div>
      ${actionMarkup}
    </div>
    <div style="display:flex;justify-content:flex-end;padding:12px 16px;border-top:1px solid #E5E7EB;">
      <button data-act="close" style="height:40px;padding:0 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;cursor:pointer;">${app.t('cancel')}</button>
    </div>`;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('pointerdown', (event) => {
    if (event.target === overlay) close();
  });

  box.querySelector('[data-act="summary"]').onclick = async () => {
    await app.copyBoardSummary();
    close();
  };
  box.querySelector('[data-act="json"]').onclick = async () => {
    await app.copyBoardJson();
    close();
  };
  box.querySelector('[data-act="download"]').onclick = () => {
    app.downloadBoardJson();
    close();
  };
  box.querySelector('[data-act="close"]').onclick = close;
}

export function attachShareApi(app) {
  app.createBoardSharePayload = function createBoardSharePayload() {
    const exportedAt = Date.now();
    return {
      schema: 1,
      exportedAt,
      source: 'ai-hoops-board',
      scene: app.serializeScene()
    };
  };

  app.buildBoardSummaryText = function buildBoardSummaryText(payload = app.createBoardSharePayload()) {
    const lang = app.normalizeLang(app.state.uiLang);
    const scene = payload.scene || app.serializeScene();
    const players = scene.players || [];
    const appliedName = app.applied.name || app.t('share_play_untitled');
    const courtLabel = scene.court === 'full' ? app.t('court_full') : app.t('court_half');
    const lines = [
      app.t('app_title'),
      `${app.t('share_play_label')}${appliedName}`,
      `${app.t('share_court_label')}${courtLabel}`,
      `${app.t('share_ball_handler_label')}${scene.ballHandlerId || '-'}`,
      `${app.t('share_shapes_label')}${Array.isArray(scene.shapes) ? scene.shapes.length : 0}`,
      `${app.t('share_defenders_label')}${countVisibleDefenders(players)}`,
      `${app.t('share_shared_at_label')}${formatShareTimestamp(payload.exportedAt, lang)}`
    ];
    return lines.join('\n');
  };

  app.copyTextWithFallback = async function copyTextWithFallback(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'readonly');
    input.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
    document.body.appendChild(input);
    input.select();
    input.setSelectionRange(0, input.value.length);
    const copied = document.execCommand('copy');
    input.remove();
    if (!copied) throw new Error('Clipboard unavailable');
    return true;
  };

  app.copyBoardSummary = async function copyBoardSummary() {
    const payload = app.createBoardSharePayload();
    await app.copyTextWithFallback(app.buildBoardSummaryText(payload));
    app.toast(app.t('share_toast_summary'));
  };

  app.copyBoardJson = async function copyBoardJson() {
    const payload = app.createBoardSharePayload();
    await app.copyTextWithFallback(JSON.stringify(payload, null, 2));
    app.toast(app.t('share_toast_json'));
  };

  app.downloadBoardJson = function downloadBoardJson() {
    const payload = app.createBoardSharePayload();
    const fileBase = sanitizeFileBaseName(app.applied.name || app.t('share_file_fallback'));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileBase}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    app.toast(app.t('share_toast_download'));
  };

  app.shareBoard = async function shareBoard() {
    const payload = app.createBoardSharePayload();
    const summary = app.buildBoardSummaryText(payload);
    const fileBase = sanitizeFileBaseName(app.applied.name || app.t('share_file_fallback'));
    const file = typeof File === 'function'
      ? new File([JSON.stringify(payload, null, 2)], `${fileBase}.json`, { type: 'application/json' })
      : null;

    try {
      if (typeof navigator.share === 'function') {
        if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: app.applied.name || app.t('app_title'),
            text: summary,
            files: [file]
          });
          return true;
        }

        await navigator.share({
          title: app.applied.name || app.t('app_title'),
          text: summary
        });
        return true;
      }
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      createFallbackModal(app);
      return false;
    }

    createFallbackModal(app);
    return false;
  };
}
