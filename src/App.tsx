import { useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import * as pdfjsLib from "pdfjs-dist";
import icon from "./assets-icon.png";
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type PdfDocument = pdfjsLib.PDFDocumentProxy;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [pdf, setPdf] = useState<PdfDocument | null>(null);
  const [fileName, setFileName] = useState("No scroll chosen");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPdf() {
    setError(null);

    const selected = await open({
      multiple: false,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    setLoading(true);

    try {
      const data = await readFile(selected);
      const bytes = new Uint8Array(data);
      const loadedPdf = await pdfjsLib.getDocument({ data: bytes }).promise;

      setPdf(loadedPdf);
      setPageNumber(1);
      setPageCount(loadedPdf.numPages);
      setFileName(selected.split(/[\\/]/).pop() ?? "Ancient PDF");
    } catch (err) {
      console.error(err);
      setError("The scroll resisted the frost. Try another PDF file.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let cancelled = false;

    async function renderPage() {
      try {
        renderTaskRef.current?.cancel();

        const page = await pdf!.getPage(pageNumber);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d");
        if (!context) return;

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const task = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") console.error(err);
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, pageNumber, scale]);

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src={icon} alt="Cold Reader icon" className="app-icon" />
          <div>
            <h1>Cold Reader</h1>
            <p>Fresh frost PDF viewer</p>
          </div>
        </div>

        <button className="primary" onClick={openPdf}>Open PDF Scroll</button>

        <div className="panel">
          <span className="label">Current Scroll</span>
          <strong>{fileName}</strong>
        </div>

        <div className="panel controls">
          <span className="label">Page</span>
          <div className="row">
            <button onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={!pdf || pageNumber <= 1}>◀</button>
            <strong>{pageNumber} / {pageCount || "—"}</strong>
            <button onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))} disabled={!pdf || pageNumber >= pageCount}>▶</button>
          </div>
        </div>

        <div className="panel controls">
          <span className="label">Frost Zoom</span>
          <div className="row">
            <button onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}>−</button>
            <strong>{Math.round(scale * 100)}%</strong>
            <button onClick={() => setScale((s) => Math.min(3, s + 0.15))}>+</button>
          </div>
        </div>
      </aside>

      <section className="reader">
        {!pdf && !loading && (
          <div className="empty">
            <div className="moon">☾</div>
            <h2>Open a frozen scroll</h2>
            <p>Select a PDF and let Cold Reader reveal its pages.</p>
          </div>
        )}

        {loading && <div className="empty">Summoning scroll...</div>}
        {error && <div className="empty error">{error}</div>}

        <canvas ref={canvasRef} className={pdf ? "page visible" : "page"} />
      </section>
    </main>
  );
}
