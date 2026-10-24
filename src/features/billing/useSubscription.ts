import { useCallback, useEffect, useState } from "react";
import type { SupabaseSession } from "../../lib/auth";
import { fetchBillingStatus, type SubscriptionStatus } from "../../lib/billing";

/** Estado da assinatura para as telas de conta/checkout; o servidor continua sendo a verdade. */
export function useSubscription(session: SupabaseSession | null) {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(session));
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!session) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setStatus(await fetchBillingStatus(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar a assinatura.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}
