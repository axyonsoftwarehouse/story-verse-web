import { Link } from "react-router-dom";
import "../../App.css";

export function ForumHome() {
  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/">
          Voltar
        </Link>
      </nav>
      <section className="shelf">
        <div className="shelf-head">
          <h1>Comunidade</h1>
        </div>
        <div className="profile-card">
          <div>
            <strong>Fórum em construção</strong>
            <span>
              Tópicos por livro, categorias gerais, spoiler, denúncias e moderação chegam na fase 2.
            </span>
          </div>
          <Link className="btn" to="/">
            Continuar lendo
          </Link>
        </div>
      </section>
    </div>
  );
}
