import { useCallback, useState } from "react";

type CaptureResponse = {
  ok: boolean;
  pages?: number;
  filename?: string;
  stopReason?: string;
  error?: string;
};

type CaptureMode = "current" | "practice";

const MODE_LABELS: Record<CaptureMode, string> = {
  current: "Capture Current Page",
  practice: "Capture Whole Practice"
};

export default function App() {
  const [activeMode, setActiveMode] = useState<CaptureMode | null>(null);
  const [status, setStatus] = useState("Ready");
  const [lastResult, setLastResult] = useState<CaptureResponse | null>(null);

  const capture = useCallback(async (mode: CaptureMode) => {
    setActiveMode(mode);
    setLastResult(null);
    setStatus(mode === "current" ? "Capturing page..." : "Walking practice...");

    try {
      const response = await chrome.runtime.sendMessage({
        type: mode === "current" ? "CAPTURE_CURRENT_PAGE" : "CAPTURE_WHOLE_PRACTICE"
      });
      const result = response as CaptureResponse;
      setLastResult(result);

      if (result.ok) {
        const pageLabel = result.pages === 1 ? "1 page" : `${result.pages ?? 0} pages`;
        setStatus(`Downloaded ${pageLabel}`);
      } else {
        setStatus(result.error ?? "Capture failed");
      }
    } catch (error) {
      setLastResult({ ok: false, error: error instanceof Error ? error.message : String(error) });
      setStatus(error instanceof Error ? error.message : "Capture failed");
    } finally {
      setActiveMode(null);
    }
  }, []);

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <h1>Formative AI Exporter</h1>
          <p>{status}</p>
        </div>
      </header>

      <section className="actions" aria-label="Capture actions">
        {(Object.keys(MODE_LABELS) as CaptureMode[]).map((mode) => (
          <button
            key={mode}
            className={mode === "practice" ? "primary" : "secondary"}
            disabled={activeMode !== null}
            onClick={() => void capture(mode)}
            type="button"
          >
            <span className="button-icon" aria-hidden="true">
              {mode === "practice" ? "ZIP" : "TXT"}
            </span>
            <span>{activeMode === mode ? "Working..." : MODE_LABELS[mode]}</span>
          </button>
        ))}
      </section>

      {lastResult?.ok && (
        <footer className="result" aria-live="polite">
          <strong>{lastResult.filename}</strong>
          {lastResult.stopReason && <span>{lastResult.stopReason}</span>}
        </footer>
      )}

      {lastResult && !lastResult.ok && (
        <footer className="result error" aria-live="assertive">
          {lastResult.error}
        </footer>
      )}
    </main>
  );
}
