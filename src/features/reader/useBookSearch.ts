import {
  useDeferredValue,
  useMemo,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import type { StoryChapter } from "../../lib/chapters";
import { searchBook, toBlocks, type BookSearchHit } from "./bookText";

/** Buscar no livro: palavra ou nome em todos os capítulos, com o trecho e o salto até lá. */
export function useBookSearch({
  chapters,
  chapterIndex,
  setChapterIndex,
  jumpToBlockRef,
  scrollToBlock,
}: {
  chapters: StoryChapter[];
  chapterIndex: number;
  setChapterIndex: Dispatch<SetStateAction<number>>;
  /** Parágrafo a mostrar quando o outro capítulo abrir. */
  jumpToBlockRef: RefObject<number | null>;
  scrollToBlock: (i: number) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const deferredTerm = useDeferredValue(searchTerm);
  const bookBlocks = useMemo(
    () => (searchOpen ? chapters.map((ch) => toBlocks(ch.body, ch.label)) : []),
    [searchOpen, chapters],
  );
  const searchResults = useMemo(
    () => searchBook(bookBlocks, chapters, deferredTerm),
    [bookBlocks, chapters, deferredTerm],
  );
  function openSearchResult(r: BookSearchHit) {
    setSearchOpen(false);
    if (r.chapterIndex === chapterIndex) {
      requestAnimationFrame(() => scrollToBlock(r.paragraph));
    } else {
      jumpToBlockRef.current = r.paragraph;
      setChapterIndex(r.chapterIndex);
    }
  }

  return {
    searchOpen,
    setSearchOpen,
    searchTerm,
    setSearchTerm,
    deferredTerm,
    searchResults,
    openSearchResult,
  };
}

export type BookSearchState = ReturnType<typeof useBookSearch>;
