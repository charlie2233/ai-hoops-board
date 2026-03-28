import { registerCore } from './register-core.js';
import { registerPlaybook } from './register-playbook.js';
import { registerEditor } from './register-editor.js';
import { registerCatalog } from './register-catalog.js';
import { registerQuality } from './register-quality.js';
import { createShellRefs, attachShellApi } from '../ui/shell.js';
import { attachOverlayShell } from '../ui/overlay-shell.js';
import { attachI18nApi } from '../core/i18n.js';
import { attachPrefsApi } from '../core/prefs.js';
import { attachSceneApi } from '../board/scene.js';
import { attachHistoryApi } from '../board/history.js';
import { attachRenderApi } from '../board/render.js';
import { attachInteractionApi } from '../board/interaction.js';
import { attachReplayApi } from '../board/replay.js';
import { attachPlaysApi } from '../catalog/plays.js';
import { attachDrillsApi } from '../catalog/drills.js';
import { attachShareApi } from '../features/share/index.js';

export function boot() {
  const refs = createShellRefs(document);
  const app = {
    document,
    window,
    refs,
    canvas: refs.canvas,
    ctx: refs.canvas.getContext('2d'),
    applied: { id: null, name: null, meta: null }
  };

  attachSceneApi(app);
  attachShellApi(app);
  attachI18nApi(app);
  attachPrefsApi(app);
  attachHistoryApi(app);
  attachRenderApi(app);
  attachInteractionApi(app);
  attachReplayApi(app);
  attachPlaysApi(app);
  attachDrillsApi(app);
  attachShareApi(app);
  attachOverlayShell(app);

  registerCore(app);
  registerPlaybook(app);
  registerEditor(app);
  registerCatalog(app);
  registerQuality(app);

  app.readAppliedPlay();
  window.__aiHoopsBoardApp = app;
  return app;
}
