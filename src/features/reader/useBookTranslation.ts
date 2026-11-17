import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { Ebook } from "../../data/types";
import type { ReadingPrefs } from "../../lib/readingPrefs";
import {
  cachedTranslation,
  chunkRanges,
  detectTranslationEngine,
  grantRemoteTranslationConsent,
  hasRemoteTranslationConsent,
  storeTranslation,
  translateParagraphs,
  warmUpLocalTranslator,
  type TranslationEngine,
} from "../../lib/translate";
import type { Block } from "./bookText";

/** Capítulo sem tradução carregada: a mesma referência sempre, para não refazer o texto da tela. */
const NO_TRANSLATIONS: Record<number, (string | null)[]> = {};

/** Tradução dos livros em inglês: trecho a trecho, conforme o leitor avança. */
export function useBookTranslation({
  book,
  blocks,
  chapterIndex,
  chapterKey,
  chapterKeyRef,
  loaded,
  visibleChunk,
  prefs,
  setPrefs,
}: {
  book: Ebook | null;
  /** Parágrafos do capítulo na tela. */
  blocks: Block[];
  chapterIndex: number;
  /** Livro + capítulo na tela: resultados de outro capítulo são descartados. */
  chapterKey: string;
  chapterKeyRef: RefObject<string>;
  /** Livro carregado. */
  loaded: boolean;
  /** Trecho de tradução no topo da tela, medido junto com a rolagem. */
  visibleChunk: { key: string; chunk: number } | null;
  prefs: ReadingPrefs;
  setPrefs: Dispatch<SetStateAction<ReadingPrefs>>;
}) {
  const [engine, setEngine] = useState<TranslationEngine>("google");
  useEffect(() => {
    let alive = true;
    void detectTranslationEngine().then((e) => alive && setEngine(e));
    return () => {
      alive = false;
    };
  }, []);
  const canTranslate = book?.textLanguage === "en";
  // Livros locais/importados podem ser privados: o tradutor remoto só roda com consentimento.
  const [translateConsent, setTranslateConsent] = useState(() => hasRemoteTranslationConsent());
  const remoteTranslationNeedsConsent =
    book?.source === "local" && engine !== "local" && !translateConsent;
  const translateOn = canTranslate && prefs.translate && !remoteTranslationNeedsConsent;
  const chunks = useMemo(() => chunkRanges(blocks.map((b) => b.text)), [blocks]);
  /** Traduções do capítulo; `chunks` diz para quais trechos o guardado no aparelho já foi carregado. */
  const [translated, setTranslated] = useState<{
    key: string;
    chunks: [number, number][] | null;
    byChunk: Record<number, (string | null)[]>;
  }>({ key: "", chunks: null, byChunk: {} });
  const translations = useMemo(
    () => (translated.key === chapterKey ? translated.byChunk : NO_TRANSLATIONS),
    [translated, chapterKey],
  );
  const [translatingChunk, setTranslatingChunk] = useState<number | null>(null);
  const [failedChunks, setFailedChunks] = useState<number[]>([]);

  async function toggleTranslation() {
    const active = prefs.translate && !remoteTranslationNeedsConsent;
    if (active) {
      setPrefs((p) => ({ ...p, translate: false }));
      return;
    }
    const detected = await detectTranslationEngine();
    if (detected !== "local" && book?.source === "local" && !hasRemoteTranslationConsent()) {
      const ok = window.confirm(
        "Para traduzir este livro local, trechos do texto serão enviados ao Google Tradutor/MyMemory. " +
          "Se o livro for privado, cancele e use o tradutor do próprio navegador quando disponível. Continuar?",
      );
      if (!ok) {
        setPrefs((p) => ({ ...p, translate: false }));
        return;
      }
      grantRemoteTranslationConsent();
    }
    if (detected === "local") {
      warmUpLocalTranslator();
      setEngine("local");
      setTranslateConsent(true);
    } else if (hasRemoteTranslationConsent()) {
      setTranslateConsent(true);
    }
    setPrefs((p) => ({ ...p, translate: true }));
  }

  /** Troca de capítulo: começa com o que já foi traduzido antes e está guardado. */
  useEffect(() => {
    const cached: Record<number, (string | null)[]> = {};
    if (book && canTranslate) {
      chunks.forEach((_, c) => {
        const t = cachedTranslation(book.gutenbergId, chapterIndex, c);
        if (t) cached[c] = t;
      });
    }
    setTranslated({ key: chapterKeyRef.current, chunks, byChunk: cached });
    setTranslatingChunk(null);
    setFailedChunks([]);
  }, [book, canTranslate, chapterIndex, chunks, chapterKeyRef]);

  /** Traduz o trecho visível e o seguinte, um pedido por vez. */
  useEffect(() => {
    if (!book || !translateOn || !loaded || translatingChunk !== null) return;
    // Espera o capítulo carregar o que está guardado e a rolagem ser medida.
    if (translated.key !== chapterKey || visibleChunk?.key !== chapterKey) return;
    const c = [visibleChunk.chunk, visibleChunk.chunk + 1].find(
      (n) => n < chunks.length && !translations[n] && !failedChunks.includes(n),
    );
    if (c === undefined) return;
    const key = chapterKey;
    const [start, end] = chunks[c];
    // Espera a rolagem parar: quem passa correndo pelo capítulo não dispara um pedido por trecho.
    const t = setTimeout(() => {
      setTranslatingChunk(c);
      // Ilustrações não têm o que traduzir.
      translateParagraphs(
        engine,
        blocks.slice(start, end).map((b) => (b.kind === "image" ? "" : b.text)),
        book.source !== "local" || translateConsent,
      )
        .then((result) => {
          storeTranslation(book.gutenbergId, chapterIndex, c, result);
          if (chapterKeyRef.current === key) {
            setTranslated((prev) => ({ ...prev, key, byChunk: { ...prev.byChunk, [c]: result } }));
          }
        })
        .catch((err) => {
          console.warn("Falha na tradução:", err);
          if (chapterKeyRef.current === key) setFailedChunks((prev) => [...prev, c]);
        })
        .finally(() => {
          if (chapterKeyRef.current === key) setTranslatingChunk(null);
        });
    }, 700);
    return () => clearTimeout(t);
  }, [
    engine,
    book,
    translateOn,
    translateConsent,
    loaded,
    translatingChunk,
    visibleChunk,
    chunks,
    translated,
    translations,
    failedChunks,
    chapterKey,
    chapterKeyRef,
    chapterIndex,
    blocks,
  ]);

  const chunkOfBlock = useMemo(() => {
    const map: number[] = [];
    chunks.forEach(([start, end], c) => {
      for (let i = start; i < end; i++) map[i] = c;
    });
    return map;
  }, [chunks]);

  /** Texto na tela de cada parágrafo: a tradução, quando ligada e pronta, ou o original. */
  const shownTexts = useMemo(
    () =>
      blocks.map((b, i) => {
        // Ilustração: sem texto (a voz pula, a tradução ignora).
        if (b.kind === "image") return "";
        const c = chunkOfBlock[i];
        return (translateOn ? translations[c]?.[i - chunks[c][0]] : null) ?? b.text;
      }),
    [blocks, chunkOfBlock, chunks, translateOn, translations],
  );
  /** Idioma do parágrafo na tela (para a voz e o dicionário). */
  const blockLanguage = (i: number): "pt" | "en" => {
    if (!book) return "pt";
    const c = chunkOfBlock[i];
    const translatedNow = translateOn && translations[c]?.[i - (chunks[c]?.[0] ?? 0)];
    return translatedNow ? "pt" : book.textLanguage;
  };

  return {
    engine,
    canTranslate,
    translateOn,
    chunks,
    chunkOfBlock,
    translations,
    /** Para quais trechos o guardado no aparelho já foi carregado (igual a `chunks` quando pronto). */
    translatedChunks: translated.chunks,
    translatingChunk,
    failedChunks,
    setFailedChunks,
    toggleTranslation,
    shownTexts,
    blockLanguage,
  };
}

export type BookTranslationState = ReturnType<typeof useBookTranslation>;
