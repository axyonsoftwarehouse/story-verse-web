import { useEffect, useRef, useState } from "react";
import type { Ebook } from "../data/types";
import { findOpenLibraryCover, forgetCover, knownCover } from "../lib/bookCovers";

/** Capa real do Gutenberg; se não houver (ou falhar), desenha uma capa tipográfica. */
/**
 * Capa do livro: a própria (Gutenberg ou do arquivo importado); sem ela, ou se não carregar, a da
 * Open Library pelo título e autor (buscada só quando o livro aparece na tela); por último, a
 * capa tipográfica desenhada pelo app.
 */
export function BookCover({ book }: { book: Ebook }) {
  // Outro livro ou outra capa: começa do zero (a key recria o estado já no primeiro desenho).
  // Zerar num useEffect falhava no refresh do celular: a imagem do cache carregava antes do efeito
  // rodar, o efeito voltava para "carregando" e a capa ficava invisível.
  return <BookCoverImage key={`${book.gutenbergId}|${book.coverUrl ?? ""}|${book.title}|${book.author}`} book={book} />;
}

function BookCoverImage({ book }: { book: Ebook }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const [useCoverMirror, setUseCoverMirror] = useState(false);
  const [olUrl, setOlUrl] = useState<string | null | undefined>(() => knownCover(book.title, book.author));
  const [olStatus, setOlStatus] = useState<"loading" | "loaded" | "failed">("loading");
  /** Nova tentativa depois de uma falha (rede móvel instável): 1,5 s e depois 4 s. */
  const [retry, setRetry] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const retryTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(retryTimer.current), []);
  /** Falhou: tenta de novo (até 2 vezes, pulando o cache) antes de ficar com a capa desenhada. */
  const retryOr = (giveUp: () => void) => {
    if (retry >= 2) return giveUp();
    window.clearTimeout(retryTimer.current);
    retryTimer.current = window.setTimeout(() => setRetry((n) => n + 1), retry === 0 ? 1500 : 4000);
  };
  // Imagem guardada no próprio endereço (data:/blob:) não aceita "?tentativa" no fim.
  const withRetry = (src: string | undefined) =>
    src && retry > 0 && !/^(data|blob):/.test(src) ? `${src}${src.includes("?") ? "&" : "?"}tentativa=${retry}` : src;

  const needsFallback = !book.coverUrl || status === "failed";
  useEffect(() => {
    if (!needsFallback || olUrl !== undefined) return;
    const el = ref.current;
    if (!el) return;
    let alive = true;
    let tries = 0;
    let again: number | undefined;
    const lookup = () =>
      void findOpenLibraryCover(book.title, book.author, book.textLanguage).then((url) => {
        if (!alive) return;
        if (url !== undefined) return setOlUrl(url);
        // Falhou agora (rede, demora): tenta de novo sozinho em vez de ficar com a genérica.
        if (++tries <= 2) again = window.setTimeout(lookup, tries === 1 ? 4000 : 12000);
      });
    if (typeof IntersectionObserver === "undefined") {
      lookup();
      return () => {
        alive = false;
        window.clearTimeout(again);
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          lookup();
        }
      },
      // Folga lateral: nas fileiras que rolam para o lado, já busca os próximos livros.
      { rootMargin: "300px 900px" },
    );
    io.observe(el);
    return () => {
      alive = false;
      window.clearTimeout(again);
      io.disconnect();
    };
  }, [needsFallback, olUrl, book.title, book.author, book.textLanguage]);

  const coverSrc =
    useCoverMirror && book.coverUrl?.startsWith("/gutenberg/")
      ? book.coverUrl.replace(/^\/gutenberg\//, "/gutenberg-mirror/")
      : book.coverUrl;

  return (
    <div className="cover" ref={ref}>
      {book.coverUrl && status !== "failed" ? (
        <img
          className={`cover-photo ${status === "loaded" ? "is-loaded" : ""}`}
          src={withRetry(coverSrc)}
          alt=""
          loading="lazy"
          onLoad={() => setStatus("loaded")}
          onError={() => {
            if (!useCoverMirror && book.coverUrl?.startsWith("/gutenberg/")) {
              setUseCoverMirror(true);
              setStatus("loading");
              return;
            }
            retryOr(() => setStatus("failed"));
          }}
        />
      ) : needsFallback && olUrl && olStatus !== "failed" ? (
        <img
          className={`cover-photo ${olStatus === "loaded" ? "is-loaded" : ""}`}
          src={withRetry(olUrl)}
          alt=""
          loading="lazy"
          onLoad={(e) => {
            // A Open Library devolve uma imagem de 1 px quando a capa não existe.
            if (e.currentTarget.naturalWidth < 10) {
              forgetCover(book.title, book.author);
              setOlStatus("failed");
            } else setOlStatus("loaded");
          }}
          // Falha de rede: só esta vez fica a capa desenhada (sem esquecer a capa: no próximo
          // carregamento tenta de novo). Esquecer é só para a imagem vazia acima.
          onError={() => retryOr(() => setOlStatus("failed"))}
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
