import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useStoredSession } from "../features/auth/useStoredSession";
import { loginHref } from "../lib/loginReturn";
import "./siteTopBar.css";

/**
 * Topo das subpáginas (biblioteca, audiolivros, assinatura, páginas legais). Quem chega por link
 * direto vê a marca, o caminho para os livros e como entrar ou criar conta, em vez de só um
 * botão "Voltar" (U3 da revisão de 09/11).
 */
export function SiteTopBar({
  back,
  children,
}: {
  /** Volta contextual (ex.: da ficha do livro para a biblioteca), abaixo do topo. */
  back?: { to: string; label: string };
  /** Ações extras para quem já entrou (ex.: "Minha assinatura"). */
  children?: ReactNode;
}) {
  const { session, loading } = useStoredSession();
  const { pathname } = useLocation();
  return (
    <>
      <nav className="home-nav site-topbar" aria-label="Navegação do site">
        <Link className="wordmark site-topbar-brand" to="/" aria-label="Storyverse: página inicial">
          <img className="wordmark-mark" src="/icons/icon.svg" alt="" aria-hidden="true" />
          <span className="wordmark-text">Storyverse</span>
        </Link>
        <div className="site-topbar-actions">
          <NavLink className="site-topbar-link" to="/biblioteca" end>
            Livros
          </NavLink>
          <NavLink className="site-topbar-link" to="/ouvir" end>
            Áudio
          </NavLink>
          {session ? (
            children
          ) : loading ? null : (
            <>
              <Link className="btn nav-login" to={loginHref(pathname)}>
                Entrar
              </Link>
              <Link className="btn btn-primary nav-register" to={loginHref(pathname, "register")}>
                Criar conta
              </Link>
            </>
          )}
        </div>
      </nav>
      {back ? (
        <Link className="site-topbar-back" to={back.to}>
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      ) : null}
    </>
  );
}
