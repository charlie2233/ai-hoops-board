import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Download, FileArchive, RefreshCw, Search } from "lucide-react";
import { browser } from "wxt/browser";
import "./style.css";

interface PopupState {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
  attachmentCount: number;
  title: string;
}

function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
  return browser.runtime.sendMessage(message);
}

function App() {
  const [state, setState] = useState<PopupState>({
    status: "idle",
    message: "Open a Classroom page to export a local AI archive item.",
    attachmentCount: 0,
    title: "No page captured"
  });

  async function refreshSnapshot() {
    setState((current) => ({ ...current, status: "loading", message: "Reading visible Classroom content..." }));
    const response = await sendMessage<any>({ type: "classroom_ai:extract_current" });
    if (!response?.ok) {
      setState({
        status: "error",
        message: response?.error || "Could not read this page.",
        attachmentCount: 0,
        title: "No page captured"
      });
      return;
    }

    setState({
      status: "ready",
      message: "Snapshot ready for local archive export.",
      attachmentCount: response.item?.attachments?.length ?? 0,
      title: response.item?.title ?? response.snapshot?.title ?? "Classroom page"
    });
  }

  async function exportPage(downloadAttachments: boolean) {
    setState((current) => ({
      ...current,
      status: "loading",
      message: downloadAttachments ? "Exporting and queueing browser downloads..." : "Exporting page snapshot..."
    }));
    const response = await sendMessage<any>({
      type: "classroom_ai:export_current",
      downloadAttachments
    });

    if (!response?.ok) {
      setState((current) => ({
        ...current,
        status: "error",
        message: response?.error || "Export failed."
      }));
      return;
    }

    setState({
      status: "ready",
      message: response.nativeResponse?.ok
        ? "Archive item saved locally."
        : `Snapshot captured. Native host unavailable: ${response.nativeResponse?.error || "not configured"}`,
      attachmentCount: response.item?.attachments?.length ?? 0,
      title: response.item?.title ?? "Classroom page"
    });
  }

  useEffect(() => {
    void refreshSnapshot();
  }, []);

  return (
    <main className="panel" data-status={state.status}>
      <header className="header">
        <div>
          <p className="eyebrow">Local archive</p>
          <h1>Classroom AI Exporter</h1>
        </div>
        <button className="iconButton" title="Refresh snapshot" onClick={() => void refreshSnapshot()}>
          <RefreshCw size={18} />
        </button>
      </header>

      <section className="summary">
        <p className="title">{state.title}</p>
        <p className="message">{state.message}</p>
        <div className="metric">
          <Search size={16} />
          <span>{state.attachmentCount} attachment links found</span>
        </div>
      </section>

      <div className="actions">
        <button onClick={() => void exportPage(false)} disabled={state.status === "loading"}>
          <FileArchive size={17} />
          Export page
        </button>
        <button className="primary" onClick={() => void exportPage(true)} disabled={state.status === "loading"}>
          <Download size={17} />
          Export + download
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
