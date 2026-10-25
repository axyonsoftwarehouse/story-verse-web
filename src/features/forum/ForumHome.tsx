import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import "../../App.css";
import "./forum.css";
import { FORUM_ENABLED, FORUM_PREVIEW } from "../../lib/features";
import { ApiHttpError } from "../../lib/backend";
import { useStoredSession } from "../auth/useStoredSession";
import {
  createTopic,
  forumDate,
  listSpaces,
  listTopics,
  SPOILER_LABELS,
  toggleBookmark,
  toggleReaction,
  type ForumSpace,
  type ForumTopic,
  type SpoilerLevel,
  type TopicFilter,
} from "../../lib/forum";

const FILTERS: { value: TopicFilter; label: string }[] = [
  { value: "recent", label: "Recentes" },
  { value: "unanswered", label: "Sem resposta" },
  { value: "popular", label: "Populares" },
];

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a comunidade.";
}

function emptyForm(space: string) {
  return {
    space,
    title: "",
    body: "",
    bookKey: "",
    chapterRef: "",
    spoilerLevel: "none" as SpoilerLevel,
  };
}

export function ForumHome() {
  const { session } = useStoredSession();
  const [spaces, setSpaces] = useState<ForumSpace[]>([]);
  const [topics, setTopics] = useState<ForumTopic[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<TopicFilter>("recent");
  const [space, setSpace] = useState(
    () => new URLSearchParams(window.location.search).get("space") ?? "",
  );
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  // Paywall: a API responde 402 e a lista vem vazia — sem separar os dois, a tela
  // mostrava "Nenhum tópico por aqui ainda" junto do aviso de assinatura.
  const [paywall, setPaywall] = useState(false);
  const [notice, setNotice] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState(() => emptyForm(""));

  useEffect(() => {
    let alive = true;
    listSpaces()
      .then((list) => {
        if (!alive) return;
        setSpaces(list);
        setForm((current) => (current.space ? current : emptyForm(list[0]?.slug ?? "")));
      })
      .catch((err: unknown) => {
        if (alive) setError(message(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    listTopics(session, { space: space || undefined, filter, q: query || undefined })
      .then((page) => {
        if (!alive) return;
        setTopics(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(message(err));
        setPaywall(err instanceof ApiHttpError && err.status === 402);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, space, filter, query, reloadKey]);

  function requireSession() {
    if (!session) {
      setNotice("Entre na sua conta para participar da comunidade.");
      return null;
    }
    return session;
  }

  async function loadMore() {
    if (!nextCursor || more) return;
    setMore(true);
    setError("");
    try {
      const page = await listTopics(session, {
        space: space || undefined,
        filter,
        q: query || undefined,
        cursor: nextCursor,
      });
      setTopics((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setMore(false);
    }
  }

  async function like(topic: ForumTopic) {
    const current = requireSession();
    if (!current) return;
    try {
      const result = await toggleReaction(current, "topic", topic.id);
      setTopics((list) =>
        list.map((item) =>
          item.id === topic.id
            ? { ...item, liked: result.liked, reaction_count: result.reactionCount }
            : item,
        ),
      );
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  async function bookmark(topic: ForumTopic) {
    const current = requireSession();
    if (!current) return;
    try {
      const result = await toggleBookmark(current, topic.id);
      setTopics((list) =>
        list.map((item) => (item.id === topic.id ? { ...item, bookmarked: result.saved } : item)),
      );
    } catch (err: unknown) {
      setError(message(err));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const current = requireSession();
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      const created = await createTopic(current, {
        space: form.space,
        title: form.title,
        body: form.body,
        bookKey: form.bookKey.trim() || null,
        chapterRef: form.chapterRef.trim() || null,
        spoilerLevel: form.spoilerLevel,
      });
      setComposerOpen(false);
      setForm(emptyForm(spaces[0]?.slug ?? ""));
      setFilter("recent");
      setQuery("");
      setSearchInput("");
      setNotice(
        created.status === "pending" ? "Tópico enviado para análise." : "Tópico publicado.",
      );
      setReloadKey((key) => key + 1);
    } catch (err: unknown) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
        <span className="wordmark">Comunidade</span>
      </nav>

      <section className="shelf">
        <div className="shelf-head">
          <h1>Comunidade</h1>
        </div>
        <p className="forum-intro">
          Converse sobre livros, personagens e leitura. Tópicos por livro aceitam spoiler marcado.
        </p>
        {FORUM_PREVIEW && !FORUM_ENABLED ? (
          <p className="forum-preview-note">
            Prévia do fórum — ainda não publicado no menu. Abra com <code>?forum=1</code>.
          </p>
        ) : null}
        <div className="forum-toolbar">
          <div className="filter-pills forum-spaces">
            <button
              type="button"
              className={`filter-pill ${space === "" ? "active" : ""}`}
              onClick={() => setSpace("")}
            >
              Todos
            </button>
            {spaces.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`filter-pill ${space === item.slug ? "active" : ""}`}
                onClick={() => setSpace(item.slug)}
              >
                {item.name}
                {item.topic_count ? <small>{item.topic_count}</small> : null}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (!requireSession()) return;
              setForm((current) => ({ ...current, space: current.space || spaces[0]?.slug || "" }));
              setComposerOpen((open) => !open);
            }}
          >
            Novo tópico
          </button>
        </div>

        <div className="segmented forum-filter-tabs" role="tablist">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              className={filter === item.value ? "is-on" : ""}
              onClick={() => setFilter(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <form
          className="forum-search"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(searchInput.trim());
          }}
        >
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Buscar tópicos por título ou texto"
            aria-label="Buscar tópicos"
          />
          <button type="submit" className="btn">
            Buscar
          </button>
          {query ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSearchInput("");
                setQuery("");
              }}
            >
              Limpar
            </button>
          ) : null}
        </form>
      </section>

      {notice ? (
        <p className="auth-global-notice" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <div className="forum-error-block">
          <p className="auth-error forum-error" role="alert">
            {error}
          </p>
          {paywall ? (
            <p className="forum-hint">
              O fórum faz parte da assinatura.{" "}
              <Link className="btn btn-primary" to="/assinar">
                Ver o plano
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {composerOpen ? (
        <section className="shelf">
          <form className="profile-card forum-composer" onSubmit={submit}>
            <h2>Novo tópico</h2>
            <label>
              Espaço
              <select
                value={form.space}
                onChange={(event) => setForm((current) => ({ ...current, space: event.target.value }))}
                required
              >
                {spaces.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Título
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                minLength={3}
                maxLength={160}
                required
              />
            </label>
            <label>
              Texto
              <textarea
                value={form.body}
                onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
                rows={6}
                maxLength={20000}
                required
              />
            </label>
            <div className="forum-form-row">
              <label>
                Livro (opcional)
                <input
                  value={form.bookKey}
                  onChange={(event) => setForm((current) => ({ ...current, bookKey: event.target.value }))}
                  placeholder="gb:1342 ou cm:..."
                />
              </label>
              <label>
                Capítulo (opcional)
                <input
                  value={form.chapterRef}
                  onChange={(event) => setForm((current) => ({ ...current, chapterRef: event.target.value }))}
                  maxLength={200}
                />
              </label>
              <label>
                Spoiler
                <select
                  value={form.spoilerLevel}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      spoilerLevel: event.target.value as SpoilerLevel,
                    }))
                  }
                >
                  {(Object.keys(SPOILER_LABELS) as SpoilerLevel[]).map((level) => (
                    <option key={level} value={level}>
                      {SPOILER_LABELS[level]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="forum-form-actions">
              <button type="button" className="btn" onClick={() => setComposerOpen(false)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="shelf">
        <div className="shelf-head">
          <h2>{filter === "unanswered" ? "Sem resposta" : filter === "popular" ? "Populares" : "Tópicos"}</h2>
        </div>
        {loading ? (
          <div className="page-status">
            <span className="spinner" aria-hidden="true" />
            Carregando tópicos…
          </div>
        ) : error ? null : topics.length === 0 ? (
          <p className="profile-empty">
            {query
              ? "Nenhum tópico encontrado para essa busca."
              : "Nenhum tópico por aqui ainda. Abra o primeiro!"}
          </p>
        ) : (
          <div className="forum-topic-list">
            {topics.map((topic) => (
              <article className="profile-card forum-topic" key={topic.id}>
                <div className="forum-topic-main">
                  <div className="forum-meta">
                    <span>{topic.space_name}</span>
                    <span>·</span>
                    <span>{topic.author_name}</span>
                    <span>·</span>
                    <time dateTime={topic.last_activity_at}>{forumDate(topic.last_activity_at)}</time>
                    {topic.is_pinned ? <span className="status-chip is-approved">Fixado</span> : null}
                    {topic.is_locked ? <span className="status-chip">Fechado</span> : null}
                    {topic.spoiler_level !== "none" ? (
                      <span className="status-chip is-pending">Spoiler</span>
                    ) : null}
                  </div>
                  <Link className="forum-topic-title" to={`/comunidade/t/${topic.id}`}>
                    {topic.title}
                  </Link>
                  {topic.spoiler_level === "none" && topic.excerpt ? (
                    <p className="forum-excerpt">{topic.excerpt}</p>
                  ) : topic.spoiler_level !== "none" ? (
                    <p className="forum-spoiler-note">O texto pode conter spoiler.</p>
                  ) : null}
                  <div className="forum-meta">
                    <span>{topic.reply_count} respostas</span>
                    <span>·</span>
                    <span>{topic.reaction_count} curtidas</span>
                    {topic.book_key ? <span className="forum-book-key">{topic.book_key}</span> : null}
                    {topic.accepted_reply_id ? <span className="status-chip is-approved">Resolvido</span> : null}
                  </div>
                </div>
                <div className="forum-actions">
                  <button
                    type="button"
                    className={`btn ${topic.liked ? "is-on" : ""}`}
                    aria-pressed={topic.liked}
                    onClick={() => void like(topic)}
                  >
                    {topic.liked ? "Curtido" : "Curtir"}
                  </button>
                  <button type="button" className="btn" onClick={() => void bookmark(topic)}>
                    {topic.bookmarked ? "Salvo" : "Salvar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {nextCursor ? (
          <div className="forum-more">
            <button type="button" className="btn" onClick={() => void loadMore()} disabled={more}>
              {more ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
