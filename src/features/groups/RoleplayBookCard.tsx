import { useCallback, useEffect, useState } from "react";
import type { ConfirmOptions } from "../../components/ConfirmDialog";
import { fetchRoleplayBook, startRoleplayBook, type Group } from "../../lib/groups";
import { addRoleplayBookToLibrary, type RoleplayBook } from "../../lib/roleplayBook";

/**
 * "Livro da história" de um roleplay: quem criou o grupo encerra e a IA reescreve tudo em
 * capítulos; cada membro leva o livro para a própria biblioteca. `refresh` muda quando chega
 * aviso de livro pronto/falhou pelo tempo real.
 */
export function RoleplayBookCard({
  group,
  confirm,
  refresh = 0,
  compact = false,
}: {
  group: Group;
  confirm?: (o: ConfirmOptions) => Promise<boolean>;
  refresh?: number;
  compact?: boolean;
}) {
  const [book, setBook] = useState<RoleplayBook | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const owner = group.my_role === "owner";

  const load = useCallback(() => {
    void fetchRoleplayBook(group.id)
      .then(setBook)
      .catch(() => setBook(null));
  }, [group.id]);

  useEffect(() => load(), [load, refresh]);

  // Enquanto escreve, confere de vez em quando (o aviso pelo tempo real também atualiza).
  useEffect(() => {
    if (book?.status !== "writing") return;
    const timer = window.setInterval(load, 8000);
    return () => window.clearInterval(timer);
  }, [book?.status, load]);

  async function start() {
    if (confirm) {
      const ok = await confirm({
        title: "Transformar a história em livro?",
        message:
          "A IA reescreve o roleplay em capítulos de prosa, mantendo o que aconteceu e as falas. Usa a sua cota de mensagens de IA (uma por capítulo, até 12). O grupo continua aberto.",
        confirmLabel: "Escrever o livro",
      });
      if (!ok) return;
    }
    setBusy(true);
    setError("");
    try {
      setBook(await startRoleplayBook(group.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível começar o livro.");
    } finally {
      setBusy(false);
    }
  }

  async function addToLibrary() {
    if (!book) return;
    setBusy(true);
    setError("");
    try {
      await addRoleplayBookToLibrary(book, group);
      setAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível adicionar à biblioteca.");
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    // No chat: só aparece quando o livro está pronto.
    if (book?.status !== "ready") return null;
    return (
      <div className="group-rp-book-banner" role="status">
        <span aria-hidden="true">📖</span>
        <span>
          <strong>Esta história virou livro!</strong> {book.chapters} {book.chapters === 1 ? "capítulo" : "capítulos"}.
        </span>
        <button type="button" className="group-text-btn" onClick={() => void addToLibrary()} disabled={busy || added}>
          {added ? "Na sua biblioteca ✓" : "Adicionar à biblioteca"}
        </button>
      </div>
    );
  }

  return (
    <div className="group-info-card group-rp-book">
      <span className="group-info-card-icon" aria-hidden="true">
        📖
      </span>
      <span>
        <strong>Livro da história</strong>
        {book?.status === "writing" ? (
          <small>✍️ A IA está escrevendo os capítulos… avisamos quando ficar pronto.</small>
        ) : book?.status === "ready" ? (
          <small>
            Pronto: “{book.title}”, {book.chapters} {book.chapters === 1 ? "capítulo" : "capítulos"}.
          </small>
        ) : book?.status === "failed" ? (
          <small>{book.error ?? "Não deu para escrever o livro."}</small>
        ) : (
          <small>Quando a história chegar ao fim, quem criou o grupo transforma tudo em livro.</small>
        )}
        {error ? <small className="group-rp-book-error">{error}</small> : null}
        <span className="group-rp-book-actions">
          {book?.status === "ready" ? (
            <button type="button" className="btn btn-primary" onClick={() => void addToLibrary()} disabled={busy || added}>
              {added ? "Na sua biblioteca ✓" : "Adicionar à minha biblioteca"}
            </button>
          ) : null}
          {owner && book?.status !== "writing" ? (
            <button type="button" className="btn" onClick={() => void start()} disabled={busy}>
              {book ? "Escrever de novo" : "Encerrar e virar livro"}
            </button>
          ) : null}
        </span>
      </span>
    </div>
  );
}
