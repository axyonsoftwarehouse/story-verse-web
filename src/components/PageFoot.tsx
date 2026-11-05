import { Link } from "react-router-dom";
import { LEGAL_HOLDER } from "../features/legal/holder";

/**
 * Rodapé das telas internas (grupos, pessoas, perfil, estante): o mesmo visual do rodapé da
 * página inicial, mais enxuto. Fecha a tela em vez de deixar um vazio escuro no fim.
 */
export function PageFoot() {
  return (
    <footer className="home-foot page-foot">
      <div className="foot-brand">
        <span className="wordmark foot-wordmark">
          <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
          Storyverse
        </span>
        <p>Leitura que conversa com você.</p>
      </div>
      <nav className="foot-cols" aria-label="Links do rodapé">
        <div className="foot-col">
          <Link className="foot-link" to="/">
            Início
          </Link>
          <Link className="foot-link" to="/biblioteca">
            Biblioteca pública
          </Link>
          <Link className="foot-link" to="/grupos">
            Grupos
          </Link>
        </div>
        <div className="foot-col">
          <Link className="foot-link" to="/termos">
            Termos de uso
          </Link>
          <Link className="foot-link" to="/privacidade">
            Privacidade
          </Link>
        </div>
      </nav>
      <div className="home-credit">
        <span>© {new Date().getFullYear()} Storyverse</span>
        <span>
          Desenvolvido por <strong>Axyon Software House</strong>
          <span className="home-credit-sep" aria-hidden="true">
            {" "}
            ·{" "}
          </span>
          <span className="home-credit-holder">{LEGAL_HOLDER}</span>
        </span>
      </div>
    </footer>
  );
}
