import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components/Icon";
import { installPlatform, storeLinks, type InstallPlatform } from "../../lib/pwa";

/** Passo a passo para instalar o site como app, por aparelho. */
const INSTALL_STEPS: Record<InstallPlatform, { label: string; steps: React.ReactNode[] }> = {
  ios: {
    label: "iPhone e iPad",
    steps: [
      <>
        No Safari, toque em <strong>Compartilhar</strong> {Icon.share}
      </>,
      <>
        Escolha <strong>Adicionar à Tela de Início</strong>
      </>,
      <>
        Toque em <strong>Adicionar</strong>
      </>,
    ],
  },
  android: {
    label: "Android",
    steps: [
      <>
        Toque no menu <strong>⋮</strong> do navegador
      </>,
      <>
        Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>
      </>,
      <>
        Confirme em <strong>Instalar</strong>
      </>,
    ],
  },
  desktop: {
    label: "Computador (Chrome ou Edge)",
    steps: [
      <>Clique no ícone de instalar, no fim da barra de endereço</>,
      <>
        Ou abra o menu <strong>⋮</strong> / <strong>···</strong> e procure{" "}
        <strong>Instalar Storyverse</strong>
      </>,
    ],
  },
  "mac-safari": {
    label: "Mac (Safari)",
    steps: [
      <>
        No menu <strong>Arquivo</strong>, escolha <strong>Adicionar ao Dock</strong>
      </>,
    ],
  },
  "firefox-desktop": {
    label: "Firefox no computador",
    steps: [
      <>O Firefox no computador não instala sites como app.</>,
      <>
        Abra o Storyverse no <strong>Chrome</strong> ou no <strong>Edge</strong>, ou instale no
        celular
      </>,
    ],
  },
};

/** "Baixar app": lojas (se houver), o botão nativo do navegador ou o passo a passo do aparelho. */
export function InstallAppDialog({
  install,
  onClose,
}: {
  install: (() => Promise<void>) | null;
  onClose: () => void;
}) {
  const platform = useMemo(() => installPlatform(), []);
  const stores = useMemo(() => storeLinks(), []);
  const [copied, setCopied] = useState(false);
  const here = INSTALL_STEPS[platform];
  const others = (Object.keys(INSTALL_STEPS) as InstallPlatform[]).filter(
    (p) =>
      p !== platform &&
      p !== "firefox-desktop" &&
      !(platform === "firefox-desktop" && p === "desktop"),
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="about-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="spin-dialog install-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
      >
        <button
          type="button"
          className="auth-close spin-close"
          onClick={onClose}
          aria-label="Fechar"
        >
          {Icon.close}
        </button>
        <img className="install-icon" src="/icons/icon-192.png" alt="" width={64} height={64} />
        <h2 id="install-title">Baixe o Storyverse</h2>
        <p className="spin-sub">Grátis. Abre em tela cheia e funciona sem internet.</p>

        {stores.android || stores.ios ? (
          <div className="install-stores">
            {stores.android && platform !== "ios" ? (
              <a
                className="btn btn-primary"
                href={stores.android}
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Play
              </a>
            ) : null}
            {stores.ios && platform !== "android" ? (
              <a
                className="btn btn-primary"
                href={stores.ios}
                target="_blank"
                rel="noopener noreferrer"
              >
                App Store
              </a>
            ) : null}
          </div>
        ) : null}

        {install ? (
          <button
            type="button"
            className="btn btn-primary install-now"
            onClick={() => {
              void install().finally(onClose);
            }}
          >
            {Icon.download} Instalar agora
          </button>
        ) : (
          <div className="install-steps">
            <span className="shop-section-title">{here.label}</span>
            <ol>
              {here.steps.map((step, i) => (
                <li key={i}>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <details className="install-other">
          <summary>Instalar em outro aparelho</summary>
          {others.map((p) => (
            <div key={p} className="install-steps">
              <span className="shop-section-title">{INSTALL_STEPS[p].label}</span>
              <ol>
                {INSTALL_STEPS[p].steps.map((step, i) => (
                  <li key={i}>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <button type="button" className="btn install-copy" onClick={() => void copyLink()}>
            {copied ? "Link copiado ✓" : "Copiar link do site"}
          </button>
        </details>
      </section>
    </div>
  );
}
