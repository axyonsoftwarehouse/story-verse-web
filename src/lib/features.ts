/**
 * Funcionalidades prontas, mas ainda fora do menu publicado.
 *
 * O forum fica escondido na producao e pode ser aberto para desenho/revisao com
 * `?forum=1` (o parametro fica guardado no aparelho). `?forum=0` desliga de novo.
 * Um build de preview pode definir `VITE_FORUM_ENABLED=true`.
 */
const FORUM_PREVIEW_KEY = "storyverse:forum-preview";

function readForumPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("forum");
    if (param === "1") localStorage.setItem(FORUM_PREVIEW_KEY, "1");
    if (param === "0") localStorage.removeItem(FORUM_PREVIEW_KEY);
    return localStorage.getItem(FORUM_PREVIEW_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("forum") === "1";
  }
}

export const FORUM_ENABLED = import.meta.env.VITE_FORUM_ENABLED === "true";
export const FORUM_PREVIEW = readForumPreview();
export const FORUM_VISIBLE = FORUM_ENABLED || FORUM_PREVIEW;

/**
 * Kill switch global da biblioteca pessoal. A autorização real é por conta no servidor
 * (`feature_access`); esta flag só evita publicar a UI antes da hora.
 */
export const LIBRARY_ENABLED = import.meta.env.VITE_LIBRARY_ENABLED === "true";
