import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseSession } from "../../lib/auth";
import {
  brlFromCents,
  getBillingSubscription,
  getBillingSummary,
  listBillingSubscriptions,
  type AdminBillingSubscription,
  type BillingSummary,
} from "../../lib/adminBilling";
import { billingDate, billingStatusLabel, billingTone } from "../../lib/billing";

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function BillingSection({ session }: { session: SupabaseSession }) {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [rows, setRows] = useState<AdminBillingSubscription[] | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<AdminBillingSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    Promise.all([getBillingSummary(session), listBillingSubscriptions(session, { status, q })])
      .then(([nextSummary, nextRows]) => {
        if (!alive) return;
        setSummary(nextSummary);
        setRows(nextRows);
      })
      .catch((err) => {
        if (alive) setError(message(err, "Não foi possível carregar o financeiro."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session, status, q, version]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVersion((value) => value + 1);
  }

  async function open(row: AdminBillingSubscription) {
    setError("");
    try {
      setDetail(await getBillingSubscription(session, row.id));
    } catch (err) {
      setError(message(err, "Não foi possível abrir a assinatura."));
    }
  }

  return (
    <section className="shelf admin-billing">
      <div className="shelf-head">
        <div>
          <h1>Financeiro</h1>
          <p>
            Somente leitura. Cobrança, reembolso e cancelamento ficam no dashboard do Stripe; aqui
            só acompanhamos o estado.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => setVersion((value) => value + 1)}>
          Atualizar
        </button>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="dash-tiles billing-tiles">
          <article className="dash-card">
            <span className="dash-label">MRR</span>
            <strong>{brlFromCents(summary.mrr_cents)}</strong>
            <span className="dash-sub">assinaturas ativas</span>
          </article>
          <article className="dash-card">
            <span className="dash-label">Ativas</span>
            <strong>{summary.active}</strong>
            <span className="dash-sub">{summary.trialing} em teste</span>
          </article>
          <article className="dash-card">
            <span className="dash-label">Inadimplentes</span>
            <strong>{summary.past_due}</strong>
            <span className="dash-sub">{summary.failed} com falha de cobrança</span>
          </article>
          <article className="dash-card">
            <span className="dash-label">Novas / canceladas</span>
            <strong>
              {summary.new_count} / {summary.canceled_count}
            </strong>
            <span className="dash-sub">nos últimos 30 dias</span>
          </article>
        </div>
      ) : null}

      <form className="admin-search" onSubmit={search}>
        <label>
          Buscar assinante
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="E-mail completo ou parte dele"
            autoComplete="off"
          />
        </label>
        <label className="billing-status-filter">
          Situação
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todas</option>
            <option value="active">Ativas</option>
            <option value="trialing">Em teste</option>
            <option value="past_due">Pagamento pendente</option>
            <option value="canceled">Canceladas</option>
            <option value="unpaid">Não pagas</option>
          </select>
        </label>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Buscando…" : "Buscar"}
        </button>
      </form>

      {rows === null ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando assinaturas…
        </div>
      ) : rows.length === 0 ? (
        <p className="profile-empty">Nenhuma assinatura com esses filtros.</p>
      ) : (
        <ul className="admin-user-list">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="admin-user-row">
                <span>
                  <strong>{row.emailMasked}</strong>
                  <span className="muted">
                    {row.stripe_price_id || "plano"} · até {billingDate(row.current_period_end)}
                    {row.cancel_at_period_end ? " · cancela no fim" : ""}
                  </span>
                </span>
                <span className="admin-user-flags">
                  <span className={`status-chip ${billingTone(row.status)}`}>
                    {billingStatusLabel(row.status)}
                  </span>
                  <span className="muted">{brlFromCents(row.amount_cents)}</span>
                  <button type="button" className="btn" onClick={() => void open(row)}>
                    Abrir
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {detail ? (
        <div className="profile-card billing-detail-card">
          <div className="admin-audit-head">
            <h3>{detail.emailMasked}</h3>
            <button type="button" className="btn" onClick={() => setDetail(null)}>
              Fechar
            </button>
          </div>
          <dl className="billing-facts">
            <div>
              <dt>Situação</dt>
              <dd>{billingStatusLabel(detail.status)}</dd>
            </div>
            <div>
              <dt>Assinatura Stripe</dt>
              <dd className="admin-audit-meta">{detail.stripe_subscription_id}</dd>
            </div>
            <div>
              <dt>Período</dt>
              <dd>
                {billingDate(detail.current_period_start)} → {billingDate(detail.current_period_end)}
              </dd>
            </div>
            <div>
              <dt>Fatura</dt>
              <dd>{detail.latest_invoice_status || "—"}</dd>
            </div>
            <div>
              <dt>Cancelamento</dt>
              <dd>
                {detail.cancel_at_period_end
                  ? `no fim do período (${billingDate(detail.current_period_end)})`
                  : "não agendado"}
              </dd>
            </div>
          </dl>
          <p className="muted">
            Cobrança, cartão e reembolso são feitos no dashboard do Stripe. Nenhuma ação de
            cobrança existe neste painel.
          </p>
        </div>
      ) : null}
    </section>
  );
}
