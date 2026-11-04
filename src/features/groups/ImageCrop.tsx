import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { exportChatImage } from "../../lib/chatMedia";
import { initialCrop, moveCrop, resizeCrop, type Corner, type CropRect } from "./cropMath";
import { GIcon } from "./groupIcons";

const ASPECTS = [
  { id: "free", label: "Livre" },
  { id: "square", label: "Quadrado" },
  { id: "original", label: "Original" },
] as const;
type Aspect = (typeof ASPECTS)[number]["id"];

type Drag = { kind: "move" | Corner; x: number; y: number; start: CropRect; id: number };

/**
 * Antes de enviar a foto: cortar (arrastando a moldura e os cantos), escolher o formato e
 * escrever a legenda.
 */
export function ImageCrop({
  file,
  caption: initialCaption,
  onCancel,
  onSend,
}: {
  file: File;
  caption: string;
  onCancel: () => void;
  onSend: (image: { blob: Blob; width: number; height: number }, caption: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [aspect, setAspect] = useState<Aspect>("free");
  const [caption, setCaption] = useState(initialCaption);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drag = useRef<Drag | null>(null);

  // Cria e descarta o endereço no mesmo efeito (no modo estrito o React monta duas vezes).
  useEffect(() => {
    const created = URL.createObjectURL(file);
    setUrl(created);
    return () => URL.revokeObjectURL(created);
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const ratioFor = (a: Aspect, b = box) => (a === "square" ? 1 : a === "original" && b ? b.w / b.h : null);

  function measure() {
    const el = img.current;
    if (!el) return;
    const b = { w: el.clientWidth, h: el.clientHeight };
    setBox(b);
    setCrop(initialCrop(b.w, b.h, ratioFor(aspect, b)));
  }

  function choose(a: Aspect) {
    setAspect(a);
    if (box) setCrop(initialCrop(box.w, box.h, ratioFor(a)));
  }

  function start(kind: Drag["kind"], e: ReactPointerEvent) {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { kind, x: e.clientX, y: e.clientY, start: crop, id: e.pointerId };
  }

  function move(e: ReactPointerEvent) {
    const d = drag.current;
    if (!d || !box || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    setCrop(d.kind === "move" ? moveCrop(d.start, dx, dy, box.w, box.h) : resizeCrop(d.start, d.kind, dx, dy, box.w, box.h, ratioFor(aspect)));
  }

  async function send() {
    const el = img.current;
    if (!el || !crop || !box) return;
    setBusy(true);
    setError("");
    try {
      // Da moldura na tela para os pixels da foto original.
      const scale = el.naturalWidth / box.w;
      const image = await exportChatImage(el, {
        x: Math.round(crop.x * scale),
        y: Math.round(crop.y * scale),
        width: Math.max(1, Math.round(crop.w * scale)),
        height: Math.max(1, Math.round(crop.h * scale)),
      });
      onSend(image, caption.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível preparar a foto.");
      setBusy(false);
    }
  }

  return createPortal(
    <div className="image-crop" role="dialog" aria-modal="true" aria-label="Cortar a foto antes de enviar">
      <header className="image-crop-head">
        <button type="button" className="group-icon-btn" onClick={onCancel} disabled={busy} aria-label="Cancelar">
          {GIcon.close}
        </button>
        <strong>Cortar foto</strong>
        <span />
      </header>

      <div className="image-crop-stage" onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerCancel={() => (drag.current = null)}>
        <div className="image-crop-frame">
          {url ? <img ref={img} src={url} alt="" onLoad={measure} draggable={false} /> : null}
          {crop ? (
            <div
              className="image-crop-box"
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
              onPointerDown={(e) => start("move", e)}
            >
              {(["nw", "ne", "sw", "se"] as const).map((c) => (
                <span key={c} className={`image-crop-handle is-${c}`} onPointerDown={(e) => start(c, e)} />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="image-crop-aspects" role="radiogroup" aria-label="Formato do corte">
        {ASPECTS.map((a) => (
          <button key={a.id} type="button" role="radio" aria-checked={aspect === a.id} className={aspect === a.id ? "is-on" : ""} onClick={() => choose(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      {error ? <p className="image-crop-error">{error}</p> : null}

      <footer className="image-crop-foot">
        <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda (opcional)" maxLength={1000} aria-label="Legenda" />
        <button type="button" className="group-send" onClick={() => void send()} disabled={busy || !crop} aria-label="Enviar a foto">
          {GIcon.send}
        </button>
      </footer>
    </div>,
    document.body,
  );
}
