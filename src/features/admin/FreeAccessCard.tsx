import { useEffect, useState } from "react";
import type { SupabaseSession } from "../../lib/auth";
import {
  createBillingGrant,
  grantExpiresAt,
  listBillingGrants,
  revokeBillingGrant,
  type BillingGrant,
} from "../../lib/adminBilling";
import { useConfirm } from "../../components/ConfirmDialog";

const PRESETS = [
  { value: "", label: "Sem prazo" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
];

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function day(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(
    new Date(value),
  );
}

/**
 * Acesso grátis (superadmin): libera o app sem cobrança para família, testadores e fundadores.
 * A equipe já tem acesso pelo papel, então o cartão só explica isso para ela.
 */
export function FreeAccessCard({
  session,
  userId,
  userName,
  staff,
}: {
  session: SupabaseSession;
  userId: string;
  userName: string;
  staff: boolean;
}) {
  const [grants, setGrants] = useState<BillingGrant[] | null>(null);
  const [reason, setReason] = useState("");
  const [preset, setPreset] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let alive = true;
    setGrants(null);
    listBillingGrants(session, userId)
      .then((rows) => {
        if (alive) setGrants(rows);
      })
      .catch((err) => {
        if (alive) {
          setGrants([]);
          setError(message(err, "Não foi possível carregar o acesso grátis."));
        }
      });
    return () => {
      alive = false;
    };
  }, [session, userId]);

  const active = grants?.find((grant) => grant.active) ?? null;
  const past = grants?.filter((grant) => !grant.active) ?? [];

  async function give(event: React.FormEvent) {
    event.preventDefault();
    const text = reason.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await createBillingGrant(session, { userId, reason: text, expiresAt: grantExpiresAt(preset) });
      setGrants(await listBillingGrants(session, userId));
      setReason("");
      setPreset("");
      setNotice("Acesso grátis concedido.");
    } catch (err) {
      setError(message(err, "Não foi possível conceder o acesso."));
    } finally {
      setBusy(false);
    }
  }

  async function takeBack(grant: BillingGrant) {
    if (busy) return;
    const ok = await confirm({
      title: "Retirar o acesso grátis?",
      message: `${userName} passa a precisar de assinatura para usar o app.`,
      confirmLabel: "Retirar",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await revokeBillingGrant(session, grant.id);
      setGrants(await listBillingGrants(session, userId));
      setNotice("Acesso grátis retirado.");
    } catch (err) {
      setError(message(err, "Não foi possível retirar o acesso."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="profile-card">
      <div className="shelf-head">
        <div>
          <h2>Acesso grátis</h2>
          <p className="muted">Libera o app sem assinatura, para família, testes e fundadores. Nunca gera cobrança.</p>
        </div>
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

      {grants === null ? (
        <p className="muted">Carregando…</p>
      ) : active ? (
        <div className="admin-sanction-row">
          <span>
            <span className="status-chip is-approved">Ativo</span>
            <strong>{active.reason}</strong>
            <span className="muted">
              {active.expires_at ? `Até ${day(active.expires_at)}` : "Sem prazo"} · concedido em{" "}
              {day(active.created_at)}
              {active.created_by_name ? ` por ${active.created_by_name}` : ""}
            </span>
          </span>
          <button type="button" className="btn" onClick={() => void takeBack(active)} disabled={busy}>
            Retirar
          </button>
        </div>
      ) : staff ? (
        <p className="muted">Esta conta é da equipe e já usa o app sem assinatura.</p>
      ) : (
        <form className="admin-grant-form" onSubmit={(event) => void give(event)}>
          <label>
            Motivo
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={200}
              placeholder="Ex.: família, testador, fundador"
              required
              disabled={busy}
            />
          </label>
          <label>
            Validade
            <select value={preset} onChange={(event) => setPreset(event.target.value)} disabled={busy}>
              {PRESETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy || !reason.trim()}>
            {busy ? "Concedendo…" : "Dar acesso grátis"}
          </button>
        </form>
      )}

      {past.length > 0 ? (
        <details className="admin-grant-history">
          <summary>Histórico ({past.length})</summary>
          <ul className="admin-sanction-list">
            {past.map((grant) => (
              <li key={grant.id} className="admin-sanction-row">
                <span>
                  <strong>{grant.reason}</strong>
                  <span className="muted">
                    Concedido em {day(grant.created_at)}
                    {grant.created_by_name ? ` por ${grant.created_by_name}` : ""}
                    {grant.revoked_at
                      ? ` · retirado em ${day(grant.revoked_at)}${grant.revoked_by_name ? ` por ${grant.revoked_by_name}` : ""}`
                      : grant.expires_at
                        ? ` · venceu em ${day(grant.expires_at)}`
                        : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {dialog}
    </div>
  );
}
