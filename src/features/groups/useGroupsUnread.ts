import { useEffect, useState } from "react";
import { myGroups, notifyGroupMessage, openGroupStream, type Group } from "../../lib/groups";

/**
 * Total de mensagens não lidas nos grupos, para o selo da tela inicial, e aviso do navegador
 * quando chega mensagem com o app em segundo plano. `me` vazio desliga.
 */
export function useGroupsUnread(me: string): number {
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    if (!me) {
      setGroups([]);
      return;
    }
    let alive = true;
    let known: Group[] = [];
    const load = () =>
      myGroups()
        .then((list) => {
          if (!alive) return;
          known = list;
          setGroups(list);
        })
        .catch(() => {
          // Sem rede: o selo só fica desatualizado.
        });
    void load();
    const close = openGroupStream((event) => {
      if (event.type === "message") {
        const m = event.data;
        if (m.author_id === me) return;
        const g = known.find((x) => x.id === m.group_id);
        if (g) notifyGroupMessage(m, g.name, g.muted);
        setGroups((cur) => cur.map((x) => (x.id === m.group_id ? { ...x, unread: x.unread + 1 } : x)));
      } else if (event.type === "group") {
        void load();
      }
    }, load);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [me]);

  return groups.reduce((sum, g) => sum + (g.muted ? 0 : Number(g.unread) || 0), 0);
}
