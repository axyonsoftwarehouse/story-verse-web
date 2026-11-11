import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clock } from "../../lib/chatMedia";
import { audioPeaks, nextRate, placeholderPeaks, rateLabel, saveRate, savedRate, seekFraction } from "../../lib/audioWave";
import { GIcon } from "./groupIcons";

const BARS = 34;

/**
 * Tocador de áudio da conversa (e da revisão antes de enviar): tocar/pausar, forma de onda do
 * próprio áudio que se pinta conforme toca (toque ou arraste para pular, setas no teclado),
 * tempo e velocidade. Um áudio por vez.
 */
export function AudioPlayer({
  url,
  durationMs,
  seed,
  loading = false,
  speed = true,
  label = "Áudio",
}: {
  url: string | null;
  durationMs: number;
  /** Para a onda provisória não mudar entre renders (id da mensagem). */
  seed: number;
  loading?: boolean;
  /** Botão de velocidade (na revisão antes de enviar não precisa). */
  speed?: boolean;
  label?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const dragging = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [rate, setRate] = useState(savedRate);
  const [peaks, setPeaks] = useState<number[]>(() => placeholderPeaks(seed, BARS));
  const [real, setReal] = useState(false);
  const [metaDuration, setMetaDuration] = useState(0);

  // Onda de verdade, lida do arquivo; até lá (ou se falhar) fica a provisória.
  useEffect(() => {
    if (!url) return;
    let alive = true;
    void audioPeaks(url, BARS).then((p) => {
      if (alive && p) {
        setPeaks(p);
        setReal(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [url]);

  // Gravações do navegador (WebM) às vezes dizem duração "Infinity": vale a que veio com a mensagem.
  const total = durationMs > 0 ? durationMs / 1000 : metaDuration;
  const progress = total > 0 ? Math.min(1, at / total) : 0;

  function seekTo(fraction: number) {
    const el = audio.current;
    if (!el || !total) return;
    el.currentTime = fraction * total;
    setAt(el.currentTime);
  }

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }

  function pointerSeek(e: PointerEvent<HTMLSpanElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    seekTo(seekFraction(e.clientX, box.left, box.width));
  }

  function onKey(e: KeyboardEvent<HTMLSpanElement>) {
    if (!total) return;
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
    if (step !== undefined) seekTo(Math.max(0, Math.min(total, at + step)) / total);
    else if (e.key === "Home") seekTo(0);
    else if (e.key === "End") seekTo(1);
    else if (e.key === " " || e.key === "Enter") toggle();
    else return;
    e.preventDefault();
  }

  const shown = playing || at > 0 ? at : total;
  const disabled = !url;

  return (
    <span className={`audio-player ${playing ? "is-playing" : ""} ${real ? "has-wave" : ""}`}>
      <button
        type="button"
        className={`audio-player-play ${loading && !url ? "is-loading" : ""}`}
        disabled={disabled}
        onClick={toggle}
        aria-label={playing ? `Pausar: ${label}` : `Tocar: ${label}`}
      >
        {loading && !url ? <span className="audio-player-spin" aria-hidden="true" /> : playing ? GIcon.pause : GIcon.play}
      </button>
      <span className="audio-player-body">
        <span
          className="audio-player-wave"
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`Posição: ${label}`}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(at)}
          aria-valuetext={`${clock(at * 1000)} de ${clock(total * 1000)}`}
          aria-disabled={disabled || undefined}
          onPointerDown={(e) => {
            if (disabled) return;
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            pointerSeek(e);
          }}
          onPointerMove={(e) => dragging.current && pointerSeek(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
          onKeyDown={onKey}
        >
          {peaks.map((p, i) => (
            <span key={i} className={(i + 0.5) / BARS <= progress ? "is-played" : undefined} style={{ height: `${Math.round(p * 100)}%` }} />
          ))}
          <i className="audio-player-head" style={{ left: `${progress * 100}%` }} aria-hidden="true" />
        </span>
        <span className="audio-player-meta">
          <small className="audio-player-time">{clock(shown * 1000)}</small>
          {speed ? (
            <button
              type="button"
              className={`audio-player-rate ${rate !== 1 ? "is-on" : ""}`}
              disabled={disabled}
              onClick={() => {
                const next = nextRate(rate);
                setRate(next);
                saveRate(next);
                if (audio.current) audio.current.playbackRate = next;
              }}
              aria-label={`Velocidade ${rateLabel(rate)}. Toque para mudar`}
              title="Velocidade"
            >
              {rateLabel(rate)}
            </button>
          ) : null}
        </span>
      </span>
      {url ? (
        <audio
          ref={audio}
          className="group-audio-el"
          src={url}
          preload="metadata"
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = rate;
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setMetaDuration(d);
          }}
          onPlay={(e) => {
            const el = e.currentTarget;
            document.querySelectorAll<HTMLAudioElement>("audio.group-audio-el").forEach((other) => other !== el && other.pause());
            // A velocidade escolhida em outro áudio vale para este também.
            const current = savedRate();
            el.playbackRate = current;
            setRate(current);
            setPlaying(true);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => !dragging.current && setAt(e.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false);
            setAt(0);
          }}
        />
      ) : null}
    </span>
  );
}
