import { refreshAuthSession, type SupabaseSession } from "./auth";
import { apiEnabled, apiRequest } from "./backend";

/**
 * Notificação no celular (Web Push). A chave do servidor (VAPID) vem da própria API, que a gera
 * sozinha: nada para configurar fora do repositório. No iPhone só funciona com o app adicionado
 * à Tela de Início (iOS 16.4+).
 */

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone/iPad no navegador: o push só existe depois de adicionar o app à Tela de Início. */
export function pushNeedsInstall(): boolean {
  if (typeof navigator === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  return ios && !standalone;
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(current: ArrayBuffer | null | undefined, key: Uint8Array): boolean {
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((b, i) => b === key[i]);
}

/**
 * Service worker pronto. Na primeira abertura o registro acontece depois do carregamento da
 * página, então espera um pouco por ele (em desenvolvimento não há service worker: desiste).
 */
async function registration(timeoutMs = 15_000): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/** Este aparelho está inscrito para receber os avisos? */
export async function pushSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

/**
 * "Testar": inscreve de novo (se precisar) e pede à API um aviso de teste para os aparelhos da
 * conta. `accepted` é quantos o serviço de push aceitou entregar.
 */
export async function testPush(): Promise<{ subscribed: boolean; devices: number; accepted: number }> {
  const subscribed = await syncPush();
  if (!subscribed) return { subscribed, devices: 0, accepted: 0 };
  const session = await refreshAuthSession();
  const result = await apiRequest<{ devices: number; accepted: number }>("/api/v1/push/test", {
    method: "POST",
    accessToken: session.access_token,
    timeoutMs: 30_000,
  });
  return { subscribed, ...result };
}

/** Pede permissão (depois de um toque) e inscreve este aparelho. */
export async function enablePush(): Promise<"on" | "denied" | "unsupported"> {
  if (!apiEnabled || !pushSupported()) return "unsupported";
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  return (await syncPush()) ? "on" : "unsupported";
}

/**
 * Confere a inscrição deste aparelho e manda para a API (a inscrição pode mudar com o tempo, e a
 * conta pode ter trocado). Só age se a pessoa já deu permissão. Devolve se ficou inscrito.
 */
export async function syncPush(): Promise<boolean> {
  if (!apiEnabled || !pushSupported() || Notification.permission !== "granted") return false;
  const reg = await registration();
  if (!reg) return false;
  const session = await refreshAuthSession();
  if (session.offline) return false;
  // Com o login: com o paywall ligado, a API antiga pedia conta até para a chave pública.
  const { publicKey } = await apiRequest<{ publicKey: string }>("/api/v1/push/key", { accessToken: session.access_token });
  const key = fromBase64Url(publicKey);
  let subscription = await reg.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  const { endpoint, keys } = subscription.toJSON();
  await apiRequest("/api/v1/push/subscriptions", { method: "POST", body: { endpoint, keys }, accessToken: session.access_token });
  return true;
}

/** Ao sair da conta: este aparelho para de receber os avisos dela. */
export async function disablePush(session: SupabaseSession): Promise<void> {
  if (!apiEnabled || !pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  await apiRequest(`/api/v1/push/subscriptions?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
    method: "DELETE",
    accessToken: session.access_token,
  }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => false);
}
