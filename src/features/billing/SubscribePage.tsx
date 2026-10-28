import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  billingStatusLabel,
  billingTone,
  fetchBillingPlans,
  startBillingCheckout,
  startPixCheckout,
  type SubscriptionPlan,
} from "../../lib/billing";
import { useStoredSession } from "../auth/useStoredSession";
import { useSubscription } from "./useSubscription";
import "./billing.css";

const DEFAULT_PLAN: SubscriptionPlan = {
  id: "storyverse",
  name: "Storyverse",
  priceLabel: "R$ 9,90",
  currency: "BRL",
  interval: "month",
  trialDays: 7,
};

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function SubscribePage() {
  const { session, loading } = useStoredSession();
  const { status, loading: statusLoading } = useSubscription(session);
  const [plan, setPlan] = useState<SubscriptionPlan>(DEFAULT_PLAN);
  const [params] = useSearchParams();
  const [busy, setBusy] = useState<"card" | "pix" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchBillingPlans()
      .then((result) => {
        if (alive && result.plans[0]) setPlan(result.plans[0]);
      })
      .catch(() => {
        // Mantém o preço padrão; o checkout continua sendo a fonte final.
      });
    return () => {
      alive = false;
    };
  }, []);

  async function subscribe(kind: "card" | "pix") {
    if (!session) return;
    setBusy(kind);
    setError("");
    try {
      const { url } = await (kind === "pix" ? startPixCheckout(session) : startBillingCheckout(session));
      window.location.assign(url);
    } catch (err) {
      setError(message(err, kind === "pix" ? "Não foi possível abrir o Pix." : "Não foi possível abrir o checkout."));
      setBusy(null);
    }
  }

  const cancelled = params.get("cancelado") === "1";
  const active = Boolean(status?.active);
  const pixDays = status?.pixDays ?? 30;
  const price = `${plan.priceLabel}/${plan.interval === "month" ? "mês" : plan.interval}`;

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
        {session ? (
          <Link className="btn" to="/conta/assinatura">
            Minha assinatura
          </Link>
        ) : null}
      </nav>

      <section className="shelf billing-hero">
        <div className="shelf-head">
          <span className="eyebrow">Assinatura</span>
          <h1>Leia sem limites por {price}</h1>
          <p>
            {plan.trialDays} dias grátis, sem cartão no começo. Depois do teste, é só cadastrar o
            cartão para continuar lendo e conversando com os personagens.
          </p>
        </div>

        {cancelled ? (
          <p className="billing-notice" role="status">
            Você pode assinar quando quiser. Seu acesso continua como estava.
          </p>
        ) : null}

        <div className="billing-plan">
          <div className="billing-plan-head">
            <span className="eyebrow">Plano {plan.name}</span>
            <strong>{price}</strong>
            <span className="muted">Cancele quando quiser pelo portal do Stripe.</span>
          </div>
          <ul className="billing-features">
            <li>Todo o acervo curado e a biblioteca pública</li>
            <li>Leitor com progresso, tipografia e voz</li>
            <li>Chat com personagens, sem spoiler</li>
            <li>Estante, metas, sequência e ranking</li>
            <li>{plan.trialDays} dias grátis sem cartão</li>
          </ul>
          <div className="billing-actions">
            {loading || statusLoading ? (
              <span className="page-status">
                <span className="spinner" aria-hidden="true" />
                Conferindo sua conta…
              </span>
            ) : !session ? (
              <Link className="btn btn-primary btn-lg" to="/?login=1&retorno=/assinar">
                Entrar para começar
              </Link>
            ) : active ? (
              <>
                <Link className="btn btn-primary btn-lg" to="/">
                  Continuar lendo
                </Link>
                <Link className="btn" to="/conta/assinatura">
                  Minha assinatura
                </Link>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={() => void subscribe("card")}
                  disabled={busy !== null}
                >
                  {busy === "card" ? "Abrindo checkout…" : "Começar teste grátis"}
                </button>
                {status?.pixAvailable ? (
                  <button type="button" className="btn btn-lg" onClick={() => void subscribe("pix")} disabled={busy !== null}>
                    {busy === "pix" ? "Abrindo Pix…" : `Pagar ${pixDays} dias com Pix — ${plan.priceLabel}`}
                  </button>
                ) : null}
              </>
            )}
          </div>
          {status?.pixAvailable && !active ? (
            <p className="muted billing-pix-hint">
              Com Pix você paga {pixDays} dias de uma vez e não há renovação automática: avisamos por e-mail
              antes de acabar.
            </p>
          ) : null}
          {status && !active ? (
            <p className="muted">
              Situação atual:{" "}
              <span className={`status-chip ${billingTone(status.status)}`}>
                {billingStatusLabel(status.status)}
              </span>
            </p>
          ) : null}
          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <p className="billing-fineprint">
          Pagamento pelo Stripe, no cartão ou no Pix. Nenhum dado de cartão ou do banco passa pelo Storyverse. O acesso é
          validado no servidor; cancelar mantém o acesso até o fim do período já pago. Ao assinar, você
          concorda com os <Link to="/termos">Termos de uso</Link> e a{" "}
          <Link to="/cancelamento">política de cancelamento e reembolso</Link>.
        </p>
      </section>
    </div>
  );
}
