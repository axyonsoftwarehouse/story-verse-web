import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../../App.css";
import "./groups.css";
import { joinByInvite, PENDING_INVITE_KEY } from "../../lib/groups";
import { useStoredSession } from "../auth/useStoredSession";
import { GroupsBlocked } from "./GroupParts";
import { useGroupsGate } from "./groupHelpers";

/** Link de convite (`/g/<código>`): entra no grupo e abre a conversa. */
export function GroupInvite() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const { session, loading } = useStoredSession();
  const gate = useGroupsGate(session, loading);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !session) {
      try {
        localStorage.setItem(PENDING_INVITE_KEY, code);
      } catch {
        // Sem armazenamento: a pessoa abre o link de novo depois de entrar.
      }
    }
  }, [loading, session, code]);

  useEffect(() => {
    if (!gate.ready) return;
    let alive = true;
    try {
      localStorage.removeItem(PENDING_INVITE_KEY);
    } catch {
      // Ignora.
    }
    joinByInvite(code)
      .then((group) => alive && navigate(`/grupos/${group.id}`, { replace: true }))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "Convite inválido ou expirado."));
    return () => {
      alive = false;
    };
  }, [gate.ready, code, navigate]);

  if (!loading && !session) {
    return (
      <div className="home groups-page">
        <nav className="home-nav profile-nav">
          <Link className="btn" to="/">
            Voltar
          </Link>
          <span className="wordmark">Convite</span>
        </nav>
        <section className="shelf group-preview">
          <h1>Você recebeu um convite para um grupo</h1>
          <p>Entre na sua conta (ou crie uma) para participar. Depois de entrar, você volta direto para o grupo.</p>
          <Link className="btn btn-primary" to="/">
            Entrar no Storyverse
          </Link>
        </section>
      </div>
    );
  }
  if (!gate.ready) return <GroupsBlocked text={gate.blocked} />;
  return <GroupsBlocked text={error || null} />;
}
