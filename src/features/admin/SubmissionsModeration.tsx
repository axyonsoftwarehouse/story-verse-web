import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { SupabaseSession } from "../../lib/auth";
import {
  findOpenLibraryCover,
  lookupPublication,
  type PublicationInfo,
} from "../../lib/bookCovers";
import {
  changeSubmissionCover,
  deleteSubmission,
  listSubmissions,
  reviewSubmission,
  rightsLabel,
  type Submission,
} from "../../lib/community";
import { prepareImage } from "../../lib/profileMedia";
import { SubmissionPreview } from "./SubmissionPreview";

const LIKELY_PROTECTED_AFTER = 1955;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function pagesOf(chars: number | null): string {
  if (!chars) return "";
  const n = Math.max(1, Math.round(chars / 1800));
  return `~${n} ${n === 1 ? "página" : "páginas"}`;
}

function RightsAlert({
  title,
  author,
  onProtected,
}: {
  title: string;
  author?: string | null;
  onProtected?: (flag: boolean) => void;
}) {
  const [info, setInfo] = useState<PublicationInfo | null | undefined>(undefined);
  const callback = useRef(onProtected);
  callback.current = onProtected;

  useEffect(() => {
    let alive = true;
    void lookupPublication(title, author ?? "").then((result) => {
      if (!alive) return;
      setInfo(result);
      callback.current?.(Boolean(result && result.year > LIKELY_PROTECTED_AFTER));
    });
    return () => {
      alive = false;
    };
  }, [title, author]);

  if (info === undefined) {
    return <p className="rights-alert is-checking">Conferindo a obra na Open Library…</p>;
  }
  if (!info) {
    return (
      <p className="rights-alert is-unknown">
        Não encontramos esta obra na Open Library. Confira os direitos antes de aprovar.
      </p>
    );
  }
  const by = info.authors.slice(0, 2).join(", ");
  if (info.year > LIKELY_PROTECTED_AFTER) {
    return (
      <p className="rights-alert is-danger" role="alert">
        ⚠️ <strong>Possível obra protegida:</strong> “{info.title}”
        {by ? `, de ${by},` : ""} foi publicada em {info.year}. Obras recentes quase sempre têm
        direitos autorais — só aprove com autorização do autor ou da editora.
      </p>
    );
  }
  return (
    <p className="rights-alert is-ok">
      “{info.title}”{by ? `, de ${by},` : ""} foi publicada em {info.year}: pode ser domínio público
      (confira a data de morte do autor: mais de 70 anos).
    </p>
  );
}

