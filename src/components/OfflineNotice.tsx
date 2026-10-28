import { useEffect, useState } from "react";

/** Aviso fixo quando a rede cai: o app instalado abre do cache, mas não pode parecer "travado". */
export function OfflineNotice() {
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="offline-notice" role="status" aria-live="polite">
      Sem conexão — você está vendo o que já foi carregado.
    </div>
  );
}
