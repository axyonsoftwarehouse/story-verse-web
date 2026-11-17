import type { Dispatch, SetStateAction } from "react";
import { Icon } from "../../components/Icon";
import { type WordInfo } from "../../lib/dictionary";

/** Significado da palavra tocada no texto. */
export function WordCard({
  setWordCard,
  wordCard,
}: {
  setWordCard: Dispatch<
    SetStateAction<{ word: string; x: number; y: number; info: WordInfo | null } | null>
  >;
  wordCard: { word: string; x: number; y: number; info: WordInfo | null };
}) {
  return (
    <div
      className="word-card"
      role="dialog"
      aria-label={`Significado de ${wordCard.word}`}
      style={{
        left: Math.min(Math.max(wordCard.x, 176), window.innerWidth - 176),
        top: Math.min(wordCard.y + 12, window.innerHeight - 240),
      }}
    >
      <div className="word-card-head">
        <strong>{wordCard.word}</strong>
        {wordCard.info?.kind ? <em>{wordCard.info.kind}</em> : null}
        <button
          type="button"
          className="icon-btn"
          onClick={() => setWordCard(null)}
          aria-label="Fechar"
        >
          {Icon.close}
        </button>
      </div>
      {!wordCard.info ? (
        <p className="word-card-muted">Procurando…</p>
      ) : (
        <>
          {wordCard.info.translation ? (
            <p className="word-card-translation">
              <span>Em português:</span> {wordCard.info.translation}
            </p>
          ) : null}
          {wordCard.info.definitions.length > 0 ? (
            <ol>
              {wordCard.info.definitions.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ol>
          ) : !wordCard.info.translation ? (
            <p className="word-card-muted">Não encontramos esta palavra no dicionário.</p>
          ) : null}
          {wordCard.info.source ? (
            <a
              className="word-card-source"
              href={wordCard.info.source.url}
              target="_blank"
              rel="noreferrer"
            >
              {wordCard.info.source.label} ↗
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}
