import { useState } from "react";
import { acceptInvite, declineInvite, type Group, type ReceivedInvite } from "../../lib/groups";
import { GroupAvatar, PersonFace } from "./GroupParts";
import { PersonName } from "../shop/PersonName";
import { GIcon } from "./groupIcons";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Não deu certo agora. Tente de novo.";
}

/**
 * Convites que a conta recebeu, no topo de "Meus grupos". Aceitar entra no grupo; recusar
 * some com o convite (quem convidou não é avisado).
 */
export function ReceivedInvites({
  invites,
  onAccepted,
  onGone,
}: {
  invites: ReceivedInvite[];
  onAccepted: (group: Group) => void;
  onGone: (groupId: string) => void;
}) {
  if (invites.length === 0) return null;
  return (
    <section className="groups-invites" aria-labelledby="groups-invites-title">
      <h2 id="groups-invites-title" className="groups-invites-title">
        {invites.length === 1 ? "Convite para grupo" : `Convites para grupos · ${invites.length}`}
      </h2>
      <ul className="groups-invites-list">
        {invites.map((invite) => (
          <li key={invite.group_id}>
            <InviteCard invite={invite} onAccepted={onAccepted} onGone={onGone} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function InviteCard({ invite, onAccepted, onGone }: { invite: ReceivedInvite; onAccepted: (group: Group) => void; onGone: (groupId: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const members = Number(invite.member_count);

  const act = (accept: boolean) => {
    setBusy(true);
    setError("");
    if (accept) {
      acceptInvite(invite.group_id)
        .then(onAccepted)
        .catch((err: unknown) => {
          setError(message(err));
          setBusy(false);
        });
    } else {
      declineInvite(invite.group_id)
        .then(() => onGone(invite.group_id))
        .catch((err: unknown) => {
          setError(message(err));
          setBusy(false);
        });
    }
  };

  return (
    <div className="groups-invite-card">
      <GroupAvatar id={invite.group_id} name={invite.group_name} photo={invite.group_photo} size="lg" />
      <span className="groups-invite-body">
        <strong className="groups-invite-name">
          {invite.group_name}
          {invite.mode === "roleplay" ? (
            <span className="group-card-lock" title="Roleplay: a IA narra a história" aria-label="Roleplay">
              🎭
            </span>
          ) : null}
          {invite.visibility === "private" ? (
            <span className="group-card-lock" title="Grupo privado">
              {GIcon.lock}
            </span>
          ) : null}
        </strong>
        <span className="groups-invite-from">
          <PersonFace
            id={invite.invited_by}
            name={invite.invited_by_name}
            avatar={invite.invited_by_avatar}
            photo={invite.invited_by_photo}
            size="sm"
            cosmetics={invite.invited_by_cosmetics}
          />
          <span>
            <strong>
              <PersonName name={invite.invited_by_name} cosmetics={invite.invited_by_cosmetics} />
            </strong>{" "}
            convidou você
          </span>
        </span>
        <small className="groups-invite-meta">
          {invite.book_title ? (
            <>
              {GIcon.book} {invite.book_title} ·{" "}
            </>
          ) : null}
          {members} {members === 1 ? "membro" : "membros"}
        </small>
        {error ? (
          <small className="auth-error" role="alert">
            {error}
          </small>
        ) : null}
      </span>
      <span className="groups-invite-actions">
        <button type="button" className="btn btn-primary is-compact" disabled={busy} onClick={() => act(true)} aria-label={`Aceitar o convite para ${invite.group_name}`}>
          Aceitar
        </button>
        <button type="button" className="btn is-compact" disabled={busy} onClick={() => act(false)} aria-label={`Recusar o convite para ${invite.group_name}`}>
          Recusar
        </button>
      </span>
    </div>
  );
}
