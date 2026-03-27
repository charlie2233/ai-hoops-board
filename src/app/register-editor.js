import { attachEditorApi } from '../features/editor/index.js';

function isTypingTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function registerEditor(app) {
  attachEditorApi(app);

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;

    const key = String(e.key || '').toLowerCase();
    const meta = e.metaKey || e.ctrlKey;

    if (key === 'escape') {
      if (app.state.editor?.editSession && app.abortSceneEdit) app.abortSceneEdit();
      else app.cancelCurrentInteraction();
      app.clearSelection({ redraw: false });
      app.draw();
      e.preventDefault();
      return;
    }

    if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      if (app.deleteSelectedObject && app.deleteSelectedObject()) {
        return;
      }
      return;
    }

    if (meta && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) app.redo();
      else app.undo();
      return;
    }

    if (meta && key === 'y') {
      e.preventDefault();
      app.redo();
      return;
    }

    if (key === 'v') {
      app.setMode('drag');
      e.preventDefault();
      return;
    }
    if (key === 'r') {
      app.setMode('run');
      e.preventDefault();
      return;
    }
    if (key === 'p') {
      app.setMode('pass');
      e.preventDefault();
    }
  });
}
