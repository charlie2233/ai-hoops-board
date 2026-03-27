export function attachHistoryApi(app) {
  app.pushUndo = function pushUndo() {
    app.state.undoStack.push(app.serializeScene());
    if (app.state.undoStack.length > 50) app.state.undoStack.shift();
    app.state.redoStack.length = 0;
  };

  app.undo = function undo() {
    if (!app.state.undoStack.length) return;
    const last = app.state.undoStack.pop();
    app.state.redoStack.push(app.serializeScene());
    app.restoreScene(last);
  };

  app.redo = function redo() {
    if (!app.state.redoStack.length) return;
    const next = app.state.redoStack.pop();
    app.state.undoStack.push(app.serializeScene());
    app.restoreScene(next);
  };
}
