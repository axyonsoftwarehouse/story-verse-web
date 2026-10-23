import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import { getOverview, type AdminOverview } from "../../lib/adminOverview";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a visão geral.";
}

function when(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function bytes(value: number | null): string {
  if (value === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(size);
  return `${number} ${units[unit]}`;
}

export function OverviewSection({ session }: { session: SupabaseSession }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setError("");
    getOverview(session)
      .then((result) => {
        if (alive) setOverview(result);
      })
      .catch((err) => {
        if (alive) setError(message(err));
      });
    return () => {
      alive = false;
    };
  }, [session]);

  if (error) {
    return (
      <p className="auth-error" role="alert">
        {error}
      </p>
    );
  }

  if (!overview) {
    return (
      <div className="page-status">
        <span className="spinner" aria-hidden="true" />
        Carregando…
      </div>
    );
  }

  return (
    <section className="shelf admin-overview">
      <div className="shelf-head">
        <h1>Visão geral</h1>
      </div>
      <div className="dash-tiles">
        {overview.moderation ? (
          <article className="dash-card">
            <div className="dash-card-head">
              <span className="dash-label">Moderação</span>
            </div>
            <div className="dash-tile">
              <strong>{overview.moderation.pendingSubmissions}</strong>
              <span>
                envios esperando ·{" "}
                <Link className="link-btn" to="/admin/moderacao/acervo">
                  revisar
                </Link>
              </span>
            </div>
            <div className="dash-tile">
              <strong>{overview.moderation.openReports}</strong>
              <span>
                denúncias abertas ·{" "}
                <Link className="link-btn" to="/admin/moderacao/forum">
                  ver fórum
                </Link>
              </span>
            </div>
          </article>
        ) : null}

        {overview.accounts ? (
          <article className="dash-card">
            <div className="dash-card-head">
              <span className="dash-label">Contas</span>
            </div>
            <div className="dash-tile">
              <strong>{overview.accounts.total}</strong>
              <span>contas no total</span>
            </div>
            <div className="dash-tile">
              <strong>{overview.accounts.newLast7Days}</strong>
              <span>novas nos últimos 7 dias</span>
            </div>
          </article>
        ) : null}

        {overview.features ? (
          <article className="dash-card">
            <div className="dash-card-head">
              <span className="dash-label">Features</span>
            </div>
            {Object.keys(overview.features).length === 0 ? (
              <p className="dash-sub">Nenhuma feature ligada.</p>
            ) : (
              Object.entries(overview.features).map(([feature, count]) => (
                <div className="dash-tile" key={feature}>
                  <strong>{count}</strong>
                  <span>{feature} ligada(s)</span>
                </div>
              ))
            )}
          </article>
        ) : null}

        {overview.backup ? (
          <article className={`dash-card${overview.backup.stale ? " is-alert" : ""}`}>
            <div className="dash-card-head">
              <span className="dash-label">Backup</span>
              {overview.backup.stale ? <span className="dash-sub">Backup atrasado</span> : null}
            </div>
            <div className="dash-tile">
              <strong>{overview.backup.status ?? "—"}</strong>
              <span>{when(overview.backup.finishedAt)}</span>
            </div>
            <div className="dash-tile">
              <strong>{bytes(overview.backup.sizeBytes)}</strong>
              <span>último tamanho</span>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
