/**
 * Tela de abertura (#splash, desenhada no index.html antes de qualquer script). Na primeira vez
 * da sessão ela fica pelo menos MIN_VISIBLE_MS desde o carregamento da página, para a animação
 * do logo terminar, e sai com um fade quando o app está pronto. A página inicial segura a abertura até o login carregar;
 * as outras rotas (fórum, admin) liberam logo.
 */

const MIN_VISIBLE_MS = 2000;
/** Recarregar a página na mesma sessão: a abertura não precisa tocar inteira de novo. */
const MIN_VISIBLE_REPEAT_MS = 600;
const SEEN_KEY = "storyverse:splash-seen";

function minVisibleMs(): number {
  try {
    if (sessionStorage.getItem(SEEN_KEY)) return MIN_VISIBLE_REPEAT_MS;
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Sem armazenamento: toca inteira.
  }
  return MIN_VISIBLE_MS;
}

/** Se algo travar, a abertura nunca fica para sempre por cima do app. */
const FAILSAFE_MS = 10_000;

let held = false;
let started = false;
let timer: number | null = null;
let minMs = MIN_VISIBLE_MS;

function hide() {
  const el = typeof document !== "undefined" ? document.getElementById("splash") : null;
  if (!el || el.classList.contains("is-leaving")) return;
  el.classList.add("is-leaving");
  window.setTimeout(() => el.remove(), 700);
}

function schedule() {
  if (!started || held || timer !== null) return;
  const wait = Math.max(0, minMs - performance.now());
  timer = window.setTimeout(() => {
    timer = null;
    if (!held) hide();
  }, wait);
}

/** Chamado uma vez depois que o React começa a desenhar. */
export function startSplashExit() {
  started = true;
  minMs = minVisibleMs();
  window.setTimeout(hide, FAILSAFE_MS);
  schedule();
}

/** A página inicial ainda está carregando o login: a abertura espera. */
export function holdSplash() {
  held = true;
}

export function releaseSplash() {
  held = false;
  schedule();
}
