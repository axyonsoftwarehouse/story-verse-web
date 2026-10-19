import { Link, useParams } from "react-router-dom";
import "../../App.css";

export function TopicPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="home">
      <nav className="home-nav profile-nav">
        <Link className="btn" to="/comunidade">
          Voltar para a comunidade
        </Link>
      </nav>
      <section className="shelf">
        <div className="shelf-head">
          <h1>Tópico</h1>
        </div>
        <div className="profile-card">
          <div>
            <strong>Tópico {id ?? "desconhecido"}</strong>
            <span>A página de discussão será implementada na fase 2.</span>
          </div>
          <Link className="btn" to="/comunidade">
            Ver comunidade
          </Link>
        </div>
      </section>
    </div>
  );
}
