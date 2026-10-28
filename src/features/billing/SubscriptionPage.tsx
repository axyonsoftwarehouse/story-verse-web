import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  billingDate,
  billingStatusLabel,
  billingTone,
  openBillingPortal,
  startPixCheckout,
} from "../../lib/billing";
import { useStoredSession } from "../auth/useStoredSession";
import { useSubscription } from "./useSubscription";
import "./billing.css";

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SubscriptionPage() {
  const { session, loading } = useStoredSession();
  const { status, loading: statusLoading, error, refresh } = useSubscription(session);
  const [params] = useSearchParams();
  const [busy, setBusy] = useState<"portal" | "pix" | null>(null);
  const [actionError, setActionError] = useState("");
  const ok = params.get("ok") === "1";

  useEffect(() => {
    if (!ok || !session) return;
    // O webhook pode levar alguns segundos; confere três vezes sem travar a tela.
    const timers = [1500, 4000, 8000].map((delay) => window.setTimeout(() => void refresh(), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [ok, session, refresh]);

  async function open(kind: "portal" | "pix") {
    if (!session) return;
    setBusy(kind);
    setActionError("");
    try {
      const { url } = await (kind === "pix" ? startPixCheckout(session) : openBillingPortal(session));
      window.location.assign(url);
    } catch (err) {
      setActionError(message(err, kind === "pix" ? "Não foi possível abrir o Pix." : "Não foi possível abrir o portal do Stripe."));
      setBusy(null);
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

  if (!session) {
    return (
      <div className="home">
        <nav className="home-nav profile-nav">
          <Link className="btn" to="/">
            Voltar
          </Link>
        </nav>
        <section className="shelf billing-hero">
          <div className="profile-card billing-card">
            <h2>Entre para ver sua assinatura</h2>
            <p className="muted">O estado da assinatura fica na sua conta.</p>
            <Link className="btn btn-primary" to="/?login=1&retorno=/conta/assinatura">
              Entrar
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const active = Boolean(status?.active);
  const trial = status?.status === "trialing";
  const pastDue = status?.status === "past_due";
  const pix = status?.reason === "pix";
  const pixDays = status?.pixDays ?? 30;
  // Pix soma dias para quem já pagou com Pix e é a saída para quem está no teste sem cartão.
  const offerPix = Boolean(status?.pixAvailable) && (pix || trial);

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
        <Link className="btn" to="/assinar">
          Ver plano
        </Link>
      </nav>

      <section className="shelf billing-hero">
        <div className="shelf-head">
          <span className="eyebrow">Minha assinatura</span>
          <h1>Seu acesso ao Storyverse</h1>
          <p>Situação do seu plano e do pagamento.</p>
        </div>

        {ok && active ? (
          <p className="billing-notice is-ok" role="status">
            {pix ? "Pagamento com Pix confirmado. Seu acesso está liberado." : "Pagamento confirmado. Sua assinatura está ativa."}
          </p>
        ) : null}
        {ok && !active && !statusLoading ? (
          <p className="billing-notice" role="status">
            Recebemos o retorno do Stripe. O acesso pode levar alguns segundos para liberar —
            atualize abaixo.
          </p>
        ) : null}

        {statusLoading && !status ? (
          <div className="page-status">
            <span className="spinner" aria-hidden="true" />
            Consultando assinatura…
          </div>
        ) : (
          <div className="profile-card billing-card">
            <div className="billing-card-head">
              <div>
                <span className="eyebrow">Situação</span>
                <h2>{billingStatusLabel(pix ? "pix" : status?.status)}</h2>
              </div>
              <span className={`status-chip ${billingTone(status?.status)}`}>
                {active ? "Acesso liberado" : "Sem acesso"}
              </span>
            </div>

            <dl className="billing-facts">
              <div>
                <dt>Plano</dt>
                <dd>{pix ? `Pix — ${pixDays} dias` : status?.plan || "Storyverse"}</dd>
              </div>
              <div>
                <dt>Acesso até</dt>
                <dd>{billingDate(status?.accessUntil)}</dd>
              </div>
              {trial ? (
                <div>
                  <dt>Teste grátis até</dt>
                  <dd>{billingDate(status?.trialEnd)}</dd>
                </div>
              ) : null}
              {pix ? null : (
                <div>
                  <dt>Cancelamento</dt>
                  <dd>{status?.cancelAtPeriodEnd ? "Agendado para o fim do período" : "Não agendado"}</dd>
                </div>
              )}
            </dl>

            {trial ? (
              <p className="billing-hint">
                Você está no teste grátis. Adicione um cartão antes do fim para continuar sem
                interrupção{status?.pixAvailable ? ", ou pague com Pix" : ""}.
              </p>
            ) : null}
            {pix ? (
              <p className="billing-hint">
                O Pix não renova sozinho. Avisamos por e-mail antes do fim; pagar de novo antes soma{" "}
                {pixDays} dias ao que você já tem.
              </p>
            ) : null}
            {pastDue ? (
              <p className="billing-hint is-warning">
                Pagamento pendente. O acesso continua por alguns dias; atualize o cartão no portal
                para não perder a assinatura.
              </p>
            ) : null}
            {!active && !trial ? (
              <p className="billing-hint">
                Para voltar a ler, assine o plano mensal. Seus livros, progresso e conversas
                continuam guardados.
              </p>
            ) : null}

            <div className="billing-actions">
              {offerPix ? (
                <button type="button" className="btn btn-primary" onClick={() => void open("pix")} disabled={busy !== null}>
                  {busy === "pix" ? "Abrindo Pix…" : `Pagar ${pix ? "mais " : ""}${pixDays} dias com Pix`}
                </button>
              ) : null}
              {active && !pix && status?.portalAvailable ? (
                <button
                  type="button"
                  className={offerPix ? "btn" : "btn btn-primary"}
                  onClick={() => void open("portal")}
                  disabled={busy !== null}
                >
                  {busy === "portal" ? "Abrindo portal…" : "Gerenciar assinatura"}
                </button>
              ) : null}
              {!active ? (
                <Link className="btn btn-primary" to="/assinar">
                  Assinar agora
                </Link>
              ) : null}
              {active ? (
                <Link className="btn" to="/">
                  Ir para o início
                </Link>
              ) : null}
            </div>

            {status?.portalAvailable && !active ? (
              <p className="muted">
                Já tem cadastro no Stripe?{" "}
                <button type="button" className="link-btn" onClick={() => void open("portal")} disabled={busy !== null}>
                  Abrir portal
                </button>
              </p>
            ) : null}

            {actionError || error ? (
              <p className="auth-error" role="alert">
                {actionError || error}
              </p>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
