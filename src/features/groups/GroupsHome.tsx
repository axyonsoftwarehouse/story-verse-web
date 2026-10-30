import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../../App.css";
import "./groups.css";
import { useStoredSession } from "../auth/useStoredSession";
import { enablePush, pushNeedsInstall, pushSupported, syncPush } from "../../lib/push";
import {
  enableGroupNotifications,
  messageTime,
  myGroups,
  notificationsAvailable,
  notifyGroupMessage,
  openGroupStream,
  publicGroups,
  stripFormatting,
  type Group,
} from "../../lib/groups";
import { GroupForm } from "./GroupForm";
import { PushStatus } from "./PushStatus";
import { GroupAvatar, GroupsBlocked } from "./GroupParts";
import { GIcon } from "./groupIcons";
import { useGroupsGate } from "./groupHelpers";

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
  // "Clubes deste livro" (página do livro) chega com o livro na URL.
  const presetBook = params.get("livro");
  const presetTitle = params.get("titulo");
  const [tab, setTab] = useState<Tab>(presetBook ? "explore" : "mine");
  const [mine, setMine] = useState<Group[] | null>(null);
  const [explore, setExplore] = useState<Group[] | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [askNotify, setAskNotify] = useState(() => (notificationsAvailable() && Notification.permission === "default") || pushNeedsInstall());
  const needsInstall = pushNeedsInstall();
  const me = session?.user.id;

  // Já deu permissão antes: confere a inscrição deste aparelho (pode ter mudado ou trocado de conta).
  useEffect(() => {
    if (gate.ready) void syncPush().catch((err: unknown) => console.warn("[push] inscrição não sincronizada:", err));
  }, [gate.ready]);

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
        if (g && event.data.author_id !== me) notifyGroupMessage(event.data, g.name, g.muted);
      }
      if (event.type === "message" || event.type === "group" || event.type === "message_deleted") void load();
    }, load);
    return () => {
      alive = false;
      close();
    };
  }, [gate.ready, me]);

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
  const unread = (mine ?? []).reduce((sum, g) => sum + (Number(g.unread) || 0), 0);

  return (
    <div className="home groups-page">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
      </nav>

      <header className="groups-hero">
        <span className="groups-hero-icon">{GIcon.chat}</span>
        <div>
          <span className="eyebrow">Comunidade</span>
          <h1>Grupos de leitura</h1>
          <p>Converse com outros leitores em tempo real. Monte um clube para ler um livro junto ou só bata papo.</p>
        </div>
        <button type="button" className="btn btn-primary groups-create" onClick={() => setCreating(true)}>
          {GIcon.plus} Criar grupo
        </button>
      </header>

      <div className="groups-toolbar">
        <div className="segmented groups-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>
            Meus grupos
            {unread > 0 ? <span className="groups-tab-badge">{unread > 99 ? "99+" : unread}</span> : null}
          </button>
          <button type="button" role="tab" aria-selected={tab === "explore"} className={tab === "explore" ? "is-on" : ""} onClick={() => setTab("explore")}>
            Explorar
          </button>
        </div>
        {tab === "explore" ? (
          <form
            className="groups-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search.trim());
            }}
          >
            {GIcon.search}
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) setQuery("");
              }}
              placeholder="Buscar grupo ou livro"
              aria-label="Buscar grupos"
              maxLength={80}
            />
          </form>
        ) : null}
      </div>

      {presetBook && tab === "explore" ? (
        <p className="groups-filter">
          {GIcon.book} Clubes de <strong>“{presetTitle ?? presetBook}”</strong>
          <Link className="group-text-btn" to="/grupos" onClick={() => setTab("explore")}>
            Ver todos
          </Link>
        </p>
      ) : null}

      {askNotify && tab === "mine" ? (
        <div className="groups-notify" role="status">
          <span className="groups-notify-icon">{GIcon.bell}</span>
          {needsInstall ? (
            <span>
              Para receber os avisos no iPhone, adicione o Storyverse à Tela de Início: toque em <strong>Compartilhar</strong> e depois em{" "}
              <strong>Adicionar à Tela de Início</strong>.
            </span>
          ) : (
            <>
              <span>Receba no celular um aviso quando chegar mensagem nos seus grupos.</span>
              <button
                type="button"
                className="group-text-btn"
                onClick={() => void (pushSupported() ? enablePush() : enableGroupNotifications()).catch(() => false).finally(() => setAskNotify(false))}
              >
                Ativar
              </button>
            </>
          )}
          <button type="button" className="group-icon-btn" aria-label="Agora não" onClick={() => setAskNotify(false)}>
            {GIcon.close}
          </button>
        </div>
      ) : null}

      {!askNotify && tab === "mine" ? <PushStatus /> : null}

      {error ? (
        <p className="auth-error groups-error" role="alert">
          {error}
        </p>
      ) : null}

      {list === null ? (
        <ul className="group-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="group-card is-skeleton" />
          ))}
        </ul>
      ) : list.length === 0 ? (
        <div className="groups-empty">
          <span className="groups-empty-icon">{tab === "mine" ? GIcon.chat : GIcon.search}</span>
          <strong>
            {tab === "mine"
              ? "Você ainda não está em nenhum grupo"
              : query
                ? "Nenhum grupo com essa busca"
                : presetBook
                  ? "Ainda não há clube deste livro"
                  : "Ainda não há grupos públicos"}
          </strong>
          <p>{tab === "mine" ? "Entre num grupo público ou crie o seu e chame os amigos pelo link." : "Que tal criar o primeiro?"}</p>
          <div className="groups-empty-actions">
            {tab === "mine" ? (
              <button type="button" className="btn" onClick={() => setTab("explore")}>
                Explorar grupos
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              {GIcon.plus} Criar grupo
            </button>
          </div>
        </div>
      ) : (
        <ul className="group-list">
          {list.map((g) => (
            <li key={g.id}>
              <GroupCard group={g} explore={tab === "explore"} />
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <GroupForm
          presetBook={presetBook}
          presetTitle={presetTitle}
          onClose={() => setCreating(false)}
          onSaved={(g) => navigate(`/grupos/${g.id}`)}
        />
      ) : null}
    </div>
  );
}

function GroupCard({ group, explore }: { group: Group; explore: boolean }) {
  const members = Number(group.member_count);
  const preview =
    group.is_member && group.last_message_id ? (
      <>
        <strong>{group.last_author_name}:</strong> {group.last_body
          ? `${group.last_media_kind === "image" ? "📷 " : group.last_media_kind === "audio" ? "🎤 " : ""}${stripFormatting(group.last_body)}`
          : group.last_media_kind === "image"
            ? "📷 Foto"
            : group.last_media_kind === "audio"
              ? "🎤 Áudio"
              : "🙈 mensagem com spoiler"}
      </>
    ) : (
      group.description
    );
  return (
    <Link className={`group-card ${group.unread > 0 ? "has-unread" : ""}`} to={`/grupos/${group.id}`}>
      <GroupAvatar id={group.id} name={group.name} photo={group.photo_url} size="lg" />
      <span className="group-card-body">
        <span className="group-card-title">
          <strong>{group.name}</strong>
          {group.visibility === "private" ? (
            <span className="group-card-lock" title="Grupo privado">
              {GIcon.lock}
            </span>
          ) : null}
        </span>
        <span className="group-card-sub">
          {group.book_title ? (
            <span className="group-card-book">
              {GIcon.book}
              {group.book_title}
            </span>
          ) : null}
          <span>
            {members} {members === 1 ? "membro" : "membros"}
          </span>
        </span>
        {preview ? <span className="group-card-last">{preview}</span> : null}
      </span>
      <span className="group-card-side">
        {explore && !group.is_member ? (
          <span className="group-join-chip">Entrar</span>
        ) : (
          <>
            {group.last_message_at ? <small>{messageTime(group.last_message_at)}</small> : null}
            {group.unread > 0 ? (
              <span className="group-unread" aria-label={`${group.unread} mensagens não lidas`}>
                {group.unread >= 100 ? "99+" : group.unread}
              </span>
            ) : null}
          </>
        )}
      </span>
    </Link>
  );
}
