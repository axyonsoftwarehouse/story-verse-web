import { useEffect, useState } from "react";
import { deleteSubmission, listSubmissions, type Submission } from "../../lib/community";
import { type SupabaseSession } from "../../lib/auth";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABELS: Record<Submission["status"], string> = {
  pending: "Em análise",
  approved: "Publicado",
  rejected: "Recusado",
};

/** Quantos envios aparecem de início e quantos a mais cada "Ver mais" mostra. */
const SUBMISSIONS_PAGE = 5;

/** Envios do próprio leitor, com o andamento de cada um (no perfil). */
export function MySubmissions({ session }: { session: SupabaseSession }) {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [visible, setVisible] = useState(SUBMISSIONS_PAGE);
  useEffect(() => {
    void listSubmissions(session, "mine").then(setItems).catch(() => setItems([]));
  }, [session]);

  async function withdraw(s: Submission) {
    if (!window.confirm(`Desistir de enviar “${s.title}”?`)) return;
    try {
      await deleteSubmission(session, s);
      setItems((list) => list?.filter((x) => x.id !== s.id) ?? null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Não foi possível desistir agora.");
    }
  }

  if (!items || items.length === 0) return null;
  return (
    <section className="shelf">
      <div className="shelf-head">
        <h2>Seus envios</h2>
        <p>
          Livros que você sugeriu para o acervo da comunidade
          {items.length > SUBMISSIONS_PAGE ? ` · ${items.length} no total` : ""}.
        </p>
      </div>
      <ul className="submission-list stagger">
        {items.slice(0, visible).map((s) => (
          <li key={s.id} className="profile-card submission">
            <div className="submission-main">
              <strong>{s.title}</strong>
              <span>
                {s.author || "Autor não informado"} · enviado em {formatDate(s.created_at)}
              </span>
              {s.status === "rejected" && s.review_note ? <p className="submission-note">Motivo: {s.review_note}</p> : null}
            </div>
            <span className={`status-chip is-${s.status}`}>{STATUS_LABELS[s.status]}</span>
            {s.status === "pending" ? (
              <button type="button" className="link-btn" onClick={() => void withdraw(s)}>
                Desistir
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {items.length > SUBMISSIONS_PAGE ? (
        <div className="shelf-more">
          {visible < items.length ? (
            <button type="button" className="btn" onClick={() => setVisible((v) => v + SUBMISSIONS_PAGE)}>
              Ver mais ({items.length - visible} {items.length - visible === 1 ? "restante" : "restantes"})
            </button>
          ) : (
            <button type="button" className="btn" onClick={() => setVisible(SUBMISSIONS_PAGE)}>
              Mostrar menos
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
