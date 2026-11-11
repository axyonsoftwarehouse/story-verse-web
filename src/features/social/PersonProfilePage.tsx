import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import "../../App.css";
import "../groups/groups.css";
import "./social.css";
import { useStoredSession } from "../auth/useStoredSession";
import { hueOf, useGroupsGate } from "../groups/groupHelpers";
import { GIcon } from "../groups/groupIcons";
import { PersonFace } from "../groups/GroupParts";
import {
  booksOf,
  countLabel,
  errorText,
  followersOf,
  followingOf,
  getPerson,
  memberSince,
  setShowReading,
  type PersonProfile,
  type ProfileBook,
} from "../../lib/social";
import { prefersReducedMotion, useAnimatedNumber } from "../../lib/motion";
import { FollowButton, PeopleBlocked, PeopleEmpty, PeopleList, RelationBadge, SuggestionsStrip } from "./PeopleParts";
import { TransitionLink } from "../../components/TransitionLink";
import { useTransitionBack } from "../../lib/useTransitionBack";

type ListTab = "seguidores" | "seguindo";

/** Número que sobe a partir de 0 ao abrir o perfil (o `useAnimatedNumber` já respeita "reduzir movimento"). */
function CountUp({ value, delay }: { value: number; delay: number }) {
  // Entra como null e vira o valor logo depois: assim o número conta a partir de 0 ao abrir.
  const [target, setTarget] = useState<number | null>(null);
  useEffect(() => setTarget(value), [value]);
  return <>{(useAnimatedNumber(target, { from: 0, delay }) ?? 0).toLocaleString("pt-BR")}</>;
}

