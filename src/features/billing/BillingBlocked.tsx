import { Link } from "react-router-dom";
import { useConfirm } from "../../components/ConfirmDialog";
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
  const { confirm, dialog } = useConfirm();
  const trialEnded = status.status === "trialing";
  // Cobrança pendente se resolve trocando o cartão (em "Minha assinatura" → portal); um checkout
  // novo criaria uma segunda assinatura.
  const pastDue = status.status === "past_due";

  async function askLogout() {
    if (
      await confirm({
        title: "Sair da conta?",
        message: "Você precisará entrar de novo para continuar lendo neste aparelho.",
        confirmLabel: "Sair",
        danger: true,
      })
    ) {
      onLogout();
    }
  }

  return (
    <div className="home">
      <header className="home-nav">
        <span className="wordmark">
          <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
          <span className="wordmark-text">Storyverse</span>
        </span>
      </header>
      <section className="shelf billing-blocked">
        <div className="shelf-head">
          <span className="eyebrow">Assinatura</span>
          <h1>{trialEnded ? "Seu teste grátis terminou" : "Sua assinatura não está ativa"}</h1>
          <p>
            Situação atual: <strong>{billingStatusLabel(status.status)}</strong>
            {status.accessUntil
              ? ` · acesso ${new Date(status.accessUntil).getTime() < Date.now() ? "terminou em" : "até"} ${billingDate(status.accessUntil)}`
              : ""}
            .
          </p>
        </div>
        <div className="profile-card billing-blocked-card">
          <p>
            {pastDue
              ? "O último pagamento não passou e o acesso está suspenso. Atualize o cartão para reativar a assinatura. Seus livros, progresso e conversas continuam guardados."
              : "Para voltar a ler, conversar com os personagens e usar a estante, assine o plano mensal no cartão ou pague um período com Pix. Seus livros, progresso e conversas continuam guardados."}
          </p>
          <div className="billing-actions">
            {pastDue ? (
              <Link className="btn btn-primary btn-lg" to="/conta/assinatura">
                Atualizar cartão
              </Link>
            ) : (
              <Link className="btn btn-primary btn-lg" to="/assinar">
                Assinar o Storyverse
              </Link>
            )}
            {pastDue ? null : (
              <Link className="btn" to="/conta/assinatura">
                Minha assinatura
              </Link>
            )}
            <button type="button" className="btn" onClick={() => void askLogout()}>
              Sair
            </button>
          </div>
          <p className="muted">
            {pastDue
              ? "Já trocou o cartão? O Stripe pode levar alguns segundos para avisar o servidor."
              : "Já pagou? O Stripe pode levar alguns segundos para avisar o servidor. Abra “Minha assinatura” para conferir."}
          </p>
        </div>
      </section>
      {dialog}
    </div>
  );
}
