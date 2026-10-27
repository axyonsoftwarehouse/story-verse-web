import { NavLink } from "react-router-dom";
import { visibleSections, type AdminSectionId } from "./adminSections";

/** Pendências por seção (ex.: denúncias no fórum), mostradas como contador ao lado do nome. */
export type AdminPending = Partial<Record<AdminSectionId, number>>;

export function AdminNav({ roles, pending = {} }: { roles: string[]; pending?: AdminPending }) {
  const sections = visibleSections(roles);
  if (sections.length === 0) return null;
  return (
    <nav className="admin-nav" aria-label="Seções do painel">
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
