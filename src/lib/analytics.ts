// Tráfego do site no Umami auto-hospedado (docs/SPEC_ADMIN_DASHBOARD.md, seção 4). O Caddy serve o
// tracker e a coleta pela mesma origem em /u/*, então a CSP continua só com 'self'.

/** Caminho do tracker e base da coleta (`/u/api/send`) no próprio domínio. */
export const UMAMI_SCRIPT_SRC = "/u/script.js";
export const UMAMI_HOST_URL = "/u";
/** Nome global da função que o tracker chama antes de cada envio (`data-before-send`). */
const BEFORE_SEND = "storyverseUmamiBeforeSend";

/** Telas que não contam como tráfego: a área interna da equipe. */
const UNTRACKED_PATHS = /^\/admin(?:\/|$)/;

type UmamiPayload = { url?: string } & Record<string, unknown>;

/** Caminho da URL do envio. O Umami 3 manda a URL completa (com o domínio), não só o caminho. */
function pathOf(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url.split(/[?#]/)[0];
  }
}

/** Descarta o envio (retorna false) para as telas da equipe; o resto passa como veio. */
export function umamiBeforeSend(_type: string, payload: UmamiPayload): UmamiPayload | false {
  return UNTRACKED_PATHS.test(pathOf(payload.url ?? "")) ? false : payload;
}

let installed = false;

/** Coloca o tracker na página se o build tiver o id do site. Sem id (dev, testes), não faz nada. */
export function installAnalytics(websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID?.trim()): void {
  if (installed || !websiteId || typeof document === "undefined") return;
  installed = true;
  (window as unknown as Record<string, unknown>)[BEFORE_SEND] = umamiBeforeSend;
  const script = document.createElement("script");
  script.defer = true;
  script.src = UMAMI_SCRIPT_SRC;
  script.dataset.websiteId = websiteId;
  script.dataset.hostUrl = UMAMI_HOST_URL;
  // Sem e-mail, id nem token na URL: a query string e o hash (links de senha/confirmação) ficam de fora.
  script.dataset.excludeSearch = "true";
  script.dataset.excludeHash = "true";
  script.dataset.doNotTrack = "true";
  script.dataset.beforeSend = BEFORE_SEND;
  // Web Vitals (LCP, INP, CLS, FCP, TTFB) em envios do tipo "performance"; o painel do admin lê o p75.
  script.dataset.performance = "true";
  document.head.appendChild(script);
}

/** Só para os testes: permite instalar de novo. */
export function resetAnalyticsForTests(): void {
  installed = false;
  delete (window as unknown as Record<string, unknown>)[BEFORE_SEND];
}
