import type { MouseEvent } from "react";
import { Link, useNavigate, type LinkProps } from "react-router-dom";
import { navigateWithTransition } from "../lib/motion";

/**
 * `<Link>` que troca de tela com transição (ver `navigateWithTransition`). Ctrl/⌘-clique, botão
 * do meio e abrir em nova aba continuam funcionando como link comum.
 */
export function TransitionLink({ to, onClick, back, ...rest }: LinkProps & { back?: boolean }) {
  const navigate = useNavigate();
  return (
    <Link
      {...rest}
      to={to}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target) return;
        e.preventDefault();
        navigateWithTransition(() => navigate(to), { back });
      }}
    />
  );
}
