import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { mediaUrl } from "../../lib/chatMedia";
import type { GroupMessage } from "../../lib/groups";
import { AudioPlayer } from "./AudioPlayer";
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

/** Áudio na conversa: o tocador com forma de onda; some quando o arquivo expirou. */
export function ChatAudio({ message: m }: { message: GroupMessage }) {
  const { url, loading } = useMedia(m);
  if (!url && !loading) return <Expired kind="audio" />;
  return <AudioPlayer url={url} loading={loading} durationMs={m.media_duration_ms ?? 0} seed={m.id} label="áudio da mensagem" />;
}
