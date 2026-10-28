import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { SupabaseSession } from "../../lib/auth";
import { useConfirm } from "../../components/ConfirmDialog";
import {
  FEATURE_DESCRIPTIONS,
  featureName,
  getCatalog,
  listFeatureUsers,
  setFeature,
  type FeatureCatalogEntry,
  type FeatureUser,
} from "../../lib/adminFeatures";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível carregar as features.";
}

function when(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function FeaturesSection({ session }: { session: SupabaseSession }) {
  const [catalog, setCatalog] = useState<FeatureCatalogEntry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [users, setUsers] = useState<FeatureUser[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);
    getCatalog(session)
      .then((rows) => {
        if (alive) setCatalog(rows);
      })
      .catch((err) => {
        if (alive) setError(message(err));
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  async function open(feature: string) {
    setSelected(feature);
    setUsers([]);
    setNextCursor(null);
    setUsersLoading(true);
    setError("");
    setNotice("");
    try {
      const page = await listFeatureUsers(session, feature);
      setUsers(page.items);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(message(err));
    } finally {
      setUsersLoading(false);
    }
  }

  async function more() {
    if (!selected || !nextCursor) return;
    setUsersLoading(true);
    setError("");
    try {
      const page = await listFeatureUsers(session, selected, nextCursor);
      setUsers((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(message(err));
    } finally {
      setUsersLoading(false);
    }
  }

  async function disable(user: FeatureUser) {
    if (!selected || busyId) return;
    if (
      !(await confirm({
        title: `Desligar ${selected}?`,
        message: `${user.name} deixa de usar esta feature imediatamente.`,
        confirmLabel: "Desligar feature",
        danger: true,
      }))
    )
      return;
    setBusyId(user.userId);
    setError("");
    setNotice("");
    try {
      await setFeature(session, user.userId, selected, false);
      setUsers((current) => current.filter((item) => item.userId !== user.userId));
      setCatalog((current) =>
        current?.map((entry) =>
          entry.feature === selected
            ? { ...entry, enabledCount: Math.max(0, entry.enabledCount - 1) }
            : entry,
        ) ?? current,
      );
      setNotice(`${selected} desligada para ${user.name}.`);
    } catch (err) {
      setError(message(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="shelf">
      <div className="shelf-head">
        <h1>Recursos em teste</h1>
      </div>
      <p className="muted">
        Para ligar para alguém, abra a conta em{" "}
        <Link className="link-btn" to="/admin/contas">
          Contas
        </Link>
        .
      </p>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="auth-global-notice" role="status">
          {notice}
        </p>
      ) : null}

      {catalogLoading ? (
        <div className="page-status">
          <span className="spinner" aria-hidden="true" />
          Carregando features…
        </div>
      ) : catalog && catalog.length === 0 ? (
        <p className="profile-empty">Nenhum recurso em teste.</p>
      ) : (
        <div className="dash-tiles">
          {(catalog ?? []).map((entry) =>
            entry.everyone ? (
              <div key={entry.feature} className="dash-card admin-feature-card">
                <span className="dash-label">{featureName(entry.feature)}</span>
                <strong>Todas as contas</strong>
                <span className="dash-sub">
                  {FEATURE_DESCRIPTIONS[entry.feature]?.description ?? entry.feature}
                </span>
              </div>
            ) : (
              <button
                type="button"
                key={entry.feature}
                className={`dash-card admin-feature-card${selected === entry.feature ? " is-on" : ""}`}
                onClick={() => void open(entry.feature)}
              >
                <span className="dash-label">{featureName(entry.feature)}</span>
                <strong>{entry.enabledCount}</strong>
                <span className="dash-sub">
                  {FEATURE_DESCRIPTIONS[entry.feature]?.description ?? "contas com o recurso ligado"}
                </span>
              </button>
            ),
          )}
        </div>
      )}

      {selected ? (
        <div className="admin-feature-panel">
          <div className="shelf-head">
            <h2>{selected}</h2>
            <button type="button" className="btn" onClick={() => setSelected(null)}>
              Fechar
            </button>
          </div>

          {usersLoading && users.length === 0 ? (
            <div className="page-status">
              <span className="spinner" aria-hidden="true" />
              Carregando contas…
            </div>
          ) : users.length === 0 ? (
            <p className="profile-empty">Ninguém tem esta feature ligada.</p>
          ) : (
            <ul className="admin-user-list">
              {users.map((user) => (
                <li key={user.userId}>
                  <div className="admin-user-row">
                    <span>
                      <Link to={`/admin/contas/${user.userId}`}>
                        <strong>{user.name}</strong>
                      </Link>
                      <span className="muted">{user.emailMasked}</span>
                      <span className="muted">
                        {user.grantedByName ? `concedida por ${user.grantedByName}` : "concedida por script"} ·{" "}
                        {when(user.updatedAt)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="btn"
                      disabled={busyId === user.userId}
                      onClick={() => void disable(user)}
                    >
                      Desligar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {nextCursor ? (
            <button type="button" className="btn" onClick={() => void more()} disabled={usersLoading}>
              {usersLoading ? "Carregando…" : "Carregar mais"}
            </button>
          ) : null}
        </div>
      ) : null}
      {dialog}
    </section>
  );
}
