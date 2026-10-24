import { NavLink } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import { CatalogSection } from "./CatalogSection";
import { SubmissionsModeration } from "./SubmissionsModeration";

/**
 * Área "Acervo" do painel: o catálogo curado (novo) e os envios da comunidade (a moderação que
 * já existia). Importação em lote e coleções entram quando a API tiver esses endpoints.
 */
export function AdminAcervo({
  session,
  tab,
}: {
  session: SupabaseSession;
  tab: "catalog" | "envios";
}) {
  return (
    <div className="moderation admin-acervo">
      <header className="moderation-head">
        <span className="eyebrow">Admin</span>
        <h1>Acervo</h1>
        <p>
          O catálogo público do Storyverse: cadastre e publique livros e aprove o que os leitores
          enviaram. Rascunhos e livros ocultos só aparecem aqui.
        </p>
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
      </nav>

      {tab === "catalog" ? (
        <CatalogSection session={session} />
      ) : (
        <SubmissionsModeration session={session} embedded />
      )}
    </div>
  );
}
