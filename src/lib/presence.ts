import type { RealtimeChannel, RealtimeClient } from "@supabase/realtime-js";
import { authEnabled, supabaseConfig } from "./auth";

/**
 * Quantas pessoas estão com o app aberto agora (Supabase Realtime Presence, sem backend).
 * Só o número circula: ninguém vê quem são. Cada conta conta uma vez, mesmo com várias abas; sem
 * conta, cada aba conta como um visitante. Com o app em segundo plano, a pessoa sai da contagem.
 */

let clientPromise: Promise<RealtimeClient> | null = null;

/** A biblioteca só é baixada quando o selo aparece (não pesa na abertura do app). */
function realtime(): Promise<RealtimeClient> {
  clientPromise ??= import("@supabase/realtime-js").then(({ RealtimeClient }) => {
    const { url, anonKey } = supabaseConfig();
    const client = new RealtimeClient(`${url.replace(/^http/, "ws")}/realtime/v1`, {
      params: { apikey: anonKey },
    });
    return client;
  });
  return clientPromise;
}

const tabId = Math.random().toString(36).slice(2, 10);

/**
 * Entra no canal `room` e avisa a contagem sempre que ela muda. Devolve a função para sair.
 * `who` = id da conta (várias abas contam como uma) ou nada (visitante).
 */
export function watchPresence(room: string, who: string | undefined, onCount: (n: number) => void): () => void {
  if (!authEnabled) return () => {};
  let channel: RealtimeChannel | null = null;
  let stopped = false;
  let tracking = false;
  const key = who ? `u:${who}` : `v:${tabId}`;

  const track = () => {
    if (!channel || tracking || document.visibilityState !== "visible") return;
    tracking = true;
    void channel.track({ at: Date.now() });
  };
  const untrack = () => {
    if (!channel || !tracking) return;
    tracking = false;
    void channel.untrack();
  };
  const onVisibility = () => (document.visibilityState === "visible" ? track() : untrack());

  void realtime()
    .then((client) => {
      if (stopped) return;
      channel = client.channel(`presence:${room}`, { config: { presence: { key } } });
      channel.on("presence", { event: "sync" }, () => {
        if (channel) onCount(Object.keys(channel.presenceState()).length);
      });
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") track();
      });
      document.addEventListener("visibilitychange", onVisibility);
    })
    .catch(() => {
      // Sem Realtime (rede bloqueada etc.): o selo só não aparece.
    });

  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", onVisibility);
    if (channel) {
      untrack();
      void realtime().then((client) => channel && client.removeChannel(channel));
    }
  };
}
