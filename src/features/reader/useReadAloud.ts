import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Ebook } from "../../data/types";
import {
  dismissNaturalOffer,
  downloadNaturalVoice,
  naturalOfferDismissed,
  naturalVoicesFor,
  naturalVoiceSupported,
  naturalVoiceUri,
  storedNaturalVoices,
} from "../../lib/naturalVoice";
import {
  listVoices,
  saveRate,
  savedRate,
  savedVoiceUri,
  saveVoiceUri,
  speakParagraphs,
  speakSample,
  speechSupported,
  type SpeechSession,
  type VoiceOption,
} from "../../lib/speech";
import type { Block } from "./bookText";

/**
 * Leitura em voz alta do capítulo: voz e velocidade, vozes naturais para baixar, o parágrafo
 * sendo lido e a passagem automática para o próximo capítulo.
 */
export function useReadAloud({
  book,
  loaded,
  blocks,
  chunks,
  translatedChunks,
  translateOn,
  shownTexts,
  chapterIndex,
  chapterCount,
  setChapterIndex,
  readRef,
  lastActivityRef,
}: {
  book: Ebook | null;
  /** Livro carregado. */
  loaded: boolean;
  blocks: Block[];
  /** Trechos de tradução do capítulo e quais já vieram do aparelho (a voz espera por eles). */
  chunks: [number, number][];
  translatedChunks: [number, number][] | null;
  translateOn: boolean;
  /** Texto de cada parágrafo como está na tela (traduzido ou não). */
  shownTexts: string[];
  chapterIndex: number;
  chapterCount: number;
  setChapterIndex: Dispatch<SetStateAction<number>>;
  /** Área do texto: a voz rola até o parágrafo lido. */
  readRef: RefObject<HTMLDivElement | null>;
  /** Última interação no leitor (a voz lendo também conta). */
  lastActivityRef: RefObject<number>;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [speakingBlock, setSpeakingBlock] = useState<number | null>(null);
  const [speechRate, setSpeechRate] = useState(savedRate);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceUri, setVoiceUri] = useState<string | undefined>(undefined);
  const speechRef = useRef<SpeechSession | null>(null);
  /** A voz chegou ao fim do capítulo e segue no próximo. */
  const continueSpeechRef = useRef(false);

  const stopSpeaking = useCallback(() => {
    speechRef.current?.stop();
    speechRef.current = null;
    continueSpeechRef.current = false;
    setSpeaking(false);
    setSpeakingBlock(null);
    setVoicePanelOpen(false);
  }, []);

  /** A voz para ao sair do livro ou fechar a página. */
  useEffect(() => () => speechRef.current?.stop(), []);

  const canSpeak = speechSupported();
  const speakLang: "pt" | "en" = !book ? "pt" : translateOn ? "pt" : book.textLanguage;

  /** Vozes naturais (Piper) do idioma já baixadas (null = conferindo), a que está baixando e a que falhou. */
  const [storedNatural, setStoredNatural] = useState<string[] | null>(null);
  const [naturalDownload, setNaturalDownload] = useState<{ id: string; pct: number } | null>(null);
  const [naturalError, setNaturalError] = useState<string | null>(null);
  useEffect(() => {
    if (!voicePanelOpen || !naturalVoiceSupported()) return;
    let alive = true;
    setStoredNatural(null);
    void storedNaturalVoices(speakLang).then((ids) => {
      if (alive) setStoredNatural(ids);
    });
    return () => {
      alive = false;
    };
  }, [voicePanelOpen, speakLang]);
  const missingNatural = storedNatural
    ? naturalVoicesFor(speakLang).filter((v) => !storedNatural.includes(v.id))
    : [];

  /** Começa a ler e, enquanto a voz natural não foi baixada (nem recusada), já mostra a oferta. */
  function listenAloud() {
    startSpeaking(firstVisibleBlock());
    if (!naturalVoiceSupported() || naturalOfferDismissed()) return;
    void storedNaturalVoices(speakLang).then((ids) => {
      if (ids.length === 0) setVoicePanelOpen(true);
    });
  }

  function declineNaturalVoice() {
    dismissNaturalOffer();
    setVoicePanelOpen(false);
  }

  async function getNaturalVoice(id: string) {
    const lang = speakLang;
    setNaturalDownload({ id, pct: 0 });
    setNaturalError(null);
    try {
      await downloadNaturalVoice(id, (pct) => setNaturalDownload({ id, pct }));
      setStoredNatural(await storedNaturalVoices(lang));
      setVoices(await listVoices(lang));
      chooseVoice(naturalVoiceUri(id));
    } catch (e) {
      console.warn("Falha ao baixar a voz natural:", e);
      setNaturalError(id);
    } finally {
      setNaturalDownload(null);
    }
  }

  useEffect(() => {
    if (!voicePanelOpen) return;
    let alive = true;
    void listVoices(speakLang).then((list) => {
      if (!alive) return;
      setVoices(list);
      const saved = savedVoiceUri(speakLang);
      setVoiceUri(list.some((v) => v.uri === saved) ? saved : list[0]?.uri);
    });
    return () => {
      alive = false;
    };
  }, [voicePanelOpen, speakLang]);

  function chooseVoice(uri: string) {
    setVoiceUri(uri);
    saveVoiceUri(speakLang, uri);
    if (speaking) startSpeaking(speakingBlock ?? firstVisibleBlock());
    else speakSample(uri, speakLang, speechRate);
  }

  function chooseRate(rate: number) {
    setSpeechRate(rate);
    saveRate(rate);
    if (speaking) startSpeaking(speakingBlock ?? firstVisibleBlock(), rate);
  }

  function firstVisibleBlock(): number {
    const el = readRef.current;
    if (!el) return 0;
    const top = el.getBoundingClientRect().top;
    const els = Array.from(el.querySelectorAll<HTMLElement>("[data-block]"));
    const first = els.find((b) => b.getBoundingClientRect().bottom > top + 8);
    return first ? Number(first.dataset.block) : 0;
  }

  function startSpeaking(from: number, rate = speechRate) {
    if (!book) return;
    speechRef.current?.stop();
    const lang = speakLang;
    const hasNext = chapterIndex < chapterCount - 1;
    setSpeaking(true);
    speechRef.current = speakParagraphs(
      shownTexts,
      from,
      lang,
      rate,
      (i) => {
        setSpeakingBlock(i);
        lastActivityRef.current = Date.now();
        const target = readRef.current?.querySelector<HTMLElement>(`[data-block="${i}"]`);
        const page = readRef.current;
        if (target && page) {
          const r = target.getBoundingClientRect();
          const pr = page.getBoundingClientRect();
          if (r.top < pr.top + 40 || r.bottom > pr.bottom - 40)
            target.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      },
      () => {
        speechRef.current = null;
        if (hasNext) {
          // Fim do capítulo: continua lendo o próximo.
          continueSpeechRef.current = true;
          setChapterIndex((n) => n + 1);
        } else {
          setSpeaking(false);
          setSpeakingBlock(null);
        }
      },
    );
  }

  /** Troca de capítulo pelo leitor (não pela voz) ou tradução ligada/desligada: a voz para. */
  useEffect(() => {
    if (!continueSpeechRef.current) stopSpeaking();
  }, [chapterIndex, translateOn, stopSpeaking]);

  /** Lê do começo com o texto mais recente na tela (não o do render em que o efeito foi marcado). */
  const continueSpeaking = useEffectEvent(() => startSpeaking(0));
  /**
   * A voz terminou um capítulo: quando o próximo estiver na tela, continua do começo. Com a
   * tradução ligada, espera as traduções guardadas do capítulo entrarem; senão a voz em português
   * começaria pelo texto original.
   */
  const chapterTextReady =
    loaded && blocks.length > 0 && (!translateOn || translatedChunks === chunks);
  useEffect(() => {
    if (!continueSpeechRef.current || !chapterTextReady) return;
    const frame = requestAnimationFrame(() => {
      continueSpeechRef.current = false;
      continueSpeaking();
    });
    return () => cancelAnimationFrame(frame);
  }, [chapterTextReady, blocks, translatedChunks]);

  /** Há uma leitura em andamento (conta como leitor presente). */
  const isSpeaking = useCallback(() => speechRef.current !== null, []);

  return {
    canSpeak,
    speaking,
    speakingBlock,
    speechRate,
    voicePanelOpen,
    setVoicePanelOpen,
    voices,
    voiceUri,
    storedNatural,
    naturalDownload,
    naturalError,
    missingNatural,
    listenAloud,
    declineNaturalVoice,
    getNaturalVoice,
    chooseVoice,
    chooseRate,
    stopSpeaking,
    isSpeaking,
  };
}

export type ReadAloudState = ReturnType<typeof useReadAloud>;
