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
import { GroupForm } from "./GroupForm";
import { GroupAvatar, PersonFace } from "./GroupParts";
import { GIcon } from "./groupIcons";

const ROLE_LABEL = { owner: "Dono", moderator: "Moderador", member: "" } as const;

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Algo deu errado. Tente de novo.";
}

/** Detalhes do grupo: foto, descrição, livro e meta, convite, membros, silenciar, sair e gestão. */
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
  const [editing, setEditing] = useState(false);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [coverBroken, setCoverBroken] = useState(false);
  const owner = group.my_role === "owner";
  const manager = owner || group.my_role === "moderator";
  const members = group.members ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !editing && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onClose]);

  async function run<T>(action: () => Promise<T>, after?: (r: T) => void) {
    setError("");
    try {
      const result = await action();
      after?.(result);
    } catch (err) {
      setError(message(err));
    }
  }

  async function shareInvite() {
    if (!group.invite_code) return;
    const url = inviteUrl(group.invite_code);
    try {
      if (navigator.share) {
        await navigator.share({ title: group.name, text: `Entra no grupo “${group.name}” no Storyverse`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
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
    if (ok) {
      await run(
        () => removeMember(group.id, member.user_id),
        () => onChanged({ ...group, members: members.filter((m) => m.user_id !== member.user_id), member_count: Number(group.member_count) - 1 }),
      );
    }
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

  const count = Number(group.member_count);

  return createPortal(
    <div className="about-backdrop group-sheet-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="group-sheet group-info" role="dialog" aria-modal="true" aria-labelledby="group-info-title">
        <header className="group-sheet-head is-floating">
          <span />
          <button type="button" className="group-icon-btn" onClick={onClose} aria-label="Fechar">
            {GIcon.close}
          </button>
        </header>

        <div className="group-info-hero">
          <GroupAvatar id={group.id} name={group.name} photo={group.photo_url} size="xl" />
          <h2 id="group-info-title">{group.name}</h2>
          <p className="group-info-meta">
            {group.visibility === "public" ? GIcon.users : GIcon.lock}
            {group.visibility === "public" ? "Grupo público" : "Grupo privado"} · {count} {count === 1 ? "membro" : "membros"}
          </p>
          {group.description ? <p className="group-info-desc">{group.description}</p> : owner ? <p className="group-info-desc is-empty">Sem descrição ainda.</p> : null}
          {owner ? (
            <button type="button" className="btn group-edit-btn" onClick={() => setEditing(true)}>
              {GIcon.pencil} Editar grupo
            </button>
          ) : null}
        </div>

        {group.book_title ? (
          <div className="group-info-card group-info-book">
            {group.book_cover && !coverBroken ? (
              <img src={group.book_cover} alt="" loading="lazy" onError={() => setCoverBroken(true)} />
            ) : (
              <span className="group-info-book-icon">{GIcon.book}</span>
            )}
            <span>
              <small>Clube de leitura</small>
              <strong>{group.book_title}</strong>
              {group.goal_chapter ? (
                <small>
                  🎯 Meta: capítulo {group.goal_chapter}
                  {group.goal_until ? ` até ${new Date(`${group.goal_until}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}
                </small>
              ) : null}
            </span>
          </div>
        ) : null}

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        {manager && group.invite_code ? (
          <div className="group-info-card group-invite">
            <span className="group-info-card-icon">{GIcon.link}</span>
            <span className="group-invite-text">
              <strong>Link de convite</strong>
              <small>{inviteUrl(group.invite_code).replace(/^https?:\/\//, "")}</small>
            </span>
            <button type="button" className="btn btn-primary group-invite-share" onClick={() => void shareInvite()}>
              {copied ? "Copiado!" : "Compartilhar"}
            </button>
            {owner ? (
              <button type="button" className="group-text-btn group-invite-rotate" onClick={() => void run(() => rotateInvite(group.id), onChanged)}>
                Gerar link novo (o antigo para de funcionar)
              </button>
            ) : null}
          </div>
        ) : null}

        <label className="group-info-card group-switch">
          <span className="group-info-card-icon">{GIcon.bell}</span>
          <span>
            <strong>Silenciar avisos</strong>
            <small>As mensagens chegam, mas sem notificação nem contador.</small>
          </span>
          <input type="checkbox" role="switch" checked={group.muted} onChange={(e) => void run(() => setMuted(group.id, e.target.checked), onChanged)} />
        </label>

        <h3 className="group-info-section">
          Membros <small>{members.length}</small>
        </h3>
        <ul className="group-members">
          {members.map((m) => {
            const canManage = m.user_id !== me && m.role !== "owner" && (owner || (manager && m.role === "member"));
            return (
              <li key={m.user_id}>
                <div className="group-member-row">
                  <PersonFace id={m.user_id} name={m.name} avatar={m.avatar} size="sm" />
                  <span className="group-member-name">
                    {m.user_id === me ? `${m.name} (você)` : m.name}
                    {ROLE_LABEL[m.role] ? <small className="group-role">{ROLE_LABEL[m.role]}</small> : null}
                  </span>
                  {group.book_key ? (
                    <span className="group-member-progress" title="Progresso no livro do clube">
                      {m.book_status === "finished" ? (
                        "✓ terminou"
                      ) : m.progress_percent !== null ? (
                        <>
                          <span className="group-progress-bar">
                            <span style={{ width: `${Math.max(4, m.progress_percent)}%` }} />
                          </span>
                          {m.progress_percent}%
                        </>
                      ) : (
                        "—"
                      )}
                    </span>
                  ) : null}
                  {canManage ? (
                    <button
                      type="button"
                      className="group-icon-btn"
                      aria-label={`Opções para ${m.name}`}
                      aria-expanded={openMember === m.user_id}
                      onClick={() => setOpenMember(openMember === m.user_id ? null : m.user_id)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    </button>
                  ) : null}
                </div>
                {canManage && openMember === m.user_id ? (
                  <div className="group-member-actions">
                    {owner ? (
                      <>
                        <button type="button" className="group-text-btn" onClick={() => void run(() => setMemberRole(group.id, m.user_id, m.role === "moderator" ? "member" : "moderator"), onChanged)}>
                          {m.role === "moderator" ? "Tirar de moderador" : "Tornar moderador"}
                        </button>
                        <button type="button" className="group-text-btn" onClick={() => void transfer(m)}>
                          Passar a posse
                        </button>
                      </>
                    ) : null}
                    <button type="button" className="group-text-btn is-danger" onClick={() => void remove(m)}>
                      Remover do grupo
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className="group-info-danger">
          <button type="button" className="group-danger-btn" onClick={() => void leave()}>
            Sair do grupo
          </button>
          {owner ? (
            <button type="button" className="group-danger-btn" onClick={() => void removeGroup()}>
              {GIcon.trash} Apagar grupo
            </button>
          ) : null}
        </div>
      </section>
      {editing ? (
        <GroupForm
          group={group}
          onClose={() => setEditing(false)}
          onSaved={(g) => {
            onChanged(g);
            setEditing(false);
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}
