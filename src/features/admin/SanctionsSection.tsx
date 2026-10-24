import { useEffect, useState, type FormEvent } from "react";
import { useConfirm } from "../../components/ConfirmDialog";
import type { SupabaseSession } from "../../lib/auth";
import {
  listSanctions,
  revokeSanction,
  type AdminSanction,
  type SanctionFilters,
  type SanctionKind,
} from "../../lib/adminSanctions";
import { isSuperadmin } from "./adminSections";
import "./admin.css";

const KIND_LABEL: Record<SanctionKind, string> = {
  warning: "Aviso",
  suspension: "Suspensão",
  ban: "Banimento",
};

type Applied = Pick<SanctionFilters, "status" | "kind" | "q">;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar as sanções.";
}

function when(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function SanctionsSection({ session, roles }: { session: SupabaseSession; roles: string[] }) {
  const superadmin = isSuperadmin(roles);
  const { confirm, dialog } = useConfirm();
  const [status, setStatus] = useState<"active" | "revoked" | "all">("active");
  const [kind, setKind] = useState<SanctionKind | "">("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState<Applied>({ status: "active" });
  const [items, setItems] = useState<AdminSanction[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  function load(next: Applied, cursor?: string, append = false) {
    if (!append) {
      setLoading(true);
      setItems(null);
      setNextCursor(null);
    } else {
      setLoadingMore(true);
    }
    setError("");
    listSanctions(session, { ...next, cursor, limit: 20 })
      .then((page) => {
        setItems((current) => {
          if (!append) return page.items;
          const seen = new Set((current ?? []).map((item) => item.id));
          return [...(current ?? []), ...page.items.filter((item) => !seen.has(item.id))];
        });
        setNextCursor(page.nextCursor);
      })
      .catch((err) => setError(message(err)))
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }

  useEffect(() => {
    setApplied({ status: "active" });
    load({ status: "active" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Applied = { status, kind, q: q.trim() };
    setApplied(next);
    load(next);
  }

  function clear() {
    setStatus("active");
    setKind("");
    setQ("");
    setApplied({ status: "active" });
    load({ status: "active" });
  }

  function more() {
    if (!nextCursor || loadingMore) return;
    load(applied, nextCursor, true);
  }

  async function revoke(sanction: AdminSanction) {
    const ok = await confirm({
      title: "Revogar sanção?",
      message: `${KIND_LABEL[sanction.kind]} de ${sanction.userName}: ${sanction.reason ?? "sem motivo registrado"}.`,
      confirmLabel: "Revogar",
      danger: true,
    });
    if (!ok) return;
    try {
      await revokeSanction(session, sanction.id);
      load(applied);
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <section className="shelf">
      <div className="shelf-head">
        <div>
          <h1>Sanções</h1>
          <p className="muted">Avisos, suspensões e banimentos das contas.</p>
        </div>
      </div>

      <form className="admin-search" onSubmit={submit}>
        <label>
          Buscar conta
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="UUID, e-mail ou parte do nome"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Buscando…" : "Filtrar"}
        </button>
      </form>

      <div className="admin-filters">
        <label>
          Situação
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "active" | "revoked" | "all")}
          >
            <option value="active">Ativas</option>
            <option value="revoked">Revogadas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label>
          Tipo
          <select value={kind} onChange={(event) => setKind(event.target.value as SanctionKind | "")}>
            <option value="">Todos</option>
            <option value="warning">Aviso</option>
            <option value="suspension">Suspensão</option>
            <option value="ban">Banimento</option>
          </select>
        </label>
        <button type="button" className="btn" onClick={clear} disabled={loading}>
          Limpar
        </button>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando sanções…
        </div>
      ) : items && items.length > 0 ? (
        <ul className="admin-sanction-list">
          {items.map((sanction) => (
            <li key={sanction.id} className="admin-sanction-row">
              <span>
                <strong>{sanction.userName}</strong>
                <span className="muted">{sanction.emailMasked}</span>
                <span>
                  <span className={`status-chip ${sanction.kind === "warning" ? "" : "is-rejected"}`}>
                    {KIND_LABEL[sanction.kind]}
                  </span>
                </span>
                <span>{sanction.reason || "Sem motivo registrado."}</span>
                <span className="muted">
                  Aplicada em {when(sanction.createdAt)}
                  {sanction.createdByName ? ` por ${sanction.createdByName}` : ""}
                </span>
                {sanction.expiresAt ? <span className="muted">Até {when(sanction.expiresAt)}</span> : null}
                {sanction.revokedAt ? (
                  <span className="muted">
                    Revogada em {when(sanction.revokedAt)}
                    {sanction.revokedByName ? ` por ${sanction.revokedByName}` : ""}
                  </span>
                ) : null}
              </span>
              {superadmin && !sanction.revokedAt ? (
                <button type="button" className="btn" onClick={() => void revoke(sanction)}>
                  Revogar
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="profile-empty">Nenhuma sanção com esses filtros.</p>
      )}

      {nextCursor ? (
        <div className="catalog-pager">
          <button type="button" className="btn" onClick={more} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </button>
        </div>
      ) : null}

      {dialog}
    </section>
  );
}