/** Perfil de um leitor: quem é, como se relaciona com a conta, o que lê, conquistas, presentes e rede. */
export function PersonProfilePage() {
  const { id = "" } = useParams();
  const { session, loading: sessionLoading } = useStoredSession();
  const gate = useGroupsGate(session, sessionLoading);
  const goBack = useTransitionBack("/pessoas");
  const [params, setParams] = useSearchParams();
  const list: ListTab = params.get("lista") === "seguindo" ? "seguindo" : "seguidores";
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [error, setError] = useState("");
  const me = session?.user.id ?? "";
  const networkRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!gate.ready || !id) return;
    let alive = true;
    setProfile(null);
    setError("");
    getPerson(id)
      .then((p) => alive && setProfile(p))
      .catch((err: unknown) => alive && setError(errorText(err, "Não foi possível abrir este perfil.")));
    return () => {
      alive = false;
    };
  }, [gate.ready, id]);

  if (!gate.ready) return <PeopleBlocked text={gate.blocked} />;

  const back = (
    <nav className="home-nav profile-nav">
      <button type="button" className="btn" onClick={goBack}>
        Voltar
      </button>
      <TransitionLink className="btn people-nav-link" to="/pessoas">
        {GIcon.users} Pessoas
      </TransitionLink>
    </nav>
  );

  if (error) {
    return (
      <div className="home groups-page people-page">
        {back}
        <PeopleEmpty icon={GIcon.users} title="Perfil indisponível" text={error} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="home groups-page people-page">
        {back}
        <section className="person-hero is-skeleton skeleton" aria-busy="true" aria-label="Carregando perfil" />
        <div className="person-skeleton-row" aria-hidden="true">
          <span className="skeleton" />
          <span className="skeleton" />
          <span className="skeleton" />
        </div>
      </div>
    );
  }

  const first = firstName(profile.name);
  const showList = (tab: ListTab) => {
    setParams(tab === "seguidores" ? {} : { lista: tab }, { replace: true });
    networkRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  };
  const stats: { key: string; value: number; label: string; tab?: ListTab }[] = [
    { key: "followers", value: profile.followers, label: profile.followers === 1 ? "seguidor" : "seguidores", tab: "seguidores" },
    { key: "following", value: profile.following, label: "seguindo", tab: "seguindo" },
    { key: "connections", value: profile.connections, label: profile.connections === 1 ? "conexão" : "conexões" },
  ];

  return (
    <div className="home groups-page people-page person-page" style={{ "--person-hue": hueOf(profile.id) } as CSSProperties}>
      {back}

      <section className="person-hero">
        <span className="person-hero-glow" aria-hidden="true" />
        <span className="person-avatar">
          <PersonFace id={profile.id} name={profile.name} avatar={profile.avatar} photo={profile.photo} size="lg" />
        </span>
        <div className="person-hero-text">
          <h1>
            {profile.name}
            {profile.is_me ? <small className="people-you"> (você)</small> : null}
          </h1>
          {profile.bio ? <p className="person-bio">{profile.bio}</p> : null}
          <p className="person-hero-meta">
            <RelationBadge person={profile} />
            <span>
              {memberSince(profile.member_since)}
              {!profile.is_me && profile.groups_in_common > 0
                ? ` · ${countLabel(profile.groups_in_common, "grupo em comum", "grupos em comum")}`
                : ""}
            </span>
          </p>
        </div>
        <div className="person-hero-action">
          {profile.is_me ? (
            <Link className="btn" to="/pessoas?aba=seguidores">
              Gerenciar seguidores
            </Link>
          ) : (
            <FollowButton
              person={profile}
              celebrate
              onChange={(next) =>
                setProfile((cur) => {
                  if (!cur) return cur;
                  // A resposta de seguir/deixar de seguir só traz a relação e os contadores.
                  const merged: PersonProfile = {
                    ...cur,
                    is_following: next.is_following,
                    follows_me: next.follows_me,
                    followers: "followers" in next ? next.followers : cur.followers,
                    connections: "connections" in next ? next.connections : cur.connections,
                  };
                  // Resposta otimista (antes da API): ajusta os contadores na mão.
                  if (next.is_following !== cur.is_following && merged.followers === cur.followers) {
                    merged.followers = cur.followers + (next.is_following ? 1 : -1);
                    merged.connections = cur.connections + (cur.follows_me ? (next.is_following ? 1 : -1) : 0);
                  }
                  return merged;
                })
              }
            />
          )}
        </div>

        <dl className="person-stats">
          {stats.map((s, i) =>
            s.tab ? (
              <button
                key={s.key}
                type="button"
                className={`person-stat ${list === s.tab ? "is-on" : ""}`}
                style={{ "--i": i } as CSSProperties}
                onClick={() => showList(s.tab!)}
                aria-pressed={list === s.tab}
              >
                <dt>{s.label}</dt>
                <dd>
                  <CountUp value={s.value} delay={250 + i * 120} />
                </dd>
              </button>
            ) : (
              <div key={s.key} className="person-stat" style={{ "--i": i } as CSSProperties} title="Pessoas que seguem e são seguidas de volta">
                <dt>{s.label}</dt>
                <dd>
                  <CountUp value={s.value} delay={250 + i * 120} />
                </dd>
              </div>
            ),
          )}
        </dl>
      </section>

      {profile.is_me ? <PrivacySwitch profile={profile} onChange={(show) => setProfile((cur) => (cur ? { ...cur, show_reading: show } : cur))} /> : null}

      {profile.reading_hidden ? (
        <section className="person-section person-hidden" style={{ "--i": 1 } as CSSProperties}>
          <span className="person-hidden-icon" aria-hidden="true">
            {GIcon.lock}
          </span>
          <div>
            <strong>{first} prefere manter as leituras só para si</strong>
            <p>Livros, conquistas e presentes não aparecem neste perfil.</p>
          </div>
        </section>
      ) : (
        <>
          <ReadingNumbers profile={profile} />
          <BooksSection profile={profile} first={first} />
          <BadgesSection profile={profile} first={first} />
          <GiftsSection profile={profile} />
        </>
      )}

      <h2 className="people-section-title person-network-title" ref={networkRef}>
        Rede
      </h2>
      <div className="segmented groups-tabs people-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={list === "seguidores"} className={list === "seguidores" ? "is-on" : ""} onClick={() => showList("seguidores")}>
          {profile.is_me ? "Seus seguidores" : `Seguem ${first}`}
        </button>
        <button type="button" role="tab" aria-selected={list === "seguindo"} className={list === "seguindo" ? "is-on" : ""} onClick={() => showList("seguindo")}>
          {profile.is_me ? "Você segue" : `${first} segue`}
        </button>
      </div>
      <PeopleList
        reloadKey={`${profile.id}-${list}`}
        load={(offset) => (list === "seguidores" ? followersOf(profile.id, offset) : followingOf(profile.id, offset))}
        me={me}
        empty={
          <PeopleEmpty
            icon={list === "seguidores" ? GIcon.users : GIcon.userPlus}
            title={list === "seguidores" ? "Ninguém segue este perfil ainda" : "Este perfil ainda não segue ninguém"}
          />
        }
      />
      {profile.is_me ? <SuggestionsStrip me={me} skipFollowers={list === "seguidores"} /> : null}
    </div>
  );
}

