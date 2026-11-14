import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { PDFDocument } from "pdf-lib";
import "./styles.css";

const MAX_EDGE = 2400;

function formatBytes(bytes) {
  if (!bytes) return "0 KB";
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not read ${file.name}. Try saving it as JPG or PNG first.`));
    };
    img.src = url;
  });
}

async function imageToJpegBytes(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Image conversion failed.")), "image/jpeg", 0.9);
  });
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height
  };
}

function App() {
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [pageSize, setPageSize] = useState("a4");
  const [orientation, setOrientation] = useState("auto");
  const [margin, setMargin] = useState("small");
  const [fileName, setFileName] = useState("my-images");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const totalSize = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);

  async function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) {
      setMessage("Choose image files such as JPG, PNG or WEBP.");
      return;
    }
    const additions = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
      name: file.name
    }));
    setItems((current) => [...current, ...additions]);
    setMessage(`${files.length} image${files.length === 1 ? "" : "s"} added.`);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeItem(id) {
    setItems((current) => {
      const found = current.find((item) => item.id === id);
      if (found) URL.revokeObjectURL(found.url);
      return current.filter((item) => item.id !== id);
    });
  }

  function moveItem(index, direction) {
    setItems((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function createPdf() {
    if (!items.length || busy) return;
    setBusy(true);
    setMessage("Preparing your PDF…");
    try {
      const pdf = await PDFDocument.create();
      const marginPoints = margin === "none" ? 0 : margin === "large" ? 36 : 18;
      const sizes = {
        a4: [595.28, 841.89],
        letter: [612, 792],
        original: null
      };

      for (let index = 0; index < items.length; index++) {
        setMessage(`Adding image ${index + 1} of ${items.length}…`);
        const converted = await imageToJpegBytes(items[index].file);
        const embedded = await pdf.embedJpg(converted.bytes);
        let [pageW, pageH] = sizes[pageSize] || [converted.width * 0.75, converted.height * 0.75];

        if (orientation === "portrait") {
          if (pageW > pageH) [pageW, pageH] = [pageH, pageW];
        } else if (orientation === "landscape") {
          if (pageH > pageW) [pageW, pageH] = [pageH, pageW];
        } else if (pageSize !== "original" && converted.width > converted.height) {
          [pageW, pageH] = [pageH, pageW];
        }

        const page = pdf.addPage([pageW, pageH]);
        const availableW = Math.max(1, pageW - marginPoints * 2);
        const availableH = Math.max(1, pageH - marginPoints * 2);
        const scale = Math.min(availableW / embedded.width, availableH / embedded.height);
        const drawW = embedded.width * scale;
        const drawH = embedded.height * scale;
        page.drawImage(embedded, {
          x: (pageW - drawW) / 2,
          y: (pageH - drawH) / 2,
          width: drawW,
          height: drawH
        });
      }

      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeName = (fileName.trim() || "my-images").replace(/[\\/:*?"<>|]+/g, "-");
      anchor.href = url;
      anchor.download = `${safeName}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage(`Done! Your PDF contains ${items.length} page${items.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error(error);
      setMessage(error?.message || "Something went wrong while creating the PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function installApp() {
    if (!installPrompt) {
      setMessage("In Chrome, open the menu and choose “Add to Home screen” or “Install app”.");
      return;
    }
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function clearAll() {
    items.forEach((item) => URL.revokeObjectURL(item.url));
    setItems([]);
    setMessage("All images cleared.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Image2PDF home">
          <span className="brand-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h7l5 5v15H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v6h5M9 13h6M9 17h6"/></svg></span>
          <span>Image<span className="brand-blue">2PDF</span></span>
        </a>
        <button className="install-button" onClick={installApp}>＋ Install app</button>
      </header>

      <section className="hero">
        <div className="eyebrow"><span className="eyebrow-dot"></span> FREE · PRIVATE · NO WATERMARK</div>
        <h1>Your images.<br /><span>Your PDF.</span></h1>
        <p className="hero-copy">Turn photos, notes and screenshots into a clean PDF in seconds. Everything stays on your device.</p>
      </section>

      <section className="workspace">
        <div className="section-heading">
          <div>
            <h2>1. Add your images</h2>
            <p>Select one or more photos from your phone.</p>
          </div>
          {items.length > 0 && <span className="count-pill">{items.length} selected</span>}
        </div>

        <input
          ref={inputRef}
          className="hidden-input"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => addFiles(event.target.files)}
        />

        <button className="upload-card" onClick={() => inputRef.current?.click()}>
          <span className="upload-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg></span>
          <strong>Select images</strong>
          <span>Choose from gallery · JPG, PNG, WEBP</span>
          <span className="upload-cta">Browse photos</span>
        </button>

        {items.length > 0 && (
          <div className="image-list-section">
            <div className="list-title-row">
              <h3>Your images <span>({items.length})</span></h3>
              <button className="text-button danger-text" onClick={clearAll}>Clear all</button>
            </div>
            <div className="image-list">
              {items.map((item, index) => (
                <article className="image-row" key={item.id}>
                  <span className="order-number">{index + 1}</span>
                  <img className="thumbnail" src={item.url} alt={item.name} />
                  <div className="image-info">
                    <strong>{item.name}</strong>
                    <span>{formatBytes(item.file.size)}</span>
                  </div>
                  <div className="row-actions">
                    <button aria-label={`Move ${item.name} up`} disabled={index === 0} onClick={() => moveItem(index, -1)}>↑</button>
                    <button aria-label={`Move ${item.name} down`} disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}>↓</button>
                    <button className="remove-button" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.id)}>×</button>
                  </div>
                </article>
              ))}
            </div>
            <div className="add-more-wrap"><button className="add-more" onClick={() => inputRef.current?.click()}>＋ Add more images</button></div>
          </div>
        )}

        <div className="settings">
          <div className="section-heading settings-heading">
            <div><h2>2. PDF settings</h2><p>Choose how your pages should look.</p></div>
          </div>
          <label className="field">
            <span>PDF file name</span>
            <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="my-images" maxLength={60} />
          </label>
          <div className="settings-grid">
            <label className="field">
              <span>Page size</span>
              <select value={pageSize} onChange={(event) => setPageSize(event.target.value)}>
                <option value="a4">A4</option>
                <option value="letter">US Letter</option>
                <option value="original">Fit image size</option>
              </select>
            </label>
            <label className="field">
              <span>Orientation</span>
              <select value={orientation} onChange={(event) => setOrientation(event.target.value)}>
                <option value="auto">Auto</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </label>
            <label className="field full-field">
              <span>Page margins</span>
              <select value={margin} onChange={(event) => setMargin(event.target.value)}>
                <option value="none">No margin</option>
                <option value="small">Small</option>
                <option value="large">Large</option>
              </select>
            </label>
          </div>
        </div>

        <div className="convert-area">
          <button className="convert-button" disabled={!items.length || busy} onClick={createPdf}>
            {busy ? <><span className="spinner"></span> Creating PDF…</> : <>Convert to PDF <span>→</span></>}
          </button>
          <p className="convert-note"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2 3 5v4c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V5l-7-3Z"/><path d="m7 10 2 2 4-4"/></svg> No watermark · No sign-up · Files stay on your device</p>
          {message && <div className="status-message" role="status">{message}</div>}
          {items.length > 0 && <div className="file-summary">{items.length} image{items.length === 1 ? "" : "s"} · {formatBytes(totalSize)} total</div>}
        </div>
      </section>

      <footer>
        <div className="footer-brand">Image2PDF</div>
        <p>Made for everyday use. Your files never leave your device.</p>
        <span>Free forever for personal use.</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => console.error("Service worker registration failed:", error));
  });
}
