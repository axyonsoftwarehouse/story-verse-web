import type { StoryChapter } from "../../lib/chapters";
import { Icon } from "../../components/Icon";
import { coarsePointer } from "../../lib/coarsePointer";

/** Menu do trecho selecionado: destacar, perguntar, significado, compartilhar. */
export function SelectionToolbar({
  addHighlight,
  clearSelection,
  currentChapter,
  selection,
  shareQuote,
  showMeaning,
}: {
  addHighlight: () => void;
  clearSelection: () => void;
  currentChapter: StoryChapter;
  selection: {
    text: string;
    parts: { block: number; text: string }[];
    block: number;
    x: number;
    top: number;
    bottom: number;
    word: string | null;
  };
  shareQuote: (text: string, chapterLabel?: string) => void;
  showMeaning: () => void;
}) {
  return (
    <div
      className="sel-toolbar"
      role="toolbar"
      aria-label="Ações do trecho selecionado"
      style={{
        // Metade da largura do menu (~180 px) + margem, para não sair da tela.
        left: Math.min(Math.max(selection.x, 190), window.innerWidth - 190),
        top: coarsePointer() || selection.top < 90 ? selection.bottom + 12 : selection.top - 54,
      }}
      // Clicar no menu não pode desfazer a seleção antes do clique.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => e.preventDefault()}
    >
      <button type="button" onClick={addHighlight}>
        {Icon.bookmark} Marcar
      </button>
      {selection.word ? (
        <button type="button" onClick={showMeaning}>
          {Icon.book} Significado
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          const text = selection.text;
          clearSelection();
          shareQuote(text, currentChapter?.label);
        }}
      >
        {Icon.share} Compartilhar
      </button>
    </div>
  );
}
