import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { messagePreview, messageTime, type Group } from "../../lib/groups";
import { fetchNotifications, markNotificationsRead, type AppNotification } from "../../lib/notifications";
import { GroupAvatar, PersonFace } from "../groups/GroupParts";
import "../groups/groups.css";
import "./notifications.css";

const BELL = (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />
  </svg>
);

function describe(n: AppNotification): { text: string; quote: string | null } {
  const quote = n.message_body || n.message_media_kind ? messagePreview({ body: n.message_body, media_kind: n.message_media_kind }, 70) : null;
  if (n.kind === "reply") return { text: `${n.actor_name} respondeu sua mensagem em ${n.group_name}`, quote };
  if (n.kind === "reaction") return { text: `${n.actor_name} reagiu ${n.emoji ?? ""} à sua mensagem em ${n.group_name}`, quote };
  if (n.kind === "member_added") return { text: `${n.actor_name} adicionou você ao grupo ${n.group_name}`, quote: null };
  return { text: `${n.actor_name} entrou no grupo ${n.group_name}`, quote: null };
}

/**
 * Sininho do topo: mensagens novas nos grupos e o que aconteceu com a pessoa (responderam,
 * reagiram, entrou alguém no grupo dela). Abrir marca os avisos como vistos.
 */
export function NotificationBell({ groups, activity }: { groups: Group[]; activity: number }) {
  const navigate = useNavigate();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pos, setPos] = useState<CSSProperties>({});

  const load = useCallback(() => {
    void fetchNotifications()
      .then((r) => {
        setItems(r.items);
        setUnread(r.unread);
      })
      .catch(() => {
        // Sem rede: fica o que já estava.
      });
  }, []);

  useEffect(() => load(), [load, activity]);

  const newGroups = groups.filter((g) => !g.muted && Number(g.unread) > 0);
  const badge = unread + newGroups.length;

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(380, window.innerWidth - 24);
      setPos({ top: r.bottom + 8, width, left: Math.max(12, Math.min(r.right - width, window.innerWidth - width - 12)) });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    // Abriu: os avisos contam como vistos (o destaque continua até fechar).
    if (unread > 0) {
      void markNotificationsRead()
        .then(() => setUnread(0))
        .catch(() => {});
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [open, unread]);

  function go(groupId: string) {
    setOpen(false);
    navigate(`/grupos/${groupId}`);
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className={`btn nav-bell ${open ? "is-open" : ""}`}
        onClick={() => {
          if (!open) load();
          setOpen((v) => !v);
        }}
        aria-label={badge > 0 ? `Notificações, ${badge} novas` : "Notificações"}
        aria-expanded={open}
        title="Notificações"
      >
        {BELL}
        {badge > 0 ? <span className="nav-bell-badge">{badge > 99 ? "99+" : badge}</span> : null}
      </button>
      {open
        ? createPortal(
            <div className="notif-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
              <section className="notif-panel" style={pos} role="dialog" aria-label="Notificações">
                <header>
                  <h2>Notificações</h2>
                </header>
                <div className="notif-scroll">
                  {newGroups.length > 0 ? (
                    <>
                      <h3>Mensagens novas</h3>
                      <ul>
                        {newGroups.map((g) => (
                          <li key={g.id}>
                            <button type="button" className="notif-item is-new" onClick={() => go(g.id)}>
                              <GroupAvatar id={g.id} name={g.name} photo={g.photo_url} size="sm" />
                              <span className="notif-text">
                                <strong>
                                  {Number(g.unread) >= 100 ? "99+" : g.unread} {Number(g.unread) === 1 ? "mensagem nova" : "mensagens novas"} em {g.name}
                                </strong>
                                {g.last_author_name ? (
                                  <small>
                                    {g.last_author_name}: {messagePreview({ body: g.last_body, media_kind: g.last_media_kind }, 60) || "🙈 spoiler"}
                                  </small>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  <h3>Atividade</h3>
                  {items.length === 0 ? (
                    <p className="notif-empty">Quando responderem ou reagirem às suas mensagens, aparece aqui.</p>
                  ) : (
                    <ul>
                      {items.map((n) => {
                        const { text, quote } = describe(n);
                        return (
                          <li key={n.id}>
                            <button type="button" className={`notif-item ${n.read ? "" : "is-new"}`} onClick={() => go(n.group_id)}>
                              <PersonFace id={n.actor_id} name={n.actor_name} avatar={n.actor_avatar} photo={n.actor_photo} size="sm" />
                              <span className="notif-text">
                                <strong>{text}</strong>
                                {quote ? <small>“{quote}”</small> : null}
                                <time>{messageTime(n.created_at)}</time>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
