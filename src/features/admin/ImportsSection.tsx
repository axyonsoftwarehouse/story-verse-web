import { useEffect, useState, type ChangeEvent } from "react";
import type { SupabaseSession } from "../../lib/auth";
import {
  CATALOG_IMPORT_ACCEPT,
  MAX_IMPORT_BYTES,
  catalogDate,
  catalogImportFileName,
  catalogImportStatusLabel,
  fetchCatalogImportErrors,
  getCatalogImport,
  listCatalogImports,
  runCatalogImport,
  uploadCatalogImportArchive,
  type CatalogImportItem,
  type CatalogImportPreview,
  type CatalogImportRecord,
} from "../../lib/adminCatalog";

type Busy = "" | "preview" | "import" | "history";

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function importStatusLabel(status: string): string {
  if (status === "done") return "Concluída";
  if (status === "failed") return "Falhou";
  if (status === "running") return "Em andamento";
  return "Na fila";
}

function ItemTable({ items }: { items: CatalogImportItem[] }) {
  if (items.length === 0) return <p className="muted">Nenhuma linha no relatório.</p>;
  return (
    <div className="import-table-wrap">
      <table className="import-table">
        <thead>
          <tr>
            <th>Linha</th>
            <th>Arquivo</th>
            <th>Situação</th>
            <th>Mensagem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.line}-${index}`}>
              <td>{item.line ?? "—"}</td>
              <td>{catalogImportFileName(item)}</td>
              <td>
                <span className={`status-chip import-status is-${item.status}`}>
                  {catalogImportStatusLabel(item.status)}
                </span>
              </td>
              <td>{item.message ?? (item.bookKey ? `Publicado como ${item.bookKey}` : "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({
  result,
  preview,
}: {
  result: CatalogImportRecord | null;
  preview: CatalogImportPreview | null;
}) {
  const items = result?.items ?? preview?.items ?? [];
  const ready = items.filter((item) => item.status === "ok").length;
  const imported = items.filter((item) => item.status === "imported").length;
  const skipped = items.filter((item) => item.status === "skipped").length;
  const errors = items.filter((item) => item.status === "error").length;
  const total = result?.total ?? preview?.total ?? items.length;
  return (
    <ul className="import-summary">
      <li>
        <span>Linhas</span>
        <strong>{total}</strong>
      </li>
      <li>
        <span>{preview ? "Prontos" : "Importados"}</span>
        <strong>{result ? result.imported : preview ? ready : imported}</strong>
      </li>
      <li>
        <span>Pulados</span>
        <strong>{result ? result.skipped : skipped}</strong>
      </li>
      <li>
        <span>Erros</span>
        <strong>{errors}</strong>
      </li>
    </ul>
  );
}

export function ImportsSection({ session }: { session: SupabaseSession }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<{ path: string; fileName: string } | null>(null);
  const [preview, setPreview] = useState<CatalogImportPreview | null>(null);
  const [result, setResult] = useState<CatalogImportRecord | null>(null);
  const [history, setHistory] = useState<CatalogImportRecord[] | null>(null);
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listCatalogImports(session)
      .then((list) => {
        if (alive) setHistory(list);
      })
      .catch(() => {
        if (alive) setHistory([]);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (!picked.name.toLowerCase().endsWith(".zip")) {
      setError("Escolha um arquivo .zip com o metadata.csv e os livros.");
      return;
    }
    if (picked.size === 0) {
      setError("O arquivo ZIP está vazio.");
      return;
    }
    if (picked.size > MAX_IMPORT_BYTES) {
      setError("Pacote grande demais (máximo de 200 MB).");
      return;
    }
    setFile(picked);
    setUploaded(null);
    setPreview(null);
    setResult(null);
    setError("");
  }

  async function archive(): Promise<{ path: string; fileName: string } | null> {
    if (uploaded) return uploaded;
    if (!file) {
      setError("Escolha o arquivo ZIP da importação.");
      return null;
    }
    const next = await uploadCatalogImportArchive(session, file);
    setUploaded(next);
    return next;
  }

  async function check() {
    setBusy("preview");
    setError("");
    try {
      const uploadedFile = await archive();
      if (!uploadedFile) return;
      const response = await runCatalogImport(session, {
        archivePath: uploadedFile.path,
        fileName: uploadedFile.fileName,
        dryRun: true,
      });
      setPreview(response as CatalogImportPreview);
      setResult(null);
    } catch (err) {
      setError(message(err, "Não foi possível conferir o pacote."));
    } finally {
      setBusy("");
    }
  }

  async function execute() {
    setBusy("import");
    setError("");
    try {
      const uploadedFile = await archive();
      if (!uploadedFile) return;
      const response = await runCatalogImport(session, {
        archivePath: uploadedFile.path,
        fileName: uploadedFile.fileName,
        dryRun: false,
      });
      const record = response as CatalogImportRecord;
      setResult(record);
      setPreview(null);
      setHistory((current) => [record, ...(current ?? [])]);
    } catch (err) {
      setError(message(err, "Não foi possível importar o pacote."));
    } finally {
      setBusy("");
    }
  }

  async function openHistory(record: CatalogImportRecord) {
    setBusy("history");
    setError("");
    try {
      const detail = await getCatalogImport(session, record.id);
      setResult(detail);
      setPreview(null);
    } catch (err) {
      setError(message(err, "Não foi possível abrir a importação."));
    } finally {
      setBusy("");
    }
  }

  async function downloadErrors() {
    if (!result) return;
    try {
      const csv = await fetchCatalogImportErrors(session, result.id);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `importacao-${result.id}-erros.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(message(err, "Não foi possível baixar o CSV de erros."));
    }
  }

  const working = busy === "preview" || busy === "import";
  const shownResult = result;
  const items = shownResult?.items ?? preview?.items ?? [];

  return (
    <section className="shelf admin-catalog">
      <div className="shelf-head">
        <div>
          <h2>Importações</h2>
          <p>
            Suba um ZIP com <code>metadata.csv</code> e os livros (TXT, MD, EPUB ou PDF). A prévia
            mostra o que entraria antes de criar qualquer coisa.
          </p>
        </div>
      </div>

      <div className="profile-card import-step">
        <label className="catalog-file-pick">
          <span>Pacote da importação</span>
          <input type="file" accept={CATALOG_IMPORT_ACCEPT} onChange={pick} disabled={working} />
          <small className="muted">
            ZIP até 200 MB, no máximo 100 livros. O CSV precisa das colunas file e rights; título,
            autor e idioma são lidos do EPUB/PDF quando a coluna fica vazia.
          </small>
        </label>
        {file ? (
          <p className="catalog-file-summary">
            <strong>{file.name}</strong>
            <span className="muted">{megabytes(file.size)}</span>
          </p>
        ) : null}

        <div className="catalog-actions-bar">
          <button
            type="button"
            className="btn"
            onClick={() => void check()}
            disabled={working || !file}
          >
            {busy === "preview" ? "Conferindo…" : "Conferir prévia"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void execute()}
            disabled={working || !file}
          >
            {busy === "import" ? "Importando…" : "Importar agora"}
          </button>
        </div>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {preview || shownResult ? (
        <div className="profile-card import-report">
          <div className="admin-audit-head">
            <h3>{preview ? "Prévia da importação" : "Relatório da importação"}</h3>
            {shownResult ? (
              <button type="button" className="btn" onClick={() => void downloadErrors()}>
                Baixar CSV de erros
              </button>
            ) : null}
          </div>
          <Summary result={shownResult} preview={preview} />
          <ItemTable items={items} />
        </div>
      ) : null}

      <div className="profile-card import-history">
        <div className="admin-audit-head">
          <h3>Histórico</h3>
        </div>
        {history === null ? (
          <div className="page-status">
            <span className="spinner" aria-hidden="true" />
            Carregando…
          </div>
        ) : history.length === 0 ? (
          <p className="muted">Nenhuma importação ainda.</p>
        ) : (
          <ul className="admin-user-list">
            {history.map((record) => (
              <li key={record.id}>
                <div className="admin-user-row">
                  <span>
                    <strong>{record.file_name}</strong>
                    <span className="muted">
                      {catalogDate(record.created_at)} · {record.total} linhas ·{" "}
                      {record.imported} importados · {record.skipped} pulados
                    </span>
                  </span>
                  <span className="admin-user-flags">
                    <span className={`status-chip ${record.status === "done" ? "is-approved" : record.status === "failed" ? "is-archived" : "is-pending"}`}>
                      {importStatusLabel(record.status)}
                    </span>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void openHistory(record)}
                      disabled={busy === "history"}
                    >
                      Abrir
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
