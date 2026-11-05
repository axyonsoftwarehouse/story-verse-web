import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "../../App.css";
import "../groups/groups.css";
import "./social.css";
import { useStoredSession } from "../auth/useStoredSession";
import { useGroupsGate } from "../groups/groupHelpers";
import { GIcon } from "../groups/groupIcons";
import { PersonFace } from "../groups/GroupParts";
import { countLabel, followersOf, followingOf, getPerson, memberSince, type PersonProfile, errorText } from "../../lib/social";
import { FollowButton, PeopleBlocked, PeopleEmpty, PeopleList, RelationBadge } from "./PeopleParts";

type ListTab = "seguidores" | "seguindo";

/** Perfil de um leitor: quem é, como se relaciona com a conta, seguidores e quem ele segue. */
export function PersonProfilePage() {
  const { id = "" } = useParams();
  const { session, loading: sessionLoading } = useStoredSession();
  const gate = useGroupsGate(session, sessionLoading);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const list: ListTab = params.get("lista") === "seguindo" ? "seguindo" : "seguidores";
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [error, setError] = useState("");
  const me = session?.user.id ?? "";

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
      <button type="button" className="btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/pessoas"))}>
        Voltar
      </button>
      <Link className="btn people-nav-link" to="/pessoas">
        {GIcon.users} Pessoas
      </Link>
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
        <section className="person-hero is-skeleton" aria-busy="true" aria-label="Carregando perfil" />
      </div>
    );
  }

  const stats: { key: string; value: number; label: string; tab?: ListTab }[] = [
    { key: "followers", value: profile.followers, label: profile.followers === 1 ? "seguidor" : "seguidores", tab: "seguidores" },
    { key: "following", value: profile.following, label: "seguindo", tab: "seguindo" },
    { key: "connections", value: profile.connections, label: profile.connections === 1 ? "conexão" : "conexões" },
  ];

  return (
    <div className="home groups-page people-page">
      {back}

      <section className="person-hero">
        <PersonFace id={profile.id} name={profile.name} avatar={profile.avatar} photo={profile.photo} size="lg" />
        <div className="person-hero-text">
          <h1>
            {profile.name}
            {profile.is_me ? <small className="people-you"> (você)</small> : null}
          </h1>
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
              onChange={(next) =>
                setProfile((cur) => {
                  if (!cur) return cur;
                  const merged = { ...cur, ...next } as PersonProfile;
                  // Resposta otimista (antes da API): ajusta o contador na mão.
                  if (!("followers" in next) || next.followers === cur.followers) {
                    if (next.is_following !== cur.is_following) {
                      merged.followers = cur.followers + (next.is_following ? 1 : -1);
                      merged.connections = cur.connections + (cur.follows_me ? (next.is_following ? 1 : -1) : 0);
                    }
                  }
                  return merged;
                })
              }
            />
          )}
        </div>

        <dl className="person-stats">
          {stats.map((s) =>
            s.tab ? (
              <button
                key={s.key}
                type="button"
                className={`person-stat ${list === s.tab ? "is-on" : ""}`}
                onClick={() => setParams(s.tab === "seguidores" ? {} : { lista: s.tab! }, { replace: true })}
                aria-pressed={list === s.tab}
              >
                <dt>{s.label}</dt>
                <dd>{s.value.toLocaleString("pt-BR")}</dd>
              </button>
            ) : (
              <div key={s.key} className="person-stat" title="Pessoas que seguem e são seguidas de volta">
                <dt>{s.label}</dt>
                <dd>{s.value.toLocaleString("pt-BR")}</dd>
              </div>
            ),
          )}
        </dl>
      </section>

      <h2 className="people-section-title">
        {list === "seguidores" ? (profile.is_me ? "Seus seguidores" : `Quem segue ${firstName(profile.name)}`) : profile.is_me ? "Quem você segue" : `Quem ${firstName(profile.name)} segue`}
      </h2>
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
    </div>
  );
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
