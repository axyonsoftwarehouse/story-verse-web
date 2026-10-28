import { useEffect, useRef } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { visibleSections, type AdminSectionId } from "./adminSections";

/** Pendências por seção (ex.: denúncias no fórum), mostradas como contador ao lado do nome. */
export type AdminPending = Partial<Record<AdminSectionId, number>>;

/** No celular a lista rola de lado: marca as bordas que ainda têm aba escondida (o CSS esmaece). */
function markEdges(nav: HTMLElement) {
  const max = nav.scrollWidth - nav.clientWidth;
  nav.toggleAttribute("data-more-start", nav.scrollLeft > 2);
  nav.toggleAttribute("data-more-end", nav.scrollLeft < max - 2);
}

export function AdminNav({ roles, pending = {} }: { roles: string[]; pending?: AdminPending }) {
  const sections = visibleSections(roles);
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const pendingKey = sections.map((section) => pending[section.id] ?? 0).join(",");

  // A aba aberta fica sempre à vista (ex.: Auditoria, no fim da lista). Recalcula quando as abas
  // mudam de largura: a fonte carrega depois e os contadores chegam depois.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const focusActive = () => {
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (active && nav.scrollWidth > nav.clientWidth) {
        const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left;
        nav.scrollLeft += offset - (nav.clientWidth - active.offsetWidth) / 2;
      }
      markEdges(nav);
    };
    focusActive();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(focusActive);
    observer.observe(nav);
    for (const link of nav.children) observer.observe(link);
    return () => observer.disconnect();
  }, [pathname, pendingKey]);

  if (sections.length === 0) return null;
  return (
    <nav
      ref={navRef}
      className="admin-nav"
      aria-label="Seções do painel"
      onScroll={(event) => markEdges(event.currentTarget)}
    >
      {sections.map((section) => {
        const count = pending[section.id] ?? 0;
        return (
          <NavLink key={section.id} to={section.path} end={section.path === "/admin"}>
            <span>{section.label}</span>
            {count > 0 ? (
              <span className="admin-nav-badge" aria-label={`${count} pendente(s)`}>
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </NavLink>
        );
      })}
    </nav>
  );
}
