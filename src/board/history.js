export function attachHistoryApi(app) {
  app.pushUndo = function pushUndo(scene = app.serializeScene()) {
    app.state.undoStack.push(JSON.parse(JSON.stringify(scene)));
    if (app.state.undoStack.length > 50) app.state.undoStack.shift();
    app.state.redoStack.length = 0;
  };

  app.undo = function undo() {
    if (!app.state.undoStack.length) return;
    const last = app.state.undoStack.pop();
    app.state.redoStack.push(app.captureSceneSnapshot ? app.captureSceneSnapshot() : app.serializeScene());
    app.restoreScene(last);
  };

  app.redo = function redo() {
    if (!app.state.redoStack.length) return;
    const next = app.state.redoStack.pop();
    app.state.undoStack.push(app.captureSceneSnapshot ? app.captureSceneSnapshot() : app.serializeScene());
    app.restoreScene(next);
  };
}
