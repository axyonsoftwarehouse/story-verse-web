import { useState } from "react";
import type { Ebook } from "../../data/types";

type CoverBook = Pick<Ebook, "title" | "author" | "genre" | "coverUrl">;

/** Capa do catálogo: usa a imagem do livro e, sem ela (ou se falhar), desenha a capa tipográfica. */
export function CatalogCover({ book }: { book: CoverBook }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="cover catalog-cover">
      {book.coverUrl && !failed ? (
        <img
          className="cover-photo is-loaded"
          src={book.coverUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : null}
      <div className="cover-frame">
        {book.genre ? <span className="cover-genre">{book.genre}</span> : null}
        <span className="cover-title">{book.title}</span>
        <span className="cover-ornament" aria-hidden="true">
          ✦
        </span>
        <span className="cover-author">{book.author}</span>
      </div>
    </div>
  );
}
