import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import { getCatalog, setFeature, type FeatureCatalogEntry } from "../../lib/adminFeatures";
import {
  getUser,
  revokeSessions,
  setRole,
  type AdminRole,
  type AdminUserDetail,
} from "../../lib/adminUsers";
import { isSuperadmin } from "./adminSections";

const ROLE_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  moderator: "Moderador",
  support: "Suporte",
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar a conta.";
}

function when(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function AccountDetail({
  session,
  roles,
}: {
  session: SupabaseSession;
  roles: string[];
}) {
  const { id = "" } = useParams();
  const superadmin = isSuperadmin(roles);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setDetail(null);
    getUser(session, id)
      .then((result) => {
        if (alive) setDetail(result);
      })
      .catch((err) => {
        if (alive) setError(message(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    if (superadmin) {
      getCatalog(session)
        .then((rows) => {
          if (alive) setCatalog(rows);
        })
        .catch((err) => {
          if (alive) setError(message(err));
        });
    } else {
      setCatalog([]);
    }
    return () => {
      alive = false;
    };
  }, [session, id, superadmin]);

  const own = detail !== null && detail.id === session.user.id;

  async function toggleRole(role: AdminRole, on: boolean) {
    if (!detail || busy) return;
    if (!on && !window.confirm(`Tirar o papel ${ROLE_LABEL[role]} de ${detail.name}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await setRole(session, detail.id, role, on);
      setDetail({ ...detail, roles: result.roles });
      setNotice(on ? "Papel concedido." : "Papel retirado.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFeature(feature: string, on: boolean) {
    if (!detail || busy) return;
    if (!on && !window.confirm(`Desligar ${feature} para ${detail.name}?`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await setFeature(session, detail.id, feature, on);
      setDetail({
        ...detail,
        features: on
          ? [...new Set([...detail.features, feature])]
          : detail.features.filter((item) => item !== feature),
      });
      setNotice(on ? "Feature ligada." : "Feature desligada.");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!detail || busy) return;
    if (
      !window.confirm(
        `Encerrar todas as sessões de ${detail.name}? A pessoa precisará entrar de novo em todos os aparelhos.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await revokeSessions(session, detail.id);
      setDetail({ ...detail, activeSessions: 0 });
      setNotice(`${result.revoked} sessões encerradas.`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyId() {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.id);
      setNotice("UUID copiado.");
    } catch {
      setError("Não foi possível copiar o UUID.");
    }
  }

  if (loading) {
    return (
      <div className="page-status">
        <span className="spinner" aria-hidden="true" />
        Carregando conta…
      </div>
    );
  }

  if (error && !detail) {
    return (
      <section className="shelf">
        <p className="auth-error" role="alert">
          {error}
        </p>
        <Link className="btn" to="/admin/contas">
          Voltar para contas
        </Link>
      </section>
    );
  }

  if (!detail) return null;

  return (
    <section className="shelf admin-account">
      <div className="shelf-head">
        <Link className="btn" to="/admin/contas">
          Voltar
        </Link>
        <h1>{detail.name}</h1>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="auth-global-notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="profile-card profile-account">
        <div className="profile-account-row">
          <span>Nome</span>
          <strong>{detail.name}</strong>
        </div>
        <div className="profile-account-row">
          <span>E-mail</span>
          <span>
            {detail.email}{" "}
            {!detail.emailConfirmed ? <span className="status-chip">não confirmado</span> : null}
          </span>
        </div>
        <div className="profile-account-row">
          <span>UUID</span>
          <span>
            <code>{detail.id}</code>{" "}
            <button type="button" className="btn" onClick={() => void copyId()}>
              Copiar
            </button>
          </span>
        </div>
        <div className="profile-account-row">
          <span>Criada em</span>
          <span>{when(detail.createdAt)}</span>
        </div>
        <div className="profile-account-row">
          <span>Último login</span>
          <span>{when(detail.lastSignInAt)}</span>
        </div>
        <div className="profile-account-row">
          <span>Sessões ativas</span>
          <span>{detail.activeSessions}</span>
        </div>
        <div className="profile-account-row">
          <span>Papéis</span>
          <span>
            {detail.roles.length === 0
              ? "sem papel"
              : detail.roles.map((role) => (
                  <span className="status-chip is-approved" key={role}>
                    {ROLE_LABEL[role] ?? role}
                  </span>
                ))}
          </span>
        </div>
      </div>

      {!own ? (
        <div className="profile-card">
          <div className="profile-account-row">
            <span>Encerrar todas as sessões</span>
            <button type="button" className="btn" onClick={() => void revoke()} disabled={busy}>
              Encerrar sessões
            </button>
          </div>
        </div>
      ) : null}

      {superadmin && !own ? (
        <div className="profile-card">
          <div className="shelf-head">
            <h2>Papéis</h2>
          </div>
          <p className="muted">Só Moderador e Suporte. Superadmin continua somente por script.</p>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={detail.roles.includes("moderator")}
              disabled={busy || (!detail.roles.includes("moderator") && !detail.emailConfirmed)}
              onChange={(event) => void toggleRole("moderator", event.target.checked)}
            />
            Moderador
          </label>
          <label className="admin-toggle">
            <input
              type="checkbox"
              checked={detail.roles.includes("support")}
              disabled={busy || (!detail.roles.includes("support") && !detail.emailConfirmed)}
              onChange={(event) => void toggleRole("support", event.target.checked)}
            />
            Suporte
          </label>
          {detail.roles.includes("superadmin") ? (
            <p>
              <span className="status-chip is-approved">Superadmin</span>
            </p>
          ) : null}
          {!detail.emailConfirmed ? (
            <p className="muted">Confirme o e-mail antes de conceder um papel.</p>
          ) : null}
        </div>
      ) : null}

      {superadmin && !own ? (
        <div className="profile-card">
          <div className="shelf-head">
            <h2>Features</h2>
          </div>
          {catalog.length === 0 ? (
            <p className="muted">Nenhuma feature conhecida.</p>
          ) : (
            catalog.map((entry) => (
              <label className="admin-toggle" key={entry.feature}>
                <input
                  type="checkbox"
                  checked={detail.features.includes(entry.feature)}
                  disabled={busy}
                  onChange={(event) => void toggleFeature(entry.feature, event.target.checked)}
                />
                {entry.feature}
                <span className="muted">{entry.enabledCount} conta(s)</span>
              </label>
            ))
          )}
        </div>
      ) : null}

      {detail.recentAudit !== null ? (
        <div className="profile-card">
          <div className="shelf-head">
            <h2>Últimas ações</h2>
          </div>
          {detail.recentAudit.length === 0 ? (
            <p className="muted">Nenhuma ação registrada.</p>
          ) : (
            <ul className="admin-audit-list">
              {detail.recentAudit.map((entry, index) => (
                <li key={index}>
                  <strong>{typeof entry.action === "string" ? entry.action : "ação"}</strong>
                  <span className="muted">
                    {typeof entry.actorName === "string" ? entry.actorName : "script na VPS"} ·{" "}
                    {typeof entry.createdAt === "string" ? when(entry.createdAt) : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
