/**
 * Microfone: em que pé está a permissão e como liberar em cada aparelho.
 *
 * Um site não consegue abrir as configurações do navegador (é bloqueado por segurança). O que dá
 * para fazer: pedir pela janelinha nativa quando ainda pode, e, se estiver bloqueado, mostrar o
 * caminho exato do aparelho da pessoa e voltar a gravar sozinho assim que ela liberar.
 */

export type MicState = "granted" | "prompt" | "denied" | "unknown";

/** Estado atual da permissão (Chrome, Edge, Firefox e Safari 16+ informam; os outros: "unknown"). */
export async function micPermission(): Promise<MicState> {
  try {
    const status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
    return (status?.state as MicState | undefined) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Avisa quando a permissão muda (a pessoa liberou nas configurações). Devolve a função que para de
 * observar. Onde o navegador não avisa, verifica a cada 1,5 s.
 */
export function watchMicPermission(onChange: (state: MicState) => void): () => void {
  let stopped = false;
  let status: PermissionStatus | null = null;
  const handler = () => !stopped && status && onChange(status.state as MicState);
  let poll = 0;
  void navigator.permissions
    ?.query({ name: "microphone" as PermissionName })
    .then((s) => {
      if (stopped) return;
      status = s;
      s.addEventListener("change", handler);
    })
    .catch(() => {
      poll = window.setInterval(() => void micPermission().then((s) => !stopped && onChange(s)), 1500);
    });
  return () => {
    stopped = true;
    status?.removeEventListener("change", handler);
    window.clearInterval(poll);
  };
}

/** Por que o microfone não abriu, a partir do erro do getUserMedia. */
export type MicProblem = "blocked" | "missing" | "busy" | "insecure" | "unsupported";

export function micProblem(error: unknown): MicProblem {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "missing";
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") return "busy";
  if (name === "SecurityError") return "insecure";
  return "blocked";
}

/** Texto curto para os problemas que não são de permissão. */
export function micProblemText(problem: Exclude<MicProblem, "blocked">): string {
  switch (problem) {
    case "missing":
      return "Nenhum microfone encontrado neste aparelho.";
    case "busy":
      return "O microfone está sendo usado por outro app (chamada, gravador…). Feche e tente de novo.";
    case "insecure":
      return "Gravar áudio só funciona no endereço seguro do Storyverse (https).";
    default:
      return "Este navegador não grava áudio.";
  }
}

export type Platform = "ios" | "android-app" | "android" | "desktop-chrome" | "desktop-firefox" | "desktop-safari";

/** Onde a pessoa está, para mostrar o caminho certo. */
export function detectPlatform(ua: string, standalone: boolean): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) return "ios";
  if (/Android/i.test(ua)) return standalone ? "android-app" : "android";
  if (/Firefox\//i.test(ua)) return "desktop-firefox";
  if (/Safari\//i.test(ua) && !/Chrome\/|Chromium\/|Edg\//i.test(ua)) return "desktop-safari";
  return "desktop-chrome";
}

export function currentPlatform(): Platform {
  const standalone = typeof window !== "undefined" && Boolean(window.matchMedia?.("(display-mode: standalone)").matches);
  return detectPlatform(typeof navigator === "undefined" ? "" : navigator.userAgent, standalone);
}

/** Passo a passo para liberar o microfone, do jeito que aparece em cada aparelho. */
export function micSteps(platform: Platform): string[] {
  switch (platform) {
    case "ios":
      return [
        "Toque em **aA** (ou no ícone à esquerda do endereço), na barra do Safari.",
        "Toque em **Ajustes do Site**.",
        "Em **Microfone**, escolha **Permitir**.",
      ];
    case "android-app":
      return [
        "Toque e segure o ícone do **Storyverse** na tela inicial e toque em **Informações do app** (ⓘ).",
        "Abra **Permissões** › **Microfone**.",
        "Escolha **Permitir só durante o uso do app**.",
      ];
    case "android":
      return [
        "Toque no ícone à esquerda do endereço (🔒 ou ⚙️), na barra do Chrome.",
        "Toque em **Permissões** e depois em **Microfone**.",
        "Escolha **Permitir**.",
      ];
    case "desktop-firefox":
      return [
        "Clique no ícone de **microfone riscado** à esquerda do endereço.",
        "Em **Usar o microfone**, clique no **×** de **Bloqueado**.",
        "Toque no 🎤 de novo e escolha **Permitir**.",
      ];
    case "desktop-safari":
      return [
        "No menu **Safari**, abra **Ajustes para este site…**.",
        "Em **Microfone**, escolha **Permitir**.",
      ];
    default:
      return [
        "Clique no ícone à esquerda do endereço (🔒 ou ⚙️), no topo do navegador.",
        "Em **Microfone**, troque para **Permitir**.",
      ];
  }
}
