import { useEffect, useRef, useState } from "react";
import { clock, recordingMime } from "../../lib/chatMedia";
import { micPermission, micProblem, micProblemText } from "../../lib/micPermission";
import { haptic, prefersReducedMotion } from "../../lib/motion";
import { AudioPlayer } from "./AudioPlayer";
import { GIcon } from "./groupIcons";

/** No máximo 2 minutos (o servidor aceita até 2:05); chegando lá, para e abre a revisão. */
export const MAX_AUDIO_MS = 120_000;
/** Menos que isso foi toque sem querer: descarta. */
const MIN_AUDIO_MS = 700;
/** Barrinhas do nível da voz na gravação. */
const BARS = 28;

type Take = { blob: Blob; url: string; durationMs: number };

/**
 * Gravar áudio na conversa: começa ao abrir; mostra o tempo e o nível da voz ao vivo. Dá para
 * descartar, enviar direto ou parar e ouvir antes de mandar.
 */
export function AudioRecorder({
  onSend,
  onClose,
  onError,
  onBlocked,
}: {
  onSend: (blob: Blob, durationMs: number) => void;
  onClose: () => void;
  onError: (message: string) => void;
  /** Microfone bloqueado nas permissões: quem chama mostra como liberar. */
  onBlocked: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.14));
  const [take, setTake] = useState<Take | null>(null);
  const [starting, setStarting] = useState(true);
  const session = useRef<{
    rec: MediaRecorder;
    stream: MediaStream;
    chunks: Blob[];
    start: number;
    timer: number;
    ctx: AudioContext | null;
    raf: number;
    after: "review" | "send" | "discard";
  } | null>(null);

  // Começa a gravar assim que abre (o toque no microfone já foi o pedido).
  useEffect(() => {
    let cancelled = false;
    const mime = recordingMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      onError(micProblemText("unsupported"));
      onClose();
      return;
    }
    // Já bloqueado: o navegador nem mostraria o pedido; vai direto para o "como liberar".
    void micPermission()
      .then((state) => {
        if (state === "denied") throw new DOMException("bloqueado", "NotAllowedError");
        return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        // 24 kbps: bom para voz e leve (1 minuto ≈ 180 KB).
        const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 24_000 });
        const state = { rec, stream, chunks: [] as Blob[], start: Date.now(), timer: 0, ctx: null as AudioContext | null, raf: 0, after: "review" as "review" | "send" | "discard" };
        rec.ondataavailable = (e) => e.data.size > 0 && state.chunks.push(e.data);
        rec.onstop = () => {
          window.clearInterval(state.timer);
          cancelAnimationFrame(state.raf);
          void state.ctx?.close().catch(() => {});
          stream.getTracks().forEach((t) => t.stop());
          session.current = null;
          const durationMs = Math.min(Date.now() - state.start, MAX_AUDIO_MS);
          if (state.after === "discard") return;
          if (durationMs < MIN_AUDIO_MS) {
            onError("Áudio muito curto. Toque no microfone e fale.");
            onClose();
            return;
          }
          const blob = new Blob(state.chunks, { type: mime.split(";")[0] });
          if (state.after === "send") {
            onSend(blob, durationMs);
            onClose();
          } else {
            setTake({ blob, url: URL.createObjectURL(blob), durationMs });
          }
        };
        state.timer = window.setInterval(() => {
          const ms = Date.now() - state.start;
          setElapsed(ms);
          if (ms >= MAX_AUDIO_MS) stop("review");
        }, 200);
        // Nível da voz: um analisador lê o volume e as barrinhas andam da direita para a esquerda.
        if (!prefersReducedMotion() && typeof AudioContext !== "undefined") {
          try {
            const ctx = new AudioContext();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 512;
            ctx.createMediaStreamSource(stream).connect(analyser);
            const data = new Uint8Array(analyser.fftSize);
            let last = 0;
            const tick = (t: number) => {
              if (t - last > 70) {
                last = t;
                analyser.getByteTimeDomainData(data);
                let sum = 0;
                for (const v of data) sum += ((v - 128) / 128) ** 2;
                const level = Math.min(1, Math.sqrt(sum / data.length) * 4.5);
                setLevels((cur) => [...cur.slice(1), Math.max(0.14, level)]);
              }
              state.raf = requestAnimationFrame(tick);
            };
            state.raf = requestAnimationFrame(tick);
            state.ctx = ctx;
          } catch {
            // Sem analisador: grava normal, só sem as barrinhas mexendo.
          }
        }
        session.current = state;
        setStarting(false);
        rec.start(1000);
        haptic(15);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const problem = micProblem(error);
        if (problem === "blocked") onBlocked();
        else onError(micProblemText(problem));
        onClose();
      });
    return () => {
      cancelled = true;
      // Saiu da conversa no meio: descarta.
      stop("discard");
    };
    // Só ao abrir: as funções de fora não mudam o que já está gravando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (take) URL.revokeObjectURL(take.url);
  }, [take]);

  function stop(after: "review" | "send" | "discard") {
    const state = session.current;
    if (!state) return;
    state.after = after;
    if (state.rec.state !== "inactive") state.rec.stop();
  }

  if (take) {
    return (
      <div className="group-composer-row group-recording is-review" role="group" aria-label="Ouvir o áudio antes de enviar">
        <button type="button" className="group-icon-btn group-recording-trash" onClick={onClose} aria-label="Descartar o áudio" title="Descartar">
          {GIcon.trash}
        </button>
        <AudioPreview take={take} />
        <button
          type="button"
          className="group-send"
          onClick={() => {
            onSend(take.blob, take.durationMs);
            onClose();
          }}
          aria-label="Enviar o áudio"
        >
          {GIcon.send}
        </button>
      </div>
    );
  }

  return (
    <div className="group-composer-row group-recording" role="status" aria-live="polite">
      {/* Fechar descarta: a limpeza do efeito para a gravação sem enviar. */}
      <button type="button" className="group-icon-btn group-recording-trash" onClick={onClose} aria-label="Descartar o áudio" title="Descartar">
        {GIcon.trash}
      </button>
      <span className="group-recording-live">
        <i className="group-recording-dot" aria-hidden="true" />
        <span className="group-recording-time">{starting ? "Abrindo o microfone…" : clock(elapsed)}</span>
        <span className="group-recording-bars" aria-hidden="true">
          {levels.map((l, i) => (
            <span key={i} style={{ transform: `scaleY(${l.toFixed(2)})` }} />
          ))}
        </span>
        <small className="group-recording-limit">até {clock(MAX_AUDIO_MS)}</small>
      </span>
      <button type="button" className="group-icon-btn group-recording-stop" onClick={() => stop("review")} disabled={starting} aria-label="Parar e ouvir antes de enviar" title="Parar e ouvir">
        <span className="group-recording-square" aria-hidden="true" />
      </button>
      <button type="button" className="group-send" onClick={() => stop("send")} disabled={starting} aria-label="Enviar o áudio">
        {GIcon.send}
      </button>
    </div>
  );
}

/** Ouvir o que gravou, no mesmo tocador das mensagens. */
function AudioPreview({ take }: { take: Take }) {
  return (
    <span className="group-recording-live is-preview">
      <AudioPlayer url={take.url} durationMs={take.durationMs} seed={take.durationMs} speed={false} label="o áudio gravado" />
    </span>
  );
}
