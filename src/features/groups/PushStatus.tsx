import { useEffect, useState } from "react";
import { pushSubscribed, pushSupported, testPush } from "../../lib/push";
import { GIcon } from "./groupIcons";

/**
 * Só aparece quando há problema: a pessoa liberou as notificações, mas este aparelho não está
 * inscrito. "Tentar de novo" inscreve e manda um aviso de teste para a própria conta.
 */
export function PushStatus() {
  const supported = pushSupported();
  const granted = supported && Notification.permission === "granted";
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  useEffect(() => {
    if (!granted) return;
    // A inscrição automática roda ao abrir o app: confere depois que ela teve tempo de terminar.
    const timer = window.setTimeout(() => void pushSubscribed().then(setSubscribed).catch(() => setSubscribed(false)), 4000);
    return () => window.clearTimeout(timer);
  }, [granted]);

  useEffect(() => {
    if (!subscribed || !result) return;
    const timer = window.setTimeout(() => setResult(""), 12_000);
    return () => window.clearTimeout(timer);
  }, [subscribed, result]);

  if (!granted || subscribed === null || (subscribed && !result)) return null;

  async function retry() {
    setBusy(true);
    setResult("");
    try {
      const r = await testPush();
      setSubscribed(r.subscribed);
      if (!r.subscribed) setResult("Ainda não deu. Feche o app, abra de novo e tente outra vez.");
      else if (r.accepted > 0)
        setResult(
          "Pronto! Mandamos um aviso de teste. Se ele não aparecer na barra, libere as notificações do navegador nas configurações do celular e tire ele da economia de bateria.",
        );
      else setResult("O serviço de notificações recusou agora. Tente de novo em alguns minutos.");
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Não foi possível tentar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="groups-push-status" role="status">
      {subscribed ? null : (
        <>
          <span>
            {GIcon.bell} <strong>Os avisos no celular não estão chegando a este aparelho.</strong>
          </span>
          <button type="button" className="group-text-btn" onClick={() => void retry()} disabled={busy}>
            {busy ? "Tentando…" : "Tentar de novo"}
          </button>
        </>
      )}
      {result ? <small>{result}</small> : null}
    </div>
  );
}
