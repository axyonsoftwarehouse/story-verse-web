import { NavLink } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import { CatalogSection } from "./CatalogSection";
import { CollectionsSection } from "./CollectionsSection";
import { ImportsSection } from "./ImportsSection";
import { SubmissionsModeration } from "./SubmissionsModeration";

/**
 * Área "Acervo" do painel: catálogo curado, envios da comunidade, coleções e importação em lote.
 */
export function AdminAcervo({
  session,
  tab,
}: {
  session: SupabaseSession;
  tab: "catalog" | "envios" | "colecoes" | "importacoes";
}) {
  return (
    <div className="moderation admin-acervo">
      <header className="moderation-head">
        <h1>Acervo</h1>
      </header>

      <nav className="segmented acervo-tabs" aria-label="Seções do acervo">
        <NavLink to="/admin/acervo" end className={({ isActive }) => (isActive ? "is-on" : "")}>
          Catálogo
        </NavLink>
        <NavLink
          to="/admin/acervo/envios"
          className={({ isActive }) => (isActive ? "is-on" : "")}
        >
          Envios
        </NavLink>
        <NavLink
          to="/admin/acervo/colecoes"
          className={({ isActive }) => (isActive ? "is-on" : "")}
        >
          Coleções
        </NavLink>
        <NavLink
          to="/admin/acervo/importacoes"
          className={({ isActive }) => (isActive ? "is-on" : "")}
        >
          Importações
        </NavLink>
      </nav>

      {tab === "catalog" ? (
        <CatalogSection session={session} />
      ) : tab === "envios" ? (
        <SubmissionsModeration session={session} embedded />
      ) : tab === "colecoes" ? (
        <CollectionsSection session={session} />
      ) : (
        <ImportsSection session={session} />
      )}
    </div>
  );
}
