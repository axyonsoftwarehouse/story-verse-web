import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import {
  featureName,
  getCatalog,
  setFeature,
  type FeatureCatalogEntry,
} from "../../lib/adminFeatures";
import {
  getUser,
  revokeSessions,
  setRole,
  type AdminRole,
  type AdminUserDetail,
} from "../../lib/adminUsers";
import { useConfirm } from "../../components/ConfirmDialog";
import { applySanction, revokeSanction, type AdminSanction, type SanctionKind } from "../../lib/adminSanctions";
import { isSuperadmin } from "./adminSections";
import { SanctionDialog } from "./SanctionDialog";

const SANCTION_LABEL: Record<SanctionKind, string> = {
  warning: "Aviso",
  suspension: "Suspens?o",
  ban: "Banimento",
};

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
  const { confirm, dialog } = useConfirm();
  const [sanctionOpen, setSanctionOpen] = useState(false);

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
  const sanctionList = detail?.sanctions ?? [];
  const staffTarget = detail?.roles.some((role) => ["superadmin", "moderator", "support"].includes(role)) ?? false;
  const canApplySanction = superadmin && !own && !staffTarget;

  async function toggleRole(role: AdminRole, on: boolean) {
    if (!detail || busy) return;
    if (!on && !(await confirm({
      title: `Tirar o papel ${ROLE_LABEL[role]}?`,
      message: `${detail.name} perde o papel ${ROLE_LABEL[role]} imediatamente.`,
      confirmLabel: "Tirar papel",
      danger: true,
    }))) return;
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
    if (!on && !(await confirm({
      title: `Desligar ${feature}?`,
      message: `${detail.name} deixa de usar esta feature imediatamente.`,
      confirmLabel: "Desligar",
      danger: true,
    }))) return;
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
      !(await confirm({
        title: "Encerrar todas as sessões?",
        message: `${detail.name} precisará entrar de novo em todos os aparelhos.`,
        confirmLabel: "Encerrar",
        danger: true,
      }))
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

  async function apply(input: { kind: SanctionKind; reason: string; expiresAt: string | null }) {
    if (!detail) return;
    const created = await applySanction(session, detail.id, input);
    setDetail({ ...detail, sanctions: [created, ...(detail.sanctions ?? [])] });
    setSanctionOpen(false);
    setNotice("Sanção aplicada.");
  }

  async function revokeSanctionRow(sanction: AdminSanction) {
    if (!detail) return;
    const ok = await confirm({
      title: "Revogar sanção?",
      message: `${SANCTION_LABEL[sanction.kind]} de ${detail.name}: ${sanction.reason ?? "sem motivo registrado"}.`,
      confirmLabel: "Revogar",
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await revokeSanction(session, sanction.id);
      setDetail({
        ...detail,
        sanctions: (detail.sanctions ?? []).map((item) => (item.id === updated.id ? updated : item)),
      });
      setNotice("Sanção revogada.");
    } catch (err) {
      setError(message(err));
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

      <section className="shelf">
        <div className="shelf-head">
          <div>
            <h2>Sanções</h2>
            <p className="muted">Avisos, suspensões e banimentos desta conta.</p>
          </div>
          {canApplySanction ? (
            <button type="button" className="btn btn-primary" onClick={() => setSanctionOpen(true)}>
              Aplicar sanção
            </button>
          ) : null}
        </div>

        {sanctionList.length === 0 ? (
          <p className="profile-empty">Nenhuma sanção registrada.</p>
        ) : (
          <ul className="admin-sanction-list">
            {sanctionList.map((sanction) => (
              <li key={sanction.id} className="admin-sanction-row">
                <span>
                  <span className={`status-chip ${sanction.kind === "warning" ? "" : "is-rejected"}`}>
                    {SANCTION_LABEL[sanction.kind]}
                  </span>
                  <strong>{sanction.reason || "Sem motivo registrado."}</strong>
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
                  <button type="button" className="btn" onClick={() => void revokeSanctionRow(sanction)}>
                    Revogar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

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
            <h2>Recursos em teste</h2>
          </div>
          {catalog.length === 0 ? (
            <p className="muted">Nenhum recurso em teste.</p>
          ) : (
            catalog.map((entry) => (
              <label className="admin-toggle" key={entry.feature}>
                <input
                  type="checkbox"
                  checked={entry.everyone || detail.features.includes(entry.feature)}
                  disabled={busy || entry.everyone}
                  onChange={(event) => void toggleFeature(entry.feature, event.target.checked)}
                />
                {featureName(entry.feature)}
                <span className="muted">
                  {entry.everyone ? "ligado para todas as contas" : `${entry.enabledCount} conta(s)`}
                </span>
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
      {sanctionOpen && detail ? (
        <SanctionDialog userName={detail.name} onClose={() => setSanctionOpen(false)} onApply={apply} />
      ) : null}
      {dialog}
    </section>
  );
}
