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
  nativeConnected: boolean;
  archiveRoot: string;
  lastExportPath: string;
  downloadSummary: string;
}

function sendMessage<T>(message: Record<string, unknown>): Promise<T> {
  return browser.runtime.sendMessage(message);
}

function App() {
  const [state, setState] = useState<PopupState>({
    status: "idle",
    message: "Open a Classroom page to export a local AI archive item.",
    attachmentCount: 0,
    title: "No page captured",
    nativeConnected: false,
    archiveRoot: "Not connected",
    lastExportPath: "No export yet",
    downloadSummary: "No downloads queued"
  });

  async function refreshNativeHealth() {
    const response = await sendMessage<any>({ type: "classroom_ai:native_health" });
    const native = response?.native ?? {};
    const lastExport = response?.lastExport ?? null;
    setState((current) => ({
      ...current,
      nativeConnected: Boolean(native.connected),
      archiveRoot: native.root || lastExport?.fallbackResponse?.root || "Not connected",
      lastExportPath:
        lastExport?.nativeResponse?.paths?.markdown ||
        lastExport?.nativeResponse?.paths?.item_dir ||
        lastExport?.fallbackResponse?.paths?.["item.md"] ||
        lastExport?.fallbackResponse?.root ||
        "No export yet",
      downloadSummary: lastExport?.downloadResults
        ? `${lastExport.downloadResults.filter((result: any) => result.ok).length}/${lastExport.downloadResults.length} browser downloads completed`
        : current.downloadSummary
    }));
  }

  async function refreshSnapshot() {
    setState((current) => ({ ...current, status: "loading", message: "Reading visible Classroom content..." }));
    const response = await sendMessage<any>({ type: "classroom_ai:extract_current" });
    if (!response?.ok) {
      setState({
        status: "error",
        message: response?.error || "Could not read this page.",
        attachmentCount: 0,
        title: "No page captured",
        nativeConnected: state.nativeConnected,
        archiveRoot: state.archiveRoot,
        lastExportPath: state.lastExportPath,
        downloadSummary: state.downloadSummary
      });
      return;
    }

    setState((current) => ({
      status: "ready",
      message: "Snapshot ready for local archive export.",
      attachmentCount: response.item?.attachments?.length ?? 0,
      title: response.item?.title ?? response.snapshot?.title ?? "Classroom page",
      nativeConnected: current.nativeConnected,
      archiveRoot: current.archiveRoot,
      lastExportPath: current.lastExportPath,
      downloadSummary: current.downloadSummary
    }));
    await refreshNativeHealth();
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

    const downloadSummary = response.downloads
      ? `${response.downloads.succeeded}/${response.downloads.requested} browser downloads completed${
          response.downloads.failed ? `, ${response.downloads.failed} failed` : ""
        }`
      : "No downloads queued";

    setState((current) => ({
      status: "ready",
      message: response.nativeResponse?.ok
        ? "Archive item saved locally."
        : response.fallbackResponse?.ok
          ? "Native host unavailable; saved browser-download fallback."
          : `Snapshot captured. Native host unavailable: ${response.nativeResponse?.error || "not configured"}`,
      attachmentCount: response.item?.attachments?.length ?? 0,
      title: response.item?.title ?? "Classroom page",
      nativeConnected: Boolean(response.nativeResponse?.ok),
      archiveRoot: response.nativeResponse?.root || response.fallbackResponse?.root || current.archiveRoot,
      lastExportPath:
        response.nativeResponse?.paths?.markdown ||
        response.nativeResponse?.paths?.item_dir ||
        response.fallbackResponse?.paths?.["item.md"] ||
        response.fallbackResponse?.root ||
        current.lastExportPath,
      downloadSummary
    }));
    await refreshNativeHealth();
  }

  useEffect(() => {
    void refreshNativeHealth();
    void refreshSnapshot();
  }, []);

  return (
    <main className="panel" data-status={state.status}>
      <header className="header">
        <div>
          <p className="eyebrow">Local archive</p>
          <h1>CourseBinder – AI-Ready Google Classroom Exporter</h1>
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
        <div className="healthGrid">
          <span>Native host</span>
          <strong>{state.nativeConnected ? "connected" : "not connected"}</strong>
          <span>Archive root</span>
          <strong title={state.archiveRoot}>{state.archiveRoot}</strong>
          <span>Last export</span>
          <strong title={state.lastExportPath}>{state.lastExportPath}</strong>
          <span>Downloads</span>
          <strong>{state.downloadSummary}</strong>
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
