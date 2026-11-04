import { useEffect, useState } from "react";
import { myGroups, noteDelivered, notifyGroupMessage, openGroupStream, type Group } from "../../lib/groups";
import { syncPush } from "../../lib/push";

export type GroupsActivity = {
  /** Mensagens não lidas nos grupos não silenciados (selo do botão Grupos). */
  total: number;
  /** Os grupos da conta, com não lidas e a última mensagem (seção do sininho). */
  groups: Group[];
  /** Muda quando chega aviso novo (resposta, reação, entrada): o sininho busca de novo. */
  activity: number;
};

/**
 * Não lidas dos grupos para o topo, aviso do navegador com o app em segundo plano e o "recebi"
 * das mensagens (selo ✓✓ de quem escreveu). Uma conexão só de tempo real. `me` vazio desliga.
 */
export function useGroupsUnread(me: string): GroupsActivity {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activity, setActivity] = useState(0);

  useEffect(() => {
    if (!me) {
      setGroups([]);
      return;
    }
    let alive = true;
    let known: Group[] = [];
    // Avisos no celular: com a permissão já dada, garante a inscrição deste aparelho nesta conta.
    void syncPush().catch((err: unknown) => console.warn("[push] inscrição não sincronizada:", err));
    const load = () =>
      myGroups()
        .then((list) => {
          if (!alive) return;
          known = list;
          setGroups(list);
          // Abrir o app conta como "recebido" até a última mensagem de cada grupo.
          for (const g of list) if (g.last_message_id) noteDelivered(g.id, g.last_message_id);
        })
        .catch(() => {
          // Sem rede: o selo só fica desatualizado.
        });
    void load();
    const close = openGroupStream((event) => {
      if (event.type === "message") {
        const m = event.data;
        if (m.author_id === me) return;
        noteDelivered(m.group_id, m.id);
        const g = known.find((x) => x.id === m.group_id);
        if (g) notifyGroupMessage(m, g.name, g.muted);
        setGroups((cur) =>
          cur.map((x) =>
            x.id === m.group_id
              ? { ...x, unread: x.unread + 1, last_message_id: m.id, last_author_name: m.author_name, last_body: m.body, last_media_kind: m.media_kind ?? null }
              : x,
          ),
        );
      } else if (event.type === "group") {
        void load();
      } else if (event.type === "notification") {
        setActivity((n) => n + 1);
      }
    }, load);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void load();
      setActivity((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [me]);

  return { total: groups.reduce((sum, g) => sum + (g.muted ? 0 : Number(g.unread) || 0), 0), groups, activity };
}