/** Próprio perfil: escolher se os outros veem leituras, conquistas e presentes. */
function PrivacySwitch({ profile, onChange }: { profile: PersonProfile; onChange: (show: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const on = profile.show_reading;
  return (
    <section className="person-section person-privacy" style={{ "--i": 0 } as CSSProperties}>
      <label className="person-switch">
        <input
          type="checkbox"
          role="switch"
          checked={on}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.checked;
            setBusy(true);
            setError("");
            onChange(next);
            void setShowReading(next)
              .catch((err: unknown) => {
                onChange(!next);
                setError(errorText(err, "Não foi possível salvar agora."));
              })
              .finally(() => setBusy(false));
          }}
        />
        <span className="person-switch-track" aria-hidden="true" />
        <span className="person-switch-text">
          <strong>Mostrar minhas leituras no perfil</strong>
          <small>{on ? "Quem abre seu perfil vê seus livros, conquistas e presentes." : "Só você vê seus livros, conquistas e presentes."}</small>
        </span>
      </label>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function ReadingNumbers({ profile }: { profile: PersonProfile }) {
  const s = profile.stats ?? {};
  const finished = Math.max(profile.reading_counts?.finished ?? 0, s.finishedBooks ?? 0);
  const hours = Math.floor((s.totalMinutes ?? 0) / 60);
  const items = [
    { key: "finished", icon: "📚", value: finished, label: finished === 1 ? "livro lido" : "livros lidos" },
    { key: "hours", icon: "⏳", value: hours, label: hours === 1 ? "hora lendo" : "horas lendo" },
    { key: "streak", icon: "🔥", value: s.bestStreak ?? 0, label: "dias seguidos (recorde)" },
    { key: "chat", icon: "💬", value: s.messagesSent ?? 0, label: "mensagens a personagens" },
  ].filter((i) => i.value > 0);
  if (items.length === 0) return null;
  return (
    <section className="person-section person-numbers" style={{ "--i": 1 } as CSSProperties} aria-label="Leitura em números">
      {items.map((item, i) => (
        <div key={item.key} className="person-number" style={{ "--i": i } as CSSProperties}>
          <span className="person-number-icon" aria-hidden="true">
            {item.icon}
          </span>
          <strong>
            <CountUp value={item.value} delay={450 + i * 110} />
          </strong>
          <small>{item.label}</small>
        </div>
      ))}
    </section>
  );
}

function BookCard({ book, index }: { book: ProfileBook; index: number }) {
  const [broken, setBroken] = useState(false);
  const stars = book.rating ? Math.round(book.rating) : 0;
  return (
    <li className={`person-book is-${book.status}`} style={{ "--i": index, "--h": hueOf(book.book_key) } as CSSProperties}>
      <span className="person-book-cover">
        {book.cover_url && !broken ? (
          <img src={book.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
        ) : (
          <span className="person-book-blank" aria-hidden="true">
            {book.title.slice(0, 1).toUpperCase()}
          </span>
        )}
        {book.status === "reading" && book.progress_percent != null ? (
          <span className="person-book-progress" aria-hidden="true">
            <span style={{ width: `${Math.max(4, book.progress_percent)}%` }} />
          </span>
        ) : null}
      </span>
      <strong title={book.title}>{book.title}</strong>
      {book.author ? <span className="person-book-author">{book.author}</span> : null}
      <span className="person-book-meta" aria-label={stars ? `Nota ${book.rating} de 5` : undefined}>
        {book.status === "reading" ? `Lendo${book.progress_percent != null ? ` · ${book.progress_percent}%` : ""}` : stars ? `${"★".repeat(stars)}${"☆".repeat(5 - stars)}` : "Lido"}
      </span>
    </li>
  );
}

function BooksSection({ profile, first }: { profile: PersonProfile; first: string }) {
  const [extra, setExtra] = useState<ProfileBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const total = (profile.reading_counts?.reading ?? 0) + (profile.reading_counts?.finished ?? 0);
  const books = [...profile.books, ...extra.filter((b) => !profile.books.some((x) => x.book_key === b.book_key))];
  const reading = books.filter((b) => b.status === "reading");
  const finished = books.filter((b) => b.status === "finished");

  if (books.length === 0) {
    return (
      <section className="person-section" style={{ "--i": 2 } as CSSProperties}>
        <h2 className="person-section-title">Estante</h2>
        <p className="person-empty-line">{profile.is_me ? "Os livros que você ler e terminar aparecem aqui." : `${first} ainda não tem livros na estante.`}</p>
      </section>
    );
  }

  async function more() {
    setLoading(true);
    try {
      const next = await booksOf(profile.id, books.length);
      setExtra((cur) => [...cur, ...next]);
      if (next.length < 24) setDone(true);
    } catch {
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="person-section" style={{ "--i": 2 } as CSSProperties}>
      {reading.length > 0 ? (
        <>
          <h2 className="person-section-title">
            Lendo agora <small>{profile.reading_counts.reading}</small>
          </h2>
          <ul className="person-books">
            {reading.map((b, i) => (
              <BookCard key={b.book_key} book={b} index={i} />
            ))}
          </ul>
        </>
      ) : null}
      {finished.length > 0 ? (
        <>
          <h2 className="person-section-title">
            Livros lidos <small>{profile.reading_counts.finished}</small>
          </h2>
          <ul className="person-books">
            {finished.map((b, i) => (
              <BookCard key={b.book_key} book={b} index={i + reading.length} />
            ))}
          </ul>
        </>
      ) : null}
      {books.length < total && !done ? (
        <div className="shelf-more">
          <button type="button" className="btn" onClick={() => void more()} disabled={loading}>
            {loading ? "Carregando…" : `Ver todos (${total})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

const BADGES_PREVIEW = 8;

function BadgesSection({ profile, first }: { profile: PersonProfile; first: string }) {
  const [all, setAll] = useState(false);
  const badges = profile.badges ?? [];
  if (badges.length === 0) {
    if (!profile.is_me && profile.badges_total === 0) return null;
    return (
      <section className="person-section" style={{ "--i": 3 } as CSSProperties}>
        <h2 className="person-section-title">Conquistas</h2>
        <p className="person-empty-line">{profile.is_me ? "Suas conquistas aparecem aqui quando você desbloquear a primeira." : `${first} ainda não desbloqueou conquistas.`}</p>
      </section>
    );
  }
  const shown = all ? badges : badges.slice(0, BADGES_PREVIEW);
  const pct = profile.badges_total > 0 ? Math.round((badges.length / profile.badges_total) * 100) : 100;
  return (
    <section className="person-section" style={{ "--i": 3 } as CSSProperties}>
      <h2 className="person-section-title">
        Conquistas <small>{profile.badges_total > 0 ? `${badges.length} de ${profile.badges_total}` : badges.length}</small>
      </h2>
      {profile.badges_total > 0 ? (
        <span className="person-badges-bar" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      <ul className="person-badges">
        {shown.map((b, i) => (
          <li key={b.id} className="person-badge" style={{ "--i": i } as CSSProperties} title={b.description ?? b.title}>
            <span className="person-badge-medal" aria-hidden="true">
              {b.emoji}
            </span>
            <strong>{b.title}</strong>
            {b.description ? <small>{b.description}</small> : null}
          </li>
        ))}
      </ul>
      {badges.length > BADGES_PREVIEW ? (
        <div className="shelf-more">
          <button type="button" className="btn" aria-expanded={all} onClick={() => setAll((v) => !v)}>
            {all ? "Mostrar menos" : `Ver todas (${badges.length})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function GiftsSection({ profile }: { profile: PersonProfile }) {
  const gifts = profile.gifts ?? [];
  if (gifts.length === 0) return null;
  const total = gifts.reduce((n, g) => n + g.total, 0);
  return (
    <section className="person-section" style={{ "--i": 4 } as CSSProperties}>
      <h2 className="person-section-title">
        Presentes recebidos <small>{total}</small>
      </h2>
      <ul className="person-gifts">
        {gifts.map((g, i) => (
          <li key={g.gift_id} className={`person-gift is-${g.rarity}`} style={{ "--i": i } as CSSProperties} title={g.name}>
            <span className="person-gift-icon" aria-hidden="true">
              {g.icon}
            </span>
            <span>
              <strong>{g.name}</strong>
              <small>× {g.total}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
