import { PrivacyNote } from "../../components/PrivacyNote";
import { useEffect, useState } from "react";
import { Icon } from "../../components/Icon";
import { suggestedBooks } from "../../data/ebooks";
import type { Ebook } from "../../data/types";
import {
  isNewCommunityBook,
  matchesCommunitySearch,
  newBookLabel,
  normalizeText,
} from "../../lib/community";
import { searchBooks, type SearchLanguage } from "../../lib/gutenberg";
import { searchOutsideCatalog, type BookHint } from "../../lib/openLibrary";
import { BookCover } from "../../components/BookCover";

export function LangBadge({ book }: { book: Ebook }) {
  return (
    <span className={`lang-badge lang-${book.textLanguage}`}>
      {book.textLanguage === "pt" ? "Em português" : "Texto em inglês"}
    </span>
  );
}

const LANGUAGE_FILTERS: { id: SearchLanguage; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "pt", label: "Português" },
  { id: "en", label: "Inglês" },
];

/** Busca no acervo inteiro do Project Gutenberg; sem busca, mostra sugestões prontas. */
export function Explore({
  onOpen,
  onImport,
  communityBooks = [],
}: {
  /** Aprovados do acervo da comunidade: entram na busca e têm filtro próprio. */
  communityBooks?: Ebook[];
  onOpen: (b: Ebook) => void;
  /** Abre o formulário de importação; com `hint`, já preenchido com o livro escolhido. */
  onImport: (hint?: BookHint) => void;
}) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<SearchLanguage>("pt");
  /** "community": só os livros enviados pela comunidade. */
  const [origin, setOrigin] = useState<"all" | "community">("all");
  const [books, setBooks] = useState<Ebook[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [slow, setSlow] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const term = query.trim();
  const searching = term.length >= 2;

  /** Livros famosos fora do acervo (Open Library), buscados junto com o Gutenberg. */
  const [outside, setOutside] = useState<BookHint[]>([]);
  useEffect(() => {
    setOutside([]);
    if (!searching) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchOutsideCatalog(term)
        .then((hints) => !cancelled && setOutside(hints))
        .catch(() => undefined); // Sem a Open Library, a busca do acervo continua normal.
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, searching]);

  useEffect(() => {
    if (!searching) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setSlow(false);
    const slowTimer = setTimeout(() => !cancelled && setSlow(true), 5000);
    const t = setTimeout(() => {
      searchBooks(term, language)
        .then((page) => {
          if (cancelled) return;
          setBooks(page.books);
          setTotal(page.total);
          setNext(page.next);
          setStatus("ready");
        })
        .catch(() => !cancelled && setStatus("error"))
        .finally(() => clearTimeout(slowTimer));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
      clearTimeout(slowTimer);
    };
  }, [term, searching, language]);

  const loadMore = () => {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    searchBooks(term, language, next)
      .then((page) => {
        setBooks((prev) => [...prev, ...page.books]);
        setNext(page.next);
      })
      .catch(() => setNext(null))
      .finally(() => setLoadingMore(false));
  };

  const communityTitles = new Set(communityBooks.map((b) => normalizeText(b.title)));
  const shown = searching
    ? books
    : suggestedBooks.filter(
        (b) =>
          (language === "all" || b.textLanguage === language) &&
          !communityTitles.has(normalizeText(b.title)),
      );

  const communityShown = communityBooks.filter(
    (b) =>
      (language === "all" || b.textLanguage === language) &&
      (!searching || matchesCommunitySearch(b, term)),
  );
  const onlyCommunity = origin === "community";
  const communityGrid = (list: Ebook[]) => (
    <div className="result-grid">
      {list.map((b) => (
        <button key={b.id} type="button" className="result" onClick={() => onOpen(b)}>
          {isNewCommunityBook(b) ? <span className="new-badge">{newBookLabel(b)}</span> : null}
          <BookCover book={b} />
          <strong>{b.title}</strong>
          <span>
            {b.author}
            {b.textLanguage === "pt" ? " · PT" : ""}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <section className="explore" id="acervo">
      <div className="shelf-head">
        <h2>Explorar o acervo</h2>
        <p>Mais de 70 mil livros em domínio público, direto do Project Gutenberg.</p>
      </div>

      <div className="explore-controls">
        <label className="search-box">
          {Icon.search}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busque por título ou autor, como Verne, Poe ou Austen"
            aria-label="Buscar livros"
          />
        </label>
        <PrivacyNote
          details={
            <>
              O Storyverse não guarda o que você busca nem mostra para ninguém. O termo vai, por
              conexão criptografada (HTTPS), só até os catálogos de livros para trazer os
              resultados. Veja tudo em Perfil › Ajustes › Privacidade.
            </>
          }
        >
          Suas buscas são privadas e não ficam salvas.
        </PrivacyNote>
        <div className="filter-pills" role="group" aria-label="Idioma do texto">
          {LANGUAGE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`filter-pill ${language === f.id ? "active" : ""}`}
              onClick={() => setLanguage(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {communityBooks.length > 0 ? (
          <div className="filter-pills" role="group" aria-label="Origem dos livros">
            <button
              type="button"
              className={`filter-pill ${origin === "all" ? "active" : ""}`}
              onClick={() => setOrigin("all")}
            >
              Todo o acervo
            </button>
            <button
              type="button"
              className={`filter-pill ${origin === "community" ? "active" : ""}`}
              onClick={() => setOrigin("community")}
            >
              Da comunidade
            </button>
          </div>
        ) : null}
      </div>

      {onlyCommunity ? (
        <>
          <p className="explore-note">
            {communityShown.length === 0
              ? searching
                ? `Nenhum livro da comunidade para “${term}”.`
                : "Nenhum livro da comunidade neste idioma ainda."
              : searching
                ? `${communityShown.length} ${communityShown.length === 1 ? "livro" : "livros"} da comunidade para “${term}”`
                : "Livros enviados por leitores e aprovados pela curadoria."}
          </p>
          {communityShown.length > 0 ? communityGrid(communityShown) : null}
        </>
      ) : null}

      {/* Em "Todo o acervo", os da comunidade só entram no topo quando há busca: sem busca, a estante
          "Da comunidade" logo acima já mostra os mesmos livros (U2). */}
      {!onlyCommunity && searching && communityShown.length > 0 ? (
        <div className="explore-community">
          <div className="explore-community-head">
            <h3>Da comunidade</h3>
            <p>Enviados por leitores e aprovados pela curadoria.</p>
          </div>
          {communityGrid(communityShown)}
        </div>
      ) : null}

      {onlyCommunity ? null : !searching ? (
        <p className="explore-note">
          Sugestões para começar. Os personagens aparecem quando você abre o livro.
        </p>
      ) : status === "error" ? (
        <p className="explore-note">
          Não foi possível buscar livros agora. Tente de novo em instantes.
        </p>
      ) : status === "loading" ? (
        <p className="explore-note">
          {slow ? "O acervo está demorando mais que o normal… quase lá." : "Procurando no acervo…"}
        </p>
      ) : status === "ready" && books.length === 0 ? (
        <p className="explore-note">
          Nenhum livro encontrado para “{term}”. A busca cobre os clássicos do Project Gutenberg e
          os livros da comunidade; se você tem o arquivo do livro,{" "}
          <button type="button" className="inline-link" onClick={() => onImport()}>
            importe o seu
          </button>
          .
        </p>
      ) : (
        <p className="explore-note">
          {total === null
            ? `Livros para “${term}”`
            : `${total.toLocaleString("pt-BR")} ${total === 1 ? "livro" : "livros"} para “${term}”`}
        </p>
      )}

      {status !== "error" && !onlyCommunity ? (
        <div className="result-grid">
          {searching && status === "loading"
            ? Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="result result-skeleton" aria-hidden="true">
                  <div className="cover" />
                  <span />
                  <span />
                </div>
              ))
            : shown.map((b) => (
                <button key={b.id} type="button" className="result" onClick={() => onOpen(b)}>
                  <BookCover book={b} />
                  <strong>{b.title}</strong>
                  <span>
                    {b.author}
                    {b.textLanguage === "pt" ? " · PT" : ""}
                  </span>
                </button>
              ))}
        </div>
      ) : null}

      {searching && outside.length > 0 && !onlyCommunity ? (
        <div className="outside">
          <div className="outside-head">
            <h3>Fora do acervo</h3>
            <p>
              Estes livros ainda têm direitos autorais, então não estão no acervo. Tem o arquivo?
              Importe e leia aqui, com os personagens.
            </p>
          </div>
          <div className="result-grid">
            {outside.map((h) => (
              <div key={`${h.title}|${h.author}`} className="result outside-book">
                <div className="cover">
                  <img className="cover-photo is-loaded" src={h.coverUrl} alt="" loading="lazy" />
                </div>
                <strong>{h.title}</strong>
                <span>
                  {h.author}
                  {h.year ? ` · ${h.year}` : ""}
                </span>
                <button
                  type="button"
                  className="btn outside-import"
                  onClick={() => onImport(h)}
                  aria-label={`Importar o meu arquivo de ${h.title}`}
                >
                  {Icon.upload}
                  Importar
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {searching && status === "ready" && next && !onlyCommunity ? (
        <div className="explore-more">
          <button type="button" className="btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
