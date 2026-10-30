import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../App.css";
import "./groups.css";
import { useStoredSession } from "../auth/useStoredSession";
import {
  createGroup,
  enableGroupNotifications,
  messageTime,
  myGroups,
  notificationsAvailable,
  notifyGroupMessage,
  openGroupStream,
  publicGroups,
  type Group,
  type GroupFields,
} from "../../lib/groups";
import { GroupsBlocked } from "./GroupParts";
import { bookOptions, useGroupsGate } from "./groupHelpers";

type Tab = "mine" | "explore";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar os grupos.";
}

/** Lista de grupos: os meus (com não lidas) e os públicos para explorar; criar grupo. */
export function GroupsHome() {
  const { session, loading: sessionLoading } = useStoredSession();
  const gate = useGroupsGate(session, sessionLoading);
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  // "Criar clube deste livro" (página do livro) chega com o livro na URL.
  const presetBook = params.get("livro");
  const [tab, setTab] = useState<Tab>(presetBook ? "explore" : "mine");
  const [mine, setMine] = useState<Group[] | null>(null);
  const [explore, setExplore] = useState<Group[] | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const presetTitle = params.get("titulo");
  const [askNotify, setAskNotify] = useState(() => notificationsAvailable() && Notification.permission === "default");

  useEffect(() => {
    if (!gate.ready) return;
    let alive = true;
    let known: Group[] = [];
    const load = () =>
      myGroups()
        .then((list) => {
          if (!alive) return;
          known = list;
          setMine(list);
        })
        .catch((err: unknown) => alive && setError(message(err)));
    void load();
    // Mensagem nova em qualquer grupo: atualiza a lista (ordem, não lidas e prévia).
    const close = openGroupStream((event) => {
      if (event.type === "message") {
        const g = known.find((x) => x.id === event.data.group_id);
        if (g && event.data.author_id !== session?.user.id) notifyGroupMessage(event.data, g.name, g.muted);
      }
      if (event.type === "message" || event.type === "group" || event.type === "message_deleted") void load();
    }, load);
    return () => {
      alive = false;
      close();
    };
  }, [gate.ready, session?.user.id]);

  useEffect(() => {
    if (!gate.ready || tab !== "explore") return;
    let alive = true;
    setExplore(null);
    publicGroups({ q: query || undefined, book: presetBook ?? undefined })
      .then((list) => alive && setExplore(list))
      .catch((err: unknown) => alive && setError(message(err)));
    return () => {
      alive = false;
    };
  }, [gate.ready, tab, query, presetBook]);

  if (!gate.ready) return <GroupsBlocked text={gate.blocked} />;

  const list = tab === "mine" ? mine : explore;

  return (
    <div className="home groups-page">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
        <span className="wordmark">Grupos</span>
      </nav>
      <section className="shelf">
        <div className="shelf-head">
          <h1>Grupos</h1>
        </div>
        <p className="forum-intro">
          Converse com outros leitores. Um grupo pode ser só de conversa ou um clube de leitura de um livro, com meta e o
          progresso de cada um.
        </p>
        <div className="groups-toolbar">
          <div className="segmented" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>
              Meus grupos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "explore"}
              className={tab === "explore" ? "is-on" : ""}
              onClick={() => setTab("explore")}
            >
              Explorar
            </button>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Criar grupo
          </button>
        </div>
        {presetBook && tab === "explore" ? (
          <p className="group-card-sub">
            Clubes de “{presetTitle ?? presetBook}”.{" "}
            <Link className="link-btn" to="/grupos" onClick={() => setTab("mine")}>
              Ver todos os grupos
            </Link>
          </p>
        ) : null}
        {tab === "explore" ? (
          <form
            className="forum-search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome do grupo ou livro"
              aria-label="Buscar grupos"
              maxLength={80}
            />
            <button type="submit" className="btn">
              Buscar
            </button>
          </form>
        ) : null}
      </section>

      {error ? (
        <p className="auth-error forum-error" role="alert">
          {error}
        </p>
      ) : null}

      {askNotify ? (
        <div className="continue-undo groups-notify" role="status">
          <span>Quer um aviso quando chegar mensagem com o app aberto em outra tela?</span>
          <button
            type="button"
            className="btn"
            onClick={() => void enableGroupNotifications().finally(() => setAskNotify(false))}
          >
            Ativar avisos
          </button>
        </div>
      ) : null}

      {creating ? (
        <CreateGroupForm
          presetBook={presetBook}
          onCancel={() => setCreating(false)}
          onCreated={(g) => navigate(`/grupos/${g.id}`)}
        />
      ) : null}

      <section className="shelf">
        {list === null ? (
          <div className="page-status">
            <span className="spinner" aria-hidden="true" />
            Carregando…
          </div>
        ) : list.length === 0 ? (
          <p className="profile-empty">
            {tab === "mine"
              ? "Você ainda não está em nenhum grupo. Explore os públicos ou crie o seu."
              : query
                ? "Nenhum grupo encontrado com essa busca."
                : presetBook
                  ? "Ainda não há clube deste livro. Crie o primeiro!"
                  : "Ainda não há grupos públicos. Que tal criar o primeiro?"}
          </p>
        ) : (
          <ul className="group-list">
            {list.map((g) => (
              <li key={g.id}>
                <GroupCard group={g} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Link className={`group-card ${group.unread > 0 ? "has-unread" : ""}`} to={`/grupos/${group.id}`}>
      {group.book_cover ? (
        <img className="group-card-cover" src={group.book_cover} alt="" loading="lazy" />
      ) : (
        <span className="group-card-cover is-empty" aria-hidden="true">
          {group.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="group-card-body">
        <span className="group-card-title">
          <strong>{group.name}</strong>
          {group.visibility === "private" ? <small className="group-tag">Privado</small> : null}
        </span>
        <span className="group-card-sub">
          {group.book_title ? `📖 ${group.book_title} · ` : ""}
          {group.member_count} {Number(group.member_count) === 1 ? "membro" : "membros"}
        </span>
        {group.is_member && group.last_message_id ? (
          <span className="group-card-last">
            {group.last_author_name}: {group.last_body ?? "🙈 mensagem com spoiler"}
          </span>
        ) : group.description ? (
          <span className="group-card-last">{group.description}</span>
        ) : null}
      </span>
      <span className="group-card-side">
        {group.last_message_at ? <small>{messageTime(group.last_message_at)}</small> : null}
        {group.unread > 0 ? (
          <span className="group-unread" aria-label={`${group.unread} mensagens não lidas`}>
            {group.unread >= 100 ? "99+" : group.unread}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function CreateGroupForm({
  presetBook,
  onCancel,
  onCreated,
}: {
  presetBook: string | null;
  onCancel: () => void;
  onCreated: (g: Group) => void;
}) {
  const books = useMemo(() => bookOptions(), []);
  const presetTitle = new URLSearchParams(window.location.search).get("titulo");
  const [name, setName] = useState(presetTitle ? `Clube: ${presetTitle}`.slice(0, 60) : "");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [bookKey, setBookKey] = useState(presetBook ?? "");
  const [goalChapter, setGoalChapter] = useState("");
  const [goalUntil, setGoalUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = presetBook && !books.some((b) => b.key === presetBook)
    ? [{ key: presetBook, title: presetTitle ?? presetBook }, ...books]
    : books;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const book = options.find((b) => b.key === bookKey);
    const fields: GroupFields = {
      name: name.trim(),
      description: description.trim() || null,
      visibility,
      bookKey: book?.key ?? null,
      bookTitle: book?.title ?? null,
      bookCover: book && "cover" in book ? (book.cover ?? null) : null,
      goalChapter: book && goalChapter ? Number(goalChapter) : null,
      goalUntil: book && goalUntil ? goalUntil : null,
    };
    try {
      onCreated(await createGroup(fields));
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <section className="shelf">
      <form className="profile-card forum-composer group-create" onSubmit={submit}>
        <h2>Novo grupo</h2>
        <label>
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={3} maxLength={60} required />
        </label>
        <label>
          Descrição (opcional)
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} />
        </label>
        <fieldset className="group-visibility">
          <legend>Quem pode entrar</legend>
          <label>
            <input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} />
            <span>
              <strong>Público</strong>
              <small>Aparece em Explorar e qualquer leitor entra.</small>
            </span>
          </label>
          <label>
            <input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} />
            <span>
              <strong>Privado</strong>
              <small>Só entra quem recebe o link de convite.</small>
            </span>
          </label>
        </fieldset>
        <label>
          Livro do clube (opcional)
          <select value={bookKey} onChange={(e) => setBookKey(e.target.value)}>
            <option value="">Sem livro: grupo de conversa</option>
            {options.map((b) => (
              <option key={b.key} value={b.key}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
        {bookKey ? (
          <div className="group-goal">
            <label>
              Meta: até o capítulo
              <input type="number" min={1} max={10000} value={goalChapter} onChange={(e) => setGoalChapter(e.target.value)} />
            </label>
            <label>
              até o dia
              <input type="date" value={goalUntil} onChange={(e) => setGoalUntil(e.target.value)} />
            </label>
          </div>
        ) : null}
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="shelf-actions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Criando…" : "Criar grupo"}
          </button>
        </div>
      </form>
    </section>
  );
}
