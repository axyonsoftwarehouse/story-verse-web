import { Link } from "react-router-dom";
import { billingDate, billingStatusLabel, type SubscriptionSnapshot } from "../../lib/billing";
import "./billing.css";

/** Tela cheia quando o servidor nega acesso por assinatura. */
export function BillingBlocked({
  status,
  onLogout,
}: {
  status: SubscriptionSnapshot;
  onLogout: () => void;
}) {
  const trialEnded = status.status === "trialing";
  return (
    <div className="home">
      <section className="shelf billing-blocked">
        <div className="shelf-head">
          <span className="eyebrow">Assinatura</span>
          <h1>{trialEnded ? "Seu teste grátis terminou" : "Sua assinatura não está ativa"}</h1>
          <p>
            Situação atual: <strong>{billingStatusLabel(status.status)}</strong>
            {status.accessUntil ? ` · acesso até ${billingDate(status.accessUntil)}` : ""}.
          </p>
        </div>
        <div className="profile-card billing-blocked-card">
          <p>
            Para voltar a ler, conversar com os personagens e usar a estante, assine o plano mensal.
            Seus livros, progresso e conversas continuam guardados.
          </p>
          <div className="billing-actions">
            <Link className="btn btn-primary btn-lg" to="/assinar">
              Assinar o Storyverse
            </Link>
            <Link className="btn" to="/conta/assinatura">
              Minha assinatura
            </Link>
            <button type="button" className="btn" onClick={onLogout}>
              Sair
            </button>
          </div>
          <p className="muted">
            Já pagou? O Stripe pode levar alguns segundos para avisar o servidor. Abra “Minha
            assinatura” e atualize o status.
          </p>
        </div>
      </section>
    </div>
  );
}
