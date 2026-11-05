import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PersonFace } from "../groups/GroupParts";
import { GIcon } from "../groups/groupIcons";
import { errorText, follow, followLabel, PEOPLE_PAGE, relationOf, unfollow, type Person, type PersonProfile } from "../../lib/social";

/** Selo ao lado do nome: "Conexão" (as duas se seguem) ou "Segue você". */
export function RelationBadge({ person }: { person: Pick<Person, "is_following" | "follows_me"> }) {
  const relation = relationOf(person);
  if (relation === "connection") return <span className="people-badge is-connection">Conexão</span>;
  if (relation === "follows_me") return <span className="people-badge">Segue você</span>;
  return null;
}

/**
 * Seguir / deixar de seguir, com resposta imediata (volta atrás se a API recusar). Deixar de
 * seguir uma conexão pede confirmação: a pessoa perde o selo de conexão.
 */
export function FollowButton({
  person,
  onChange,
  compact = false,
}: {
  person: Person;
  onChange: (next: Person | PersonProfile) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const relation = relationOf(person);
  const on = person.is_following;

  async function toggle() {
    if (busy) return;
    if (on && relation === "connection" && !window.confirm(`Deixar de seguir ${person.name}? Vocês deixam de ser conexão.`)) return;
    setBusy(true);
    setError("");
    const before = person;
    onChange({ ...person, is_following: !on });
    try {
      const next = on ? await unfollow(person.id) : await follow(person.id);
      onChange({ ...person, ...next });
    } catch (err) {
      onChange(before);
      setError(errorText(err, "Não deu certo agora. Tente de novo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="people-follow-wrap">
      <button
        type="button"
        className={`btn people-follow ${on ? "is-on" : "btn-primary"} ${compact ? "is-compact" : ""}`}
        onClick={() => void toggle()}
        disabled={busy}
        aria-pressed={on}
        aria-label={on ? `Deixar de seguir ${person.name}` : `Seguir ${person.name}`}
      >
        {on ? GIcon.check : GIcon.plus}
        <span className="people-follow-label">{followLabel(relation)}</span>
      </button>
      {error ? (
        <small className="people-follow-error" role="alert">
          {error}
        </small>
      ) : null}
    </span>
  );
}

/** Uma pessoa numa lista: rosto e nome levam ao perfil; à direita, seguir (e ações extras). */
export function PersonRow({
  person,
  me,
  detail,
  onChange,
  extra,
}: {
  person: Person;
  me: string;
  detail?: string | null;
  onChange: (next: Person) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="people-row">
      <Link className="people-row-main" to={`/pessoas/${person.id}`}>
        <PersonFace id={person.id} name={person.name} avatar={person.avatar} photo={person.photo} />
        <span className="people-row-text">
          <strong>
            {person.name}
            {person.id === me ? <small className="people-you"> (você)</small> : null}
          </strong>
          <span className="people-row-meta">
            <RelationBadge person={person} />
            {detail ? <span>{detail}</span> : null}
          </span>
        </span>
      </Link>
      {person.id !== me ? <FollowButton person={person} onChange={(p) => onChange(p)} compact /> : null}
      {extra}
    </div>
  );
}

/**
 * Lista paginada de pessoas ("Seguidores", "Seguindo"): carrega a primeira página e mais
 * {@link PEOPLE_PAGE} a cada "Ver mais".
 */
export function PeopleList({
  load,
  me,
  empty,
  detail,
  extra,
  reloadKey,
}: {
  load: (offset: number) => Promise<Person[]>;
  me: string;
  empty: React.ReactNode;
  detail?: (p: Person) => string | null;
  extra?: (p: Person, remove: () => void) => React.ReactNode;
  reloadKey?: string;
}) {
  const [items, setItems] = useState<Person[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError("");
    load(0)
      .then((list) => {
        if (!alive) return;
        setItems(list);
        setMore(list.length === PEOPLE_PAGE);
      })
      .catch((err: unknown) => alive && setError(errorText(err)));
    return () => {
      alive = false;
    };
    // `load` muda a cada render de quem chama; `reloadKey` diz quando a lista é outra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  async function loadMore() {
    if (!items || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await load(items.length);
      setItems((cur) => [...(cur ?? []), ...next.filter((p) => !(cur ?? []).some((c) => c.id === p.id))]);
      setMore(next.length === PEOPLE_PAGE);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoadingMore(false);
    }
  }

  if (error && !items) {
    return (
      <p className="auth-error groups-error" role="alert">
        {error}
      </p>
    );
  }
  if (!items) return <PeopleSkeleton />;
  if (items.length === 0) return <>{empty}</>;

  const update = (next: Person) => setItems((cur) => cur?.map((p) => (p.id === next.id ? { ...p, ...next } : p)) ?? null);
  return (
    <>
      <ul className="people-list">
        {items.map((p) => (
          <li key={p.id}>
            <PersonRow
              person={p}
              me={me}
              detail={detail?.(p)}
              onChange={update}
              extra={extra?.(p, () => setItems((cur) => cur?.filter((x) => x.id !== p.id) ?? null))}
            />
          </li>
        ))}
      </ul>
      {more ? (
        <div className="shelf-more">
          <button type="button" className="btn" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Ver mais"}
          </button>
        </div>
      ) : null}
    </>
  );
}

export function PeopleSkeleton() {
  return (
    <ul className="people-list" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="people-row is-skeleton" />
      ))}
    </ul>
  );
}

export function PeopleEmpty({ icon, title, text, children }: { icon: React.ReactNode; title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="groups-empty">
      <span className="groups-empty-icon">{icon}</span>
      <strong>{title}</strong>
      {text ? <p>{text}</p> : null}
      {children ? <div className="groups-empty-actions">{children}</div> : null}
    </div>
  );
}

/** Sem API, sem conta ou sem a liberação da comunidade: o aviso no lugar da tela. */
export function PeopleBlocked({ text }: { text: string | null }) {
  return (
    <div className="home groups-page people-page">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
        <span className="wordmark">Pessoas</span>
      </nav>
      {text ? (
        <PeopleEmpty icon={GIcon.users} title="Pessoas" text={text.replace("conversar nos grupos", "seguir outros leitores")} />
      ) : (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando…
        </div>
      )}
    </div>
  );
}
