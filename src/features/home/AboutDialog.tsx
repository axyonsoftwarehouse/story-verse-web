import { useEffect } from "react";
import { Icon } from "../../components/Icon";

export function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sobre-title"
      >
        <header className="about-dialog-head">
          <div>
            <span className="eyebrow">Sobre o Storyverse</span>
            <h2 id="sobre-title">Entre na história. Converse com quem vive nela.</h2>
          </div>
          <button type="button" className="auth-close" onClick={onClose} aria-label="Fechar sobre">
            {Icon.close}
          </button>
        </header>
        <div className="about-copy">
          <p className="about-lead">
            Enquanto você lê, os personagens do livro conversam com você num chat ao lado da página.
          </p>
          <ol className="about-steps">
            <li>
              <strong>Escolha um livro</strong>
              <span>Um livro do acervo ou um EPUB, PDF ou TXT seu.</span>
            </li>
            <li>
              <strong>Leia no seu ritmo</strong>
              <span>O progresso fica salvo, inclusive no celular e offline.</span>
            </li>
            <li>
              <strong>Converse com quem vive nele</strong>
              <span>Pergunte a Sherlock, provoque Drácula, ouça Isaura.</span>
            </li>
          </ol>
          <div className="about-rules">
            <p>
              <strong>Sem spoilers.</strong> Os personagens só sabem o que você já leu.
            </p>
            <p>
              <strong>O livro é o original.</strong> A IA dá voz aos personagens, mas não muda a
              história.
            </p>
          </div>
          <p className="about-sub">Também dá para</p>
          <ul className="about-features">
            <li>Ouvir em voz alta</li>
            <li>Ler no modo noturno ou sépia</li>
            <li>Destacar trechos</li>
            <li>Ver o significado de palavras</li>
            <li>Criar metas de leitura</li>
            <li>Compartilhar citações</li>
          </ul>
        </div>
        <footer className="about-foot">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Começar a ler
          </button>
        </footer>
      </section>
    </div>
  );
}
