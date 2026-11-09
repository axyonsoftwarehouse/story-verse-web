import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchAudiobooks,
  formatAudioDuration,
  type AudioBookListItem,
} from "../../lib/publicAudiobooks";
import "./audiobook.css";

export function AudiobooksPage() {
  const [items, setItems] = useState<AudioBookListItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchAudiobooks()
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch((err: unknown) => {
        if (alive) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar os audiolivros.");
          setItems([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/biblioteca">
          Biblioteca
        </Link>
      </nav>

      <section className="shelf audiobook-list-page">
        <div className="shelf-head">
          <div>
            <span className="eyebrow">Ouvir</span>
            <h1>Audiolivros</h1>
            <p>Histórias narradas para ouvir no celular ou no computador. Nos audiolivros com vários capítulos, o primeiro é aberto para ouvir sem conta.</p>
          </div>
        </div>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        {items === null ? (
          <div className="page-status">
            <span className="spinner" aria-hidden="true" />
            Carregando audiolivros…
          </div>
        ) : items.length === 0 ? (
          <p className="muted audiobook-empty">
            Nenhum audiolivro publicado ainda. Os títulos aparecem aqui depois que a curadoria publica
            a edição em áudio.
          </p>
        ) : (
          <div className="audiobook-grid">
            {items.map((item) => (
              <Link
                key={`${item.bookKey}-${item.narrator ?? ""}`}
                className="audiobook-card"
                to={`/ouvir/${encodeURIComponent(item.bookKey)}`}
              >
                <div className="audiobook-card-cover">
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" />
                  ) : (
                    <span>{item.title}</span>
                  )}
                </div>
                <div className="audiobook-card-info">
                  <strong>{item.title}</strong>
                  <span className="muted">{item.author || "Autor não informado"}</span>
                  {item.narrator ? (
                    <span className="muted">Narração: {item.narrator}</span>
                  ) : null}
                  <span className="audiobook-card-meta">
                    {formatAudioDuration(item.totalDurationSeconds)} · {item.chapterCount}{" "}
                    {item.chapterCount === 1 ? "capítulo" : "capítulos"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
