import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../../App.css";
import "../groups/groups.css";
import "./social.css";
import { useStoredSession } from "../auth/useStoredSession";
import { useGroupsGate } from "../groups/groupHelpers";
import { GIcon } from "../groups/groupIcons";
import { followersOf, followingOf, peopleSuggestions, removeFollower, searchPeople, type Person, errorText } from "../../lib/social";
import { PeopleBlocked, PeopleEmpty, PeopleList, PeopleSkeleton, PersonRow, SuggestionsStrip } from "./PeopleParts";
import { TransitionLink } from "../../components/TransitionLink";

type Tab = "sugestoes" | "seguindo" | "seguidores";
const TABS: { id: Tab; label: string }[] = [
  { id: "sugestoes", label: "Sugestões" },
  { id: "seguindo", label: "Seguindo" },
  { id: "seguidores", label: "Seguidores" },
];

/** "Pessoas": achar leitores pelo nome, sugestões dos grupos e a própria rede (seguindo/seguidores). */
export function PeoplePage() {
  const { session, loading: sessionLoading } = useStoredSession();
  const gate = useGroupsGate(session, sessionLoading);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get("aba")) ? params.get("aba") : "sugestoes") as Tab;
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const me = session?.user.id ?? "";

  if (!gate.ready) return <PeopleBlocked text={gate.blocked} />;

  return (
    <div className="home groups-page people-page">
      <nav className="home-nav profile-nav">
        <TransitionLink back className="btn" to="/grupos">
          Voltar
        </TransitionLink>
      </nav>

      <header className="groups-hero">
        <span className="groups-hero-icon">{GIcon.users}</span>
        <div>
          <span className="eyebrow">Comunidade</span>
          <h1>Pessoas</h1>
          <p>Siga outros leitores para acompanhar quem lê com você. Quando os dois se seguem, vocês viram conexão.</p>
        </div>
      </header>

      <form
        className="groups-search people-search"
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
          placeholder="Buscar leitor pelo nome"
          aria-label="Buscar pessoas pelo nome"
          maxLength={60}
        />
      </form>

      {query ? (
        <SearchResults query={query} me={me} />
      ) : (
        <>
          <div className="segmented groups-tabs people-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? "is-on" : ""}
                onClick={() => setParams(t.id === "sugestoes" ? {} : { aba: t.id }, { replace: true })}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === "sugestoes" ? <Suggestions me={me} /> : null}
          {tab === "seguindo" ? (
            <PeopleList
              reloadKey={`following-${me}`}
              load={(offset) => followingOf(me, offset)}
              me={me}
              empty={
                <PeopleEmpty icon={GIcon.userPlus} title="Você ainda não segue ninguém" text="Veja as sugestões ou busque um leitor pelo nome." />
              }
            />
          ) : null}
          {tab === "seguidores" ? (
            <PeopleList
              reloadKey={`followers-${me}`}
              load={(offset) => followersOf(me, offset)}
              me={me}
              empty={<PeopleEmpty icon={GIcon.users} title="Ninguém segue você ainda" text="Participe dos grupos: quem conversa com você costuma seguir de volta." />}
              extra={(p, remove) => <RemoveFollower person={p} onRemoved={remove} />}
            />
          ) : null}
          {tab !== "sugestoes" ? <SuggestionsStrip me={me} title="Sugestões para você" skipFollowers={tab === "seguidores"} /> : null}
        </>
      )}
    </div>
  );
}

function SearchResults({ query, me }: { query: string; me: string }) {
  const [items, setItems] = useState<Person[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setItems(null);
    setError("");
    searchPeople(query)
      .then((list) => alive && setItems(list))
      .catch((err: unknown) => alive && setError(errorText(err)));
    return () => {
      alive = false;
    };
  }, [query]);

  if (error) {
    return (
      <p className="auth-error groups-error" role="alert">
        {error}
      </p>
    );
  }
  if (!items) return <PeopleSkeleton />;
  if (query.length < 2) return <PeopleEmpty icon={GIcon.search} title="Digite pelo menos 2 letras do nome" />;
  if (items.length === 0) return <PeopleEmpty icon={GIcon.search} title={`Ninguém com “${query}” no nome`} text="Confira a grafia ou tente só o primeiro nome." />;
  return (
    <>
      <h2 className="people-section-title">Resultados para “{query}”</h2>
      <ul className="people-list stagger">
        {items.map((p) => (
          <li key={p.id}>
            <PersonRow person={p} me={me} onChange={(next) => setItems((cur) => cur?.map((x) => (x.id === next.id ? next : x)) ?? null)} />
          </li>
        ))}
      </ul>
    </>
  );
}

function Suggestions({ me }: { me: string }) {
  const [items, setItems] = useState<Person[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    peopleSuggestions()
      .then((list) => alive && setItems(list))
      .catch((err: unknown) => alive && setError(errorText(err)));
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <p className="auth-error groups-error" role="alert">
        {error}
      </p>
    );
  }
  if (!items) return <PeopleSkeleton />;
  if (items.length === 0) {
    return (
      <PeopleEmpty icon={GIcon.users} title="Sem sugestões por enquanto" text="Entre em grupos de leitura: as pessoas de lá aparecem aqui para você seguir.">
        <Link className="btn btn-primary" to="/grupos">
          Ver grupos
        </Link>
      </PeopleEmpty>
    );
  }
  return (
    <>
      <p className="people-hint">Quem segue você e quem está nos seus grupos.</p>
      <ul className="people-list stagger">
        {items.map((p) => (
          <li key={p.id}>
            <PersonRow
              person={p}
              me={me}
              detail={
                p.follows_me
                  ? null
                  : p.groups_in_common
                    ? `${p.groups_in_common} ${p.groups_in_common === 1 ? "grupo em comum" : "grupos em comum"}`
                    : null
              }
              onChange={(next) => setItems((cur) => cur?.map((x) => (x.id === next.id ? { ...x, ...next } : x)) ?? null)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

/** Tirar alguém dos próprios seguidores (a pessoa não é avisada). */
function RemoveFollower({ person, onRemoved }: { person: Person; onRemoved: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="group-icon-btn people-remove"
      disabled={busy}
      aria-label={`Remover ${person.name} dos seus seguidores`}
      title="Remover dos seguidores"
      onClick={() => {
        if (!window.confirm(`Remover ${person.name} dos seus seguidores? A pessoa não é avisada.`)) return;
        setBusy(true);
        void removeFollower(person.id)
          .then(onRemoved)
          .catch((err: unknown) => window.alert(errorText(err, "Não foi possível remover agora.")))
          .finally(() => setBusy(false));
      }}
    >
      {GIcon.close}
    </button>
  );
}
