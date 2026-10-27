import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Página nova começa do topo. Sem isso, o navegador mantém a rolagem da página anterior: quem
 * tocava em "Biblioteca pública" no rodapé caía no meio da biblioteca. Voltar (POP) não mexe,
 * para o navegador devolver a pessoa onde ela estava.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== "POP") window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  return null;
}