export function SubmissionsModeration({
  session,
  embedded = false,
}: {
  session: SupabaseSession;
  /** Dentro da área "Acervo", o cabeçalho e as abas são da página que envolve. */
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [pending, setPending] = useState<Submission[] | null>(null);
  const [approved, setApproved] = useState<Submission[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);
  const [coverBusyId, setCoverBusyId] = useState<string | null>(null);
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [authorized, setAuthorized] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<Submission | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    Promise.all([listSubmissions(session, "pending"), listSubmissions(session, "approved")])
      .then(([p, a]) => {
        setPending(p);
        setApproved(a);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Não foi possível carregar os envios."),
      );
  }, [session]);

  async function approve(s: Submission) {
    if (flagged[s.id] && !authorized[s.id]) {
      return setError(
        "Obra provavelmente protegida: confirme que tem autorização do autor ou da editora antes de aprovar.",
      );
    }
    setBusyId(s.id);
    setError("");
    try {
      const cover =
        s.cover_url ??
        (await findOpenLibraryCover(s.title, s.author ?? "", s.language).catch(() => undefined));
      const updated = await reviewSubmission(session, s.id, "approved", undefined, cover ?? null);
      setPending((list) => list?.filter((x) => x.id !== s.id) ?? null);
      setApproved((list) => [updated, ...(list ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aprovar.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(s: Submission, note: string) {
    if (!note.trim()) return setError("Escreva o motivo da recusa: quem enviou vai ver.");
    setBusyId(s.id);
    setError("");
    try {
      await reviewSubmission(session, s.id, "rejected", note);
      setPending((list) => list?.filter((x) => x.id !== s.id) ?? null);
      setRejecting(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível recusar.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeCover(s: Submission, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCoverBusyId(s.id);
    setError("");
    try {
      const updated = await changeSubmissionCover(session, s, await prepareImage(file, "book"));
      const swap = (list: Submission[] | null) =>
        list?.map((item) => (item.id === s.id ? updated : item)) ?? null;
      setPending(swap);
      setApproved(swap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível trocar a capa.");
    } finally {
      setCoverBusyId(null);
    }
  }

  async function remove(s: Submission) {
    if (!window.confirm(`Tirar “${s.title}” do acervo? O arquivo também será apagado.`)) return;
    setBusyId(s.id);
    setError("");
    try {
      await deleteSubmission(session, s);
      setApproved((list) => list?.filter((x) => x.id !== s.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover.");
    } finally {
      setBusyId(null);
    }
  }

  const list = tab === "pending" ? pending : approved;

  return (
    <div className="moderation">
      {!embedded ? (
        <header className="moderation-head">
          <span className="eyebrow">Admin</span>
          <h1>Moderação do acervo</h1>
          <p>
            Aprove só o que pode ser distribuído: domínio público, obra do próprio autor ou licença
            livre. Na dúvida, recuse.
          </p>
        </header>
      ) : null}

      <div className="segmented moderation-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "pending"}
          className={tab === "pending" ? "is-on" : ""}
          onClick={() => setTab("pending")}
        >
          Em análise{pending ? ` (${pending.length})` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "approved"}
          className={tab === "approved" ? "is-on" : ""}
          onClick={() => setTab("approved")}
        >
          Publicados{approved ? ` (${approved.length})` : ""}
        </button>
      </div>

      {error ? (
        <p className="auth-error moderation-error" role="alert">
          {error}
        </p>
      ) : null}

      {list === null && !error ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando envios…
        </div>
      ) : list && list.length === 0 ? (
        <p className="profile-empty moderation-empty">
          {tab === "pending"
            ? "Nenhum envio esperando análise. 🎉"
            : "Nenhum livro publicado ainda."}
        </p>
      ) : (
        <ul className="submission-list">
          {list?.map((s) => (
            <li key={s.id} className="profile-card moderation-item">
              <div className="moderation-body">
                <div className="moderation-cover">
                  <div className="cover">
                    {s.cover_url ? (
                      <img className="cover-photo is-loaded" src={s.cover_url} alt="" loading="lazy" />
                    ) : (
                      <div className="cover-frame">
                        <span className="cover-title">{s.title}</span>
                        <span className="cover-author">{s.author || "Autor não informado"}</span>
                      </div>
                    )}
                  </div>
                  <label className={`btn moderation-cover-btn ${coverBusyId === s.id ? "is-disabled" : ""}`}>
                    {coverBusyId === s.id ? "Enviando…" : "Trocar capa"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => void changeCover(s, event)}
                      disabled={coverBusyId === s.id}
                    />
                  </label>
                </div>

                <div className="submission-main">
                  <strong>{s.title}</strong>
                  <span>
                    {s.author || "Autor não informado"} ·{" "}
                    {s.language === "en" ? "Inglês" : "Português"}
                    {s.char_count ? ` · ${pagesOf(s.char_count)}` : ""}
                  </span>
                  <span>
                    Enviado por {s.submitter_name || "leitor"} em {formatDate(s.created_at)}
                    {s.reviewed_at && tab === "approved"
                      ? ` · publicado em ${formatDate(s.reviewed_at)}`
                      : ""}
                  </span>
                  <p className="moderation-rights">
                    <strong>{rightsLabel(s.rights)}</strong>
                    {s.rights_note ? ` — ${s.rights_note}` : " — sem justificativa"}
                  </p>
                  <RightsAlert
                    title={s.title}
                    author={s.author}
                    onProtected={(flag) => setFlagged((map) => ({ ...map, [s.id]: flag }))}
                  />
                  {tab === "pending" && flagged[s.id] ? (
                    <label className="rights-confirm">
                      <input
                        type="checkbox"
                        checked={Boolean(authorized[s.id])}
                        onChange={(event) =>
                          setAuthorized((map) => ({ ...map, [s.id]: event.target.checked }))
                        }
                      />
                      <span>
                        Tenho autorização por escrito do autor ou da editora para distribuir esta
                        obra no Storyverse.
                      </span>
                    </label>
                  ) : null}
                  {s.characters ? (
                    <p className="submission-note">
                      Personagens: {s.characters.split("\n").filter(Boolean).join(", ")}
                    </p>
                  ) : null}
                </div>
              </div>

              {rejecting?.id === s.id ? (
                <div className="moderation-reject">
                  <textarea
                    value={rejecting.note}
                    onChange={(event) => setRejecting({ id: s.id, note: event.target.value })}
                    rows={2}
                    maxLength={500}
                    placeholder="Motivo (quem enviou vai ver). Ex.: obra ainda tem direitos autorais."
                    autoFocus
                  />
                  <div className="moderation-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setRejecting(null)}
                      disabled={busyId === s.id}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn profile-logout"
                      onClick={() => void reject(s, rejecting.note)}
                      disabled={busyId === s.id}
                    >
                      {busyId === s.id ? "Recusando…" : "Recusar envio"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="moderation-actions">
                  <button type="button" className="btn" onClick={() => setPreview(s)}>
                    Ler
                  </button>
                  {tab === "pending" ? (
                    <>
                      <button
                        type="button"
                        className="btn profile-logout"
                        onClick={() => setRejecting({ id: s.id, note: "" })}
                        disabled={busyId === s.id}
                      >
                        Recusar
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => void approve(s)}
                        disabled={busyId === s.id || (flagged[s.id] && !authorized[s.id])}
                        title={
                          flagged[s.id] && !authorized[s.id]
                            ? "Confirme a autorização para aprovar"
                            : undefined
                        }
                      >
                        {busyId === s.id ? "Aprovando…" : "Aprovar"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn profile-logout"
                      onClick={() => void remove(s)}
                      disabled={busyId === s.id}
                    >
                      {busyId === s.id ? "Removendo…" : "Tirar do acervo"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {preview ? (
        <SubmissionPreview session={session} submission={preview} onClose={() => setPreview(null)} />
      ) : null}
    </div>
  );
}
