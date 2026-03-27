const COPY = {
  zh: {
    shortcutsHelp: '快捷键已启用：V 拖拽，R 跑位线，P 传球箭头，D 防守，C 半场全场，F 沉浸模式，A 更多，空格回放。',
    modeDrag: '已切换到拖拽模式',
    modeRun: '已切换到跑位线模式',
    modePass: '已切换到传球箭头模式',
    immersiveOn: '已开启沉浸模式',
    immersiveOff: '已切换回原版布局',
    advancedOpen: '已展开更多工具',
    advancedClose: '已收起更多工具',
    replayStopped: '已停止回放'
  },
  en: {
    shortcutsHelp: 'Shortcuts enabled: V drag, R run line, P pass arrow, D defense, C half or full court, F immersive mode, A more tools, Space replay.',
    modeDrag: 'Switched to drag mode',
    modeRun: 'Switched to run line mode',
    modePass: 'Switched to pass arrow mode',
    immersiveOn: 'Immersive mode enabled',
    immersiveOff: 'Returned to the original layout',
    advancedOpen: 'More tools expanded',
    advancedClose: 'More tools collapsed',
    replayStopped: 'Replay stopped'
  }
};

function copyFor(app) {
  const lang = app.normalizeLang?.(app.state?.uiLang) || 'zh';
  return COPY[lang] || COPY.zh;
}

function isEditableTarget(target) {
  return !!target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
}

function isInteractiveTarget(target) {
  return !!target?.closest?.('button, a, input, select, textarea, [role="dialog"], [contenteditable=""], [contenteditable="true"]');
}

function triggerClick(el) {
  if (!el || typeof el.click !== 'function') return false;
  el.click();
  return true;
}

export function registerShortcuts(app) {
  const doc = app.document;

  doc.addEventListener('keydown', (event) => {
    const lower = String(event.key || '').toLowerCase();
    const editable = isEditableTarget(event.target);
    const interactive = isInteractiveTarget(event.target);
    const withMod = event.metaKey || event.ctrlKey;

    if (withMod && lower === 's') {
      event.preventDefault();
      triggerClick(app.refs.$('save'));
      return;
    }
    if (withMod && lower === 'z') {
      event.preventDefault();
      if (event.shiftKey) app.redo();
      else app.undo();
      return;
    }
    if (withMod && lower === 'y') {
      event.preventDefault();
      app.redo();
      return;
    }

    if (editable) return;
    if (event.altKey || event.metaKey || event.ctrlKey) return;

    if (event.key === '?') {
      event.preventDefault();
      app.toast(copyFor(app).shortcutsHelp);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (app.refs.overlayRoot && !app.refs.overlayRoot.hidden) {
        app.closeOverlay();
        return;
      }
      if (app.state.replay?.playing) {
        app.stopReplay();
        app.announce?.(copyFor(app).replayStopped);
        return;
      }
      if (app.refs.advancedToolbar?.classList.contains('show')) {
        triggerClick(app.refs.$('show-advanced'));
      }
      return;
    }

    if (event.key === ' ' && !interactive) {
      event.preventDefault();
      triggerClick(app.refs.$('btn-playpause'));
      return;
    }

    switch (lower) {
      case 'v':
        event.preventDefault();
        app.setMode('drag');
        app.announce?.(copyFor(app).modeDrag);
        break;
      case 'r':
        event.preventDefault();
        app.setMode('run');
        app.announce?.(copyFor(app).modeRun);
        break;
      case 'p':
        event.preventDefault();
        app.setMode('pass');
        app.announce?.(copyFor(app).modePass);
        break;
      case 'd':
        event.preventDefault();
        app.setDefendersRemoved(!app.areDefendersRemoved());
        break;
      case 'c':
        event.preventDefault();
        triggerClick(app.refs.$('toggle-court'));
        break;
      case 'a':
        event.preventDefault();
        triggerClick(app.refs.$('show-advanced'));
        app.announce?.(
          app.refs.advancedToolbar?.classList.contains('show')
            ? copyFor(app).advancedOpen
            : copyFor(app).advancedClose
        );
        break;
      case 'f':
        event.preventDefault();
        app.applyImmersiveMode(!app.state.immersive.enabled);
        app.announce?.(app.state.immersive.enabled ? copyFor(app).immersiveOn : copyFor(app).immersiveOff);
        break;
      case '0':
        event.preventDefault();
        triggerClick(app.refs.$('reset-view'));
        break;
      default:
        break;
    }
  });
}
