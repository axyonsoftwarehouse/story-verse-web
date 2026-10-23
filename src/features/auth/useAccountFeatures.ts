import { useEffect, useState } from "react";
import { cachedAccountCapabilities, fetchAccountCapabilities, type AccountCapabilities } from "../../lib/accountFeatures";
import type { SupabaseSession } from "../../lib/auth";

/** Carrega papéis/features da conta para telas que dependem de beta fechado. */
export function useAccountFeatures(session: SupabaseSession | null) {
  const [capabilities, setCapabilities] = useState<AccountCapabilities | null>(null);
  const [loading, setLoading] = useState(Boolean(session));

  useEffect(() => {
    if (!session) {
      setCapabilities(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetchAccountCapabilities(session)
      .then((next) => {
        if (alive) setCapabilities(next);
      })
      .catch(() => {
        // Sem internet: vale a última resposta desta conta (não a de outra conta do aparelho).
        if (alive) setCapabilities(cachedAccountCapabilities(session.user.id) ?? { roles: [], features: [] });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [session]);

  return { capabilities, loading };
}
