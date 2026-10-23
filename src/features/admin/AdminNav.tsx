import { NavLink } from "react-router-dom";
import { visibleSections } from "./adminSections";

export function AdminNav({ roles }: { roles: string[] }) {
  const sections = visibleSections(roles);
  if (sections.length === 0) return null;
  return (
    <nav className="admin-nav" aria-label="Seções do painel">
      {sections.map((section) => (
        <NavLink key={section.id} to={section.path} end={section.path === "/admin"}>
          {section.label}
        </NavLink>
      ))}
    </nav>
  );
}
