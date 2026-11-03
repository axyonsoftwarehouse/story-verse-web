import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiHttpError, AuthSessionError } from "../../lib/backend";
import {
  fetchAudioManifest,
  fetchAudioProgress,
  fetchAudioStream,
  formatAudioClock,
  formatAudioDuration,
  saveAudioProgress,
  type AudioEdition,
  type AudioManifest,
  type AudioProgress,
  type AudioStream,
} from "../../lib/publicAudiobooks";
import { useStoredSession } from "../auth/useStoredSession";
import "./audiobook.css";

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2];
const LOCAL_PREFIX = "storyverse:audio:";

type LocalProgress = {
  chapterIndex: number;
  positionSeconds: number;
  playbackRate: number;
  completed: boolean;
  updatedAt: number;
};

function readLocal(audioId: string): LocalProgress | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + audioId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalProgress>;
    if (!parsed || typeof parsed.chapterIndex !== "number") return null;
    return {
      chapterIndex: parsed.chapterIndex,
      positionSeconds: Math.max(0, Number(parsed.positionSeconds) || 0),
      playbackRate: Number(parsed.playbackRate) || 1,
      completed: Boolean(parsed.completed),
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

function writeLocal(audioId: string, value: LocalProgress): void {
  try {
    localStorage.setItem(LOCAL_PREFIX + audioId, JSON.stringify(value));
  } catch {
    // Sem armazenamento: a escuta continua normalmente.
  }
}

export function AudiobookPage() {
  const { bookKey = "" } = useParams<{ bookKey: string }>();
  const { session } = useStoredSession();
  const [manifest, setManifest] = useState<AudioManifest | null>(null);
  const [edition, setEdition] = useState<AudioEdition | null>(null);
  const [chapterIndex, setChapterIndex] = useState(1);
  const [stream, setStream] = useState<AudioStream | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [rate, setRate] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingStream, setLoadingStream] = useState(false);
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const positionRef = useRef(0);
  const chapterRef = useRef(1);
  const rateRef = useRef(1);
  const lastSaveRef = useRef(0);
  const playAfterLoadRef = useRef(false);
  const retryRef = useRef(0);

  const chapter = edition?.chapters.find((item) => item.index === chapterIndex) ?? null;
  const chapterDuration = Math.max(1, chapter?.durationSeconds ?? stream?.durationSeconds ?? 0);
  const chapterStart = stream?.startSeconds ?? chapter?.startSeconds ?? 0;
  const chapterEnd =
    stream?.endSeconds ?? chapter?.endSeconds ?? chapterStart + chapterDuration;
  const nextChapter = edition
    ? edition.chapters.find((item) => item.index > chapterIndex) ?? null
    : null;
  const previousChapter = edition
    ? [...edition.chapters].reverse().find((item) => item.index < chapterIndex) ?? null
    : null;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fetchAudioManifest(bookKey)
      .then((data) => {
        if (!alive) return;
        setManifest(data);
        const first = data.editions[0] ?? null;
        setEdition(first);
        if (!first) {
          setLoading(false);
          return;
        }
        void restoreProgress(first);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Não foi possível abrir o audiolivro.");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey]);

  useEffect(() => {
    function leave() {
      persist();
    }
    function visibility() {
      if (document.visibilityState === "hidden") persist();
    }
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", visibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edition, session]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    audio.src = stream.url;
    audio.playbackRate = rateRef.current;
    retryRef.current = 0;
    const onLoaded = () => {
      const start = stream.startSeconds ?? 0;
      const end = stream.endSeconds ?? start + stream.durationSeconds;
      audio.currentTime = Math.min(start + positionRef.current, end);
      if (playAfterLoadRef.current) {
        playAfterLoadRef.current = false;
        void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    };
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => audio.removeEventListener("loadedmetadata", onLoaded);
  }, [stream]);

  async function restoreProgress(target: AudioEdition) {
    const local = readLocal(target.id);
    let remote: AudioProgress | null = null;
    if (session) {
      try {
        remote = await fetchAudioProgress(session, target.id);
      } catch {
        remote = null;
      }
    }
    const remoteTime = remote?.updatedAt ? Date.parse(remote.updatedAt) : 0;
    const localTime = local?.updatedAt ?? 0;
    const best = local && localTime >= remoteTime ? local : remote;
    const fallback = target.chapters[0]?.index ?? 1;
    const validIndex =
      best && target.chapters.some((item) => item.index === best.chapterIndex)
        ? best.chapterIndex
        : fallback;
    const validChapter = target.chapters.find((item) => item.index === validIndex) ?? target.chapters[0];
    const max = Math.max(1, validChapter?.durationSeconds ?? 1);
    const seek = best ? Math.min(Math.max(0, best.positionSeconds), max) : 0;
    const savedRate =
      best && best.playbackRate >= 0.5 && best.playbackRate <= 2 ? best.playbackRate : 1;
    setRate(savedRate);
    rateRef.current = savedRate;
    await loadChapter(target, validIndex, seek, false);
    setLoading(false);
  }

  function stopAudio() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    setPlaying(false);
  }

  async function loadChapter(
    target: AudioEdition,
    index: number,
    seek: number,
    autoplay: boolean,
  ) {
    const selected = target.chapters.find((item) => item.index === index);
    if (!selected) return;
    audioRef.current?.pause();
    if (!selected.free && !session) {
      stopAudio();
      setChapterIndex(index);
      chapterRef.current = index;
      setStream(null);
      setPosition(0);
      positionRef.current = 0;
      setError("Entre na sua conta para ouvir os demais capítulos.");
      return;
    }
    setLoadingStream(true);
    setError("");
    try {
      const data = await fetchAudioStream(
        bookKey,
        target.id,
        index,
        selected.free ? undefined : session?.access_token,
      );
      setStream(data);
      setChapterIndex(index);
      chapterRef.current = index;
      const max = Math.max(1, data.durationSeconds || selected.durationSeconds);
      const relative = Math.min(Math.max(0, seek), max);
      setPosition(relative);
      positionRef.current = relative;
      playAfterLoadRef.current = autoplay;
    } catch (err: unknown) {
      stopAudio();
      setStream(null);
      if (err instanceof AuthSessionError) {
        setError("Entre na sua conta para ouvir este capítulo.");
      } else if (err instanceof ApiHttpError && err.status === 402) {
        setError("Assinatura necessária para ouvir este capítulo.");
      } else {
        setError(err instanceof Error ? err.message : "Não foi possível carregar o áudio.");
      }
    } finally {
      setLoadingStream(false);
    }
  }

  function persist(value = positionRef.current, completed = false) {
    if (!edition) return;
    const data = {
      chapterIndex: chapterRef.current,
      positionSeconds: Math.max(0, Math.round(value)),
      playbackRate: rateRef.current,
      completed,
    };
    writeLocal(edition.id, { ...data, updatedAt: Date.now() });
    if (session) {
      void saveAudioProgress(session, edition.id, data).catch(() => undefined);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
      persist();
    }
  }

  function seekBy(delta: number) {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    const next = Math.min(Math.max(chapterStart, audio.currentTime + delta), chapterEnd);
    audio.currentTime = next;
    const relative = next - chapterStart;
    setPosition(relative);
    positionRef.current = relative;
    persist(relative);
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    const next = Math.min(Math.max(0, value), chapterDuration);
    audio.currentTime = chapterStart + next;
    setPosition(next);
    positionRef.current = next;
  }

  function changeRate(value: number) {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = value;
    setRate(value);
    rateRef.current = value;
    persist();
  }

  function selectChapter(index: number) {
    if (!edition) return;
    const wasPlaying = playing;
    void loadChapter(edition, index, 0, wasPlaying);
  }

  function goChapter(delta: number) {
    if (!edition) return;
    const current = edition.chapters.findIndex((item) => item.index === chapterIndex);
    if (current < 0) return;
    const target = edition.chapters[current + delta];
    if (target) selectChapter(target.index);
  }

  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || !stream) return;
    if (audio.currentTime >= chapterEnd - 0.15) {
      if (nextChapter) {
        void loadChapter(edition!, nextChapter.index, 0, true);
      } else {
        audio.pause();
        setPlaying(false);
        persist(chapterDuration, true);
      }
      return;
    }
    const relative = Math.max(0, Math.min(audio.currentTime - chapterStart, chapterDuration));
    setPosition(relative);
    positionRef.current = relative;
    const now = Date.now();
    if (now - lastSaveRef.current > 5000) {
      lastSaveRef.current = now;
      persist(relative);
    }
  }

  function handleEnded() {
    if (nextChapter) {
      void loadChapter(edition!, nextChapter.index, 0, true);
    } else {
      setPlaying(false);
      persist(chapterDuration, true);
    }
  }

  if (loading) {
    return (
      <div className="page-status">
        <span className="spinner" aria-hidden="true" />
        Carregando audiolivro…
      </div>
    );
  }

  if (!manifest || !edition) {
    return (
      <div className="home">
        <nav className="home-nav profile-nav">
          <Link className="btn" to="/ouvir">
            Voltar
          </Link>
        </nav>
        <section className="shelf">
          <p className="auth-error" role="alert">
            {error || "Este livro ainda não tem audiolivro publicado."}
          </p>
        </section>
      </div>
    );
  }

  const cover = edition.coverUrl ?? manifest.book.coverUrl;
  const editionMeta = [
    edition.narrator ? `Narração: ${edition.narrator}` : null,
    formatAudioDuration(edition.totalDurationSeconds),
    `${edition.chapters.length} capítulo${edition.chapters.length === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to={`/biblioteca/${encodeURIComponent(bookKey)}`}>
          Voltar ao livro
        </Link>
      </nav>

      <section className="shelf audiobook-page">
        <div className="audiobook-layout">
          <div className="audiobook-cover">
            {cover ? <img src={cover} alt="" /> : <span>{manifest.book.title}</span>}
          </div>

          <div className="audiobook-main">
            <span className="eyebrow">Audiolivro</span>
            <h1>{manifest.book.title}</h1>
            <p className="audiobook-author">{manifest.book.author || "Autor não informado"}</p>
            <div className="audiobook-meta">
              {editionMeta.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            {edition.licenseNote ? (
              <p className="audiobook-license">{edition.licenseNote}</p>
            ) : null}

            <div className="audiobook-player">
              <div className="audiobook-now">
                <strong>{chapter?.title || `Capítulo ${chapterIndex}`}</strong>
                <span>
                  {formatAudioClock(position)} / {formatAudioClock(chapterDuration)}
                </span>
              </div>

              <input
                className="audiobook-progress"
                type="range"
                min={0}
                max={chapterDuration}
                step={1}
                value={Math.min(position, chapterDuration)}
                onChange={(event) => seekTo(Number(event.target.value))}
                aria-label="Posição do capítulo"
              />

              <div className="audiobook-controls">
                <button
                  type="button"
                  className="btn"
                  onClick={() => goChapter(-1)}
                  disabled={!previousChapter}
                  aria-label="Capítulo anterior"
                >
                  ⏮
                </button>
                <button type="button" className="btn" onClick={() => seekBy(-15)}>
                  −15s
                </button>
                <button
                  type="button"
                  className="btn btn-primary audiobook-play"
                  onClick={togglePlay}
                  disabled={loadingStream || !stream}
                >
                  {loadingStream ? "Carregando…" : playing ? "Pausar" : "Ouvir"}
                </button>
                <button type="button" className="btn" onClick={() => seekBy(15)}>
                  +15s
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => goChapter(1)}
                  disabled={!nextChapter}
                  aria-label="Próximo capítulo"
                >
                  ⏭
                </button>
                <label className="audiobook-rate">
                  Velocidade
                  <select value={rate} onChange={(event) => changeRate(Number(event.target.value))}>
                    {RATES.map((value) => (
                      <option key={value} value={value}>
                        {value}×
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              {!session && chapterIndex >= 2 ? (
                <p className="muted audiobook-note">
                  Entre na sua conta para ouvir os capítulos depois do primeiro.
                </p>
              ) : null}
            </div>

            <div className="audiobook-chapters">
              <h2>Capítulos</h2>
              {edition.chapters.map((item) => (
                <button
                  key={item.index}
                  type="button"
                  className={`audiobook-chapter ${item.index === chapterIndex ? "is-on" : ""}`}
                  onClick={() => selectChapter(item.index)}
                >
                  <span className="audiobook-chapter-number">{item.index}</span>
                  <span className="audiobook-chapter-title">
                    <strong>{item.title || `Capítulo ${item.index}`}</strong>
                    <small>
                      {formatAudioDuration(item.durationSeconds)}
                      {!item.free ? " · assinantes" : ""}
                    </small>
                  </span>
                  <span className="audiobook-chapter-time">
                    {formatAudioClock(item.startSeconds)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <audio
          ref={audioRef}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setPlaying(true)}
          onPause={() => {
            setPlaying(false);
            persist();
          }}
          onEnded={handleEnded}
          className="audiobook-audio"
        />
      </section>
    </div>
  );
}
