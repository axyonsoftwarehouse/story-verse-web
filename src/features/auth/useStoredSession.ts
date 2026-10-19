import { useEffect, useState } from "react";
import {
  AUTH_SESSION_STORAGE_KEY,
  restoreAuthSession,
  storedAuthSession,
  type SupabaseSession,
} from "../../lib/auth";

/** Sessao para telas fora do App (admin/forum), sem duplicar o estado da home. */
export function useStoredSession() {
  const [session, setSession] = useState<SupabaseSession | null>(() => storedAuthSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    restoreAuthSession()
      .then((next) => {
        if (alive) setSession(next);
      })
      .catch(() => {
        if (alive) setSession(storedAuthSession());
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_STORAGE_KEY) setSession(storedAuthSession());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { session, loading };
}
