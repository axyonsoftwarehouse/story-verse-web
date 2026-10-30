import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ConfirmOptions } from "../../components/ConfirmDialog";
import {
  deleteGroup,
  inviteUrl,
  leaveGroup,
  removeMember,
  rotateInvite,
  setMemberRole,
  setMuted,
  type Group,
  type GroupMember,
} from "../../lib/groups";
import { PersonFace } from "./GroupParts";

const ROLE_LABEL = { owner: "Dono", moderator: "Moderador", member: "" } as const;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Algo deu errado. Tente de novo.";
}

/** Detalhes do grupo: livro e meta, membros com progresso, convite, silenciar, sair e gestão. */
export function GroupInfo({
  group,
  me,
  confirm,
  onClose,
  onChanged,
  onLeft,
}: {
  group: Group;
  me: string;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  onClose: () => void;
  onChanged: (g: Group) => void;
  onLeft: () => void;
}) {
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const owner = group.my_role === "owner";
  const manager = owner || group.my_role === "moderator";
  const members = group.members ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run<T>(action: () => Promise<T>, after?: (r: T) => void) {
    setError("");
    try {
      const result = await action();
      after?.(result);
    } catch (err) {
      setError(message(err));
    }
  }

  async function copyInvite() {
    if (!group.invite_code) return;
    const url = inviteUrl(group.invite_code);
    try {
      if (navigator.share) {
        await navigator.share({ title: group.name, text: `Entra no grupo “${group.name}” no Storyverse`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Compartilhamento cancelado.
    }
  }

  async function leave() {
    const alone = members.length <= 1;
    const ok = await confirm(
      owner && alone
        ? { title: "Sair e apagar o grupo?", message: "Você é a única pessoa do grupo: ao sair, ele é apagado.", confirmLabel: "Sair", danger: true }
        : { title: "Sair do grupo?", message: "Você para de receber as mensagens. Dá para voltar depois, se o grupo for público ou com o convite.", confirmLabel: "Sair" },
    );
    if (ok) await run(() => leaveGroup(group.id), onLeft);
  }

  async function remove(member: GroupMember) {
    const ok = await confirm({
      title: `Remover ${member.name}?`,
      message: "A pessoa sai do grupo e não consegue voltar, nem pelo link de convite.",
      confirmLabel: "Remover",
      danger: true,
    });
    if (ok) await run(() => removeMember(group.id, member.user_id), () => onChanged({ ...group, members: members.filter((m) => m.user_id !== member.user_id), member_count: Number(group.member_count) - 1 }));
  }

  async function transfer(member: GroupMember) {
    const ok = await confirm({
      title: `Passar o grupo para ${member.name}?`,
      message: "A pessoa vira dona do grupo e você passa a ser moderador.",
      confirmLabel: "Passar a posse",
    });
    if (ok) await run(() => setMemberRole(group.id, member.user_id, "owner"), onChanged);
  }

  async function removeGroup() {
    const ok = await confirm({ title: "Apagar o grupo?", message: "As mensagens somem para todos. Não dá para desfazer.", confirmLabel: "Apagar grupo", danger: true });
    if (ok) await run(() => deleteGroup(group.id), onLeft);
  }

  return createPortal(
    <div className="about-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="auth-card shelf-dialog group-info" role="dialog" aria-modal="true" aria-labelledby="group-info-title">
        <header className="shelf-dialog-head">
          <div>
            <span className="eyebrow">{group.visibility === "public" ? "Grupo público" : "Grupo privado"}</span>
            <h2 id="group-info-title">{group.name}</h2>
          </div>
          <button type="button" className="btn" onClick={onClose}>
            Fechar
          </button>
        </header>
        {group.description ? <p>{group.description}</p> : null}
        {group.book_title ? (
          <p className="group-info-book">
            📖 Lendo “{group.book_title}”
            {group.goal_chapter ? ` · meta: capítulo ${group.goal_chapter}` : ""}
            {group.goal_until ? ` até ${new Date(`${group.goal_until}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
          </p>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        {manager && group.invite_code ? (
          <div className="group-invite">
            <span>Convite</span>
            <code>{inviteUrl(group.invite_code)}</code>
            <div className="shelf-actions">
              <button type="button" className="btn btn-primary" onClick={() => void copyInvite()}>
                {copied ? "Link copiado!" : "Compartilhar link"}
              </button>
              {owner ? (
                <button type="button" className="btn" onClick={() => void run(() => rotateInvite(group.id), onChanged)}>
                  Trocar link
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <label className="ranking-visibility">
          <input type="checkbox" checked={group.muted} onChange={(e) => void run(() => setMuted(group.id, e.target.checked), onChanged)} />
          <span>
            <strong>Silenciar avisos</strong>
            <small>As mensagens continuam chegando, mas sem notificação.</small>
          </span>
        </label>

        <h3>
          Membros <small>({members.length})</small>
        </h3>
        <ul className="group-members">
          {members.map((m) => (
            <li key={m.user_id}>
              <PersonFace name={m.name} avatar={m.avatar} size="sm" />
              <span className="group-member-name">
                {m.user_id === me ? `${m.name} (você)` : m.name}
                {ROLE_LABEL[m.role] ? <small className="group-tag">{ROLE_LABEL[m.role]}</small> : null}
              </span>
              {group.book_key ? (
                <span className="group-member-progress" title="Progresso no livro do clube">
                  {m.book_status === "finished" ? "✅ terminou" : m.progress_percent !== null ? `${m.progress_percent}%` : "—"}
                </span>
              ) : null}
              {m.user_id !== me && m.role !== "owner" && (owner || (manager && m.role === "member")) ? (
                <span className="group-member-actions">
                  {owner ? (
                    <>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => void run(() => setMemberRole(group.id, m.user_id, m.role === "moderator" ? "member" : "moderator"), onChanged)}
                      >
                        {m.role === "moderator" ? "Tirar moderador" : "Tornar moderador"}
                      </button>
                      <button type="button" className="link-btn" onClick={() => void transfer(m)}>
                        Passar posse
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="link-btn is-danger" onClick={() => void remove(m)}>
                    Remover
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <div className="shelf-actions group-info-danger">
          <button type="button" className="btn" onClick={() => void leave()}>
            Sair do grupo
          </button>
          {owner ? (
            <button type="button" className="btn btn-danger" onClick={() => void removeGroup()}>
              Apagar grupo
            </button>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
