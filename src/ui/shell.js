export function createShellRefs(doc = document) {
  const $ = (id) => doc.getElementById(id);
  return {
    $,
    document: doc,
    canvas: $('board'),
    aiStrip: $('ai-strip'),
    themeColorMeta: doc.querySelector('meta[name="theme-color"]'),
    modeButtons: {
      drag: $('mode-drag'),
      run: $('mode-run'),
      pass: $('mode-pass')
    },
    themeButtons: {
      light: $('theme-light'),
      dark: $('theme-dark')
    },
    styleButtons: {
      classic: $('style-classic'),
      vivid: $('style-vivid')
    },
    langButtons: {
      zh: $('lang-zh'),
      en: $('lang-en')
    },
    offenseSelect: $('offense-player'),
    quickPlaySelect: $('quick-play'),
    randomPlayBtn: $('random-play'),
    toggleDefenseBtn: $('toggle-defense'),
    catalogStatusBadge: $('catalog-status-badge'),
    toolbarEl: $('toolbar'),
    bottombarEl: $('bottombar'),
    immersiveQuickbarEl: $('immersive-quickbar'),
    nativeFullscreenBtn: $('native-fullscreen'),
    immersiveToggleBtn: $('toggle-immersive'),
    immersiveExitBtn: $('immersive-exit'),
    immersiveSideBtn: $('immersive-side-toggle'),
    overlayRoot: $('overlay-root'),
    advancedToolbar: $('advanced-toolbar')
  };
}

export function attachShellApi(app) {
  app.toast = function toast(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);'
      + 'background:#111;color:#fff;padding:8px 12px;border-radius:10px;z-index:999;opacity:.92';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  };

  app.roundRect = function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  app.promptExportOptions = function promptExportOptions() {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.style.cssText = [
        'position:fixed',
        'inset:0',
        'background:rgba(0,0,0,.28)',
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
      box.innerHTML = `
        <div style="padding:14px 16px; border-bottom:1px solid #E5E7EB; font-weight:700;">${app.t('export_title')}</div>
        <div style="padding:16px;">
          <div style="margin-bottom:12px; font-weight:600;">${app.t('export_bg')}</div>
          <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="radio" name="bg" value="court" checked>
            <span>${app.t('export_bg_court')}</span>
          </label>
          <label style="display:flex;gap:8px;align-items:center;margin-bottom:16px;">
            <input type="radio" name="bg" value="white">
            <span>${app.t('export_bg_white')}</span>
          </label>
          <div style="margin-bottom:12px; font-weight:600;">${app.t('export_vis')}</div>
          <label style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
            <input type="radio" name="vis" value="all" checked>
            <span>${app.t('export_vis_all')}</span>
          </label>
          <label style="display:flex;gap:8px;align-items:center;">
            <input type="radio" name="vis" value="atk">
            <span>${app.t('export_vis_offense')}</span>
          </label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #E5E7EB;">
          <button data-act="cancel" style="height:40px;padding:0 14px;border:1px solid #E5E7EB;border-radius:10px;background:#fff;">${app.t('cancel')}</button>
          <button data-act="ok" style="height:40px;padding:0 16px;border:0;border-radius:10px;background:#FF7A1A;color:#fff;font-weight:700;">${app.t('export')}</button>
        </div>`;
      ov.appendChild(box);
      document.body.appendChild(ov);

      const close = () => ov.remove();
      box.querySelector('[data-act="cancel"]').onclick = () => {
        close();
        resolve(null);
      };
      box.querySelector('[data-act="ok"]').onclick = () => {
        const bg = box.querySelector('input[name="bg"]:checked').value;
        const vis = box.querySelector('input[name="vis"]:checked').value;
        close();
        resolve({ bg, hideDefense: vis === 'atk' });
      };
      ov.addEventListener('pointerdown', (e) => {
        if (e.target === ov) {
          close();
          resolve(null);
        }
      }, true);
    });
  };

  app.exportPNG = function exportPNG(opts = { bg: 'court', hideDefense: false }) {
    const { canvas, ctx } = app;
    if (ctx && 'imageSmoothingEnabled' in ctx) ctx.imageSmoothingEnabled = true;
    app.draw({ bg: opts.bg, hideDefense: opts.hideDefense, useView: false });

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    ctx.save();

    const title = app.applied.name
      ? app.t('export_play_named', { name: app.applied.name })
      : app.t('export_play_unnamed');
    const meta = `${app.state.court === 'half' ? app.t('court_half') : app.t('court_full')} · ${new Date().toLocaleString()}`;

    ctx.font = 'bold 14px system-ui';
    const tW = ctx.measureText(title).width;
    ctx.font = '12px system-ui';
    const mW = ctx.measureText(meta).width;
    const boxW = Math.max(tW, mW) + 24;
    const boxH = 46;
    const pad = 12;

    app.roundRect(ctx, pad, pad, boxW, boxH, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FF7A1A';
    ctx.stroke();

    ctx.fillStyle = '#111';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(title, pad + 12, pad + 18);
    ctx.font = '12px system-ui';
    ctx.fillText(meta, pad + 12, pad + 36);

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(`${app.t('watermark')} • ${new Date().toLocaleString()}`, W - 220, H - 12);

    ctx.restore();

    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = (app.applied.name || 'play') + '.png';
    a.click();
    app.draw();
  };
}
