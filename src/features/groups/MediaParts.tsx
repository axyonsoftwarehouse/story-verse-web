import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { clock, mediaUrl } from "../../lib/chatMedia";
import type { GroupMessage } from "../../lib/groups";
import { GIcon } from "./groupIcons";

/** Endereço local da foto/áudio: a cópia do aparelho ou baixada agora; `null` = expirou. */
function useMedia(m: GroupMessage): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(m.media_local ?? null);
  const [loading, setLoading] = useState(!m.media_local);
  useEffect(() => {
    if (m.media_local) {
      setUrl(m.media_local);
      setLoading(false);
      return;
    }
    if (m.pending || m.failed) return;
    let alive = true;
    setLoading(true);
    mediaUrl(m.id, Boolean(m.media_available))
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [m.id, m.media_local, m.media_available, m.pending, m.failed]);
  return { url, loading };
}

function Expired({ kind }: { kind: "image" | "audio" }) {
  return (
    <span className="group-media-expired">
      {kind === "image" ? GIcon.image : GIcon.mic}
      {kind === "image" ? "Foto expirada" : "Áudio expirado"}
      <small>Fotos e áudios ficam 24 h no servidor</small>
    </span>
  );
}

/** Foto na conversa (no tamanho certo antes de carregar); toque abre em tela cheia. */
export function ChatImage({ message: m }: { message: GroupMessage }) {
  const { url, loading } = useMedia(m);
  const [open, setOpen] = useState(false);
  const ratio = m.media_width && m.media_height ? m.media_width / m.media_height : 4 / 3;
  if (!url && !loading) return <Expired kind="image" />;
  return (
    <>
      <button
        type="button"
        className={`group-media-image ${url ? "" : "is-loading"}`}
        style={{ "--ratio": ratio } as CSSProperties}
        onClick={() => url && setOpen(true)}
        aria-label="Abrir a foto"
      >
        {url ? <img src={url} alt="" decoding="async" /> : null}
      </button>
      {open && url ? <Lightbox url={url} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="group-lightbox" role="dialog" aria-modal="true" aria-label="Foto" onClick={onClose}>
      <button type="button" className="group-icon-btn group-lightbox-close" aria-label="Fechar" onClick={onClose}>
        {GIcon.close}
      </button>
      <img src={url} alt="" onClick={(e) => e.stopPropagation()} />
    </div>,
    document.body,
  );
}

/** Áudio na conversa: tocar/pausar, barra de progresso (toque para pular) e tempo. */
export function ChatAudio({ message: m }: { message: GroupMessage }) {
  const { url, loading } = useMedia(m);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const duration = (m.media_duration_ms ?? 0) / 1000;

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const onTime = () => setAt(el.currentTime);
    const onEnd = () => {
      setPlaying(false);
      setAt(0);
    };
    const onPause = () => setPlaying(false);
    const onPlay = () => {
      // Um áudio por vez, como no WhatsApp.
      document.querySelectorAll<HTMLAudioElement>("audio.group-audio-el").forEach((other) => other !== el && other.pause());
      setPlaying(true);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("pause", onPause);
    el.addEventListener("play", onPlay);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("play", onPlay);
    };
  }, [url]);

  if (!url && !loading) return <Expired kind="audio" />;
  const total = duration || audio.current?.duration || 0;
  const progress = total > 0 ? Math.min(100, (at / total) * 100) : 0;

  return (
    <span className="group-audio">
      <button
        type="button"
        className="group-audio-play"
        disabled={!url}
        onClick={() => {
          const el = audio.current;
          if (!el) return;
          if (el.paused) void el.play().catch(() => setPlaying(false));
          else el.pause();
        }}
        aria-label={playing ? "Pausar o áudio" : "Tocar o áudio"}
      >
        {playing ? GIcon.pause : GIcon.play}
      </button>
      <span
        className="group-audio-track"
        role="slider"
        tabIndex={0}
        aria-label="Posição do áudio"
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(at)}
        onClick={(e) => {
          const el = audio.current;
          if (!el || !total) return;
          const box = e.currentTarget.getBoundingClientRect();
          el.currentTime = Math.max(0, Math.min(total, ((e.clientX - box.left) / box.width) * total));
          setAt(el.currentTime);
        }}
      >
        <span style={{ width: `${progress}%` }} />
        <i style={{ left: `${progress}%` }} />
      </span>
      <small className="group-audio-time">{clock((playing || at > 0 ? at : total) * 1000)}</small>
      {url ? <audio ref={audio} className="group-audio-el" src={url} preload="metadata" /> : null}
    </span>
  );
}
