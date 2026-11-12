import { useEffect, useState } from "react";
import { cancelInvite, groupInvites, inviteCandidates, invitePerson, type InviteCandidate, type PendingInvite } from "../../lib/groups";
import { PersonFace } from "./GroupParts";
import { GIcon } from "./groupIcons";

/** Busca começa com 2 letras; espera a pessoa parar de digitar. */
export const INVITE_MIN_QUERY = 2;
const SEARCH_DELAY_MS = 300;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Algo deu errado. Tente de novo.";
}

/**
 * Quem administra convida pelo nome: procura a pessoa, manda o convite e ela aceita ou recusa
 * (aviso no sininho). Embaixo, os convites que ainda esperam resposta, com "Cancelar".
 */
export function InvitePeople({ groupId }: { groupId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InviteCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    groupInvites(groupId)
      .then((list) => alive && setPending(list))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [groupId]);

  const term = query.trim();
  useEffect(() => {
    if (term.length < INVITE_MIN_QUERY) {
      setResults(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      inviteCandidates(groupId, term)
        .then((list) => alive && setResults(list))
        .catch((err: unknown) => alive && setError(message(err)))
        .finally(() => alive && setSearching(false));
    }, SEARCH_DELAY_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [groupId, term]);

  const markInvited = (userId: string, invited: boolean) =>
    setResults((cur) => cur?.map((p) => (p.id === userId ? { ...p, invited } : p)) ?? cur);

  const invite = (person: InviteCandidate) => {
    setBusy(person.id);
    setError("");
    invitePerson(groupId, person.id)
      .then((list) => {
        setPending(list);
        markInvited(person.id, true);
      })
      .catch((err: unknown) => setError(message(err)))
      .finally(() => setBusy(null));
  };

  const cancel = (invite: PendingInvite) => {
    setBusy(invite.user_id);
    setError("");
    cancelInvite(groupId, invite.user_id)
      .then(() => {
        setPending((cur) => cur.filter((p) => p.user_id !== invite.user_id));
        markInvited(invite.user_id, false);
      })
      .catch((err: unknown) => setError(message(err)))
      .finally(() => setBusy(null));
  };

  return (
    <div className="group-info-card group-add-member group-invite-people">
      <span className="group-info-card-icon">{GIcon.users}</span>
      <span className="group-add-member-body">
        <strong>Convidar pessoas</strong>
        <small>Procure pelo nome. A pessoa recebe o convite e escolhe se quer entrar.</small>
        <span className="group-add-member-row">
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError("");
            }}
            placeholder="Nome da pessoa"
            aria-label="Procurar pessoa pelo nome"
            maxLength={80}
            autoComplete="off"
          />
        </span>

        {error ? (
          <small className="auth-error" role="alert">
            {error}
          </small>
        ) : null}

        {term.length >= INVITE_MIN_QUERY ? (
          searching && results === null ? (
            <small className="group-invite-hint" aria-live="polite">
              Procurando…
            </small>
          ) : results && results.length === 0 ? (
            <small className="group-invite-hint" aria-live="polite">
              Ninguém com esse nome. Confira a grafia ou tente o e-mail da conta.
            </small>
          ) : results ? (
            <ul className="group-invite-list" aria-label="Pessoas encontradas">
              {results.map((p) => (
                <li key={p.id}>
                  <PersonFace id={p.id} name={p.name} avatar={p.avatar} photo={p.photo} size="sm" />
                  <span className="group-invite-name">{p.name}</span>
                  {p.is_member ? (
                    <small className="group-invite-state">No grupo</small>
                  ) : p.invited ? (
                    <small className="group-invite-state is-sent">
                      {GIcon.check} Convidado
                    </small>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary is-compact"
                      disabled={busy === p.id}
                      onClick={() => invite(p)}
                      aria-label={`Convidar ${p.name}`}
                    >
                      Convidar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null
        ) : null}

        {pending.length > 0 ? (
          <>
            <small className="group-invite-subtitle">Esperando resposta · {pending.length}</small>
            <ul className="group-invite-list" aria-label="Convites esperando resposta">
              {pending.map((p) => (
                <li key={p.user_id}>
                  <PersonFace id={p.user_id} name={p.name} avatar={p.avatar} photo={p.photo} size="sm" />
                  <span className="group-invite-name">
                    {p.name}
                    <small>convite de {p.invited_by_name}</small>
                  </span>
                  <button
                    type="button"
                    className="group-text-btn"
                    disabled={busy === p.user_id}
                    onClick={() => cancel(p)}
                    aria-label={`Cancelar o convite de ${p.name}`}
                  >
                    Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </span>
    </div>
  );
}
