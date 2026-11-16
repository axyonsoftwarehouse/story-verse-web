import type { Dispatch, SetStateAction } from "react";
import { Icon } from "../../components/Icon";
import {
  FONT_SIZES,
  NightLight,
  NIGHT_LIGHT_LABELS,
  type ReadingPrefs,
} from "../../lib/readingPrefs";

/** Ajustes de leitura: tamanho da letra, tema, luz noturna e voz. */
export function ReaderSettingsPanel({
  immersive,
  isFullscreen,
  prefs,
  setPrefs,
  setReaderSettingsOpen,
  toggleReadingFullscreen,
}: {
  immersive: boolean;
  isFullscreen: boolean;
  prefs: ReadingPrefs;
  setPrefs: Dispatch<SetStateAction<ReadingPrefs>>;
  setReaderSettingsOpen: Dispatch<SetStateAction<boolean>>;
  toggleReadingFullscreen: () => Promise<void>;
}) {
  return (
    <div className="reader-settings" role="dialog" aria-label="Ajustes de leitura">
      <div className="reader-settings-head">
        <strong>Ajustes de leitura</strong>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setReaderSettingsOpen(false)}
          aria-label="Fechar ajustes"
        >
          {Icon.close}
        </button>
      </div>
      <div className="reader-settings-row">
        <span>Tamanho da letra</span>
        <div className="reader-settings-actions">
          <button
            type="button"
            className="btn"
            disabled={prefs.fontStep <= 0}
            onClick={() => setPrefs((p) => ({ ...p, fontStep: p.fontStep - 1 }))}
            aria-label="Diminuir letra"
          >
            A−
          </button>
          <strong>{Math.round(FONT_SIZES[prefs.fontStep] * 16)}px</strong>
          <button
            type="button"
            className="btn"
            disabled={prefs.fontStep >= FONT_SIZES.length - 1}
            onClick={() => setPrefs((p) => ({ ...p, fontStep: p.fontStep + 1 }))}
            aria-label="Aumentar letra"
          >
            A+
          </button>
        </div>
      </div>
      <div className="reader-settings-row">
        <span>Tema</span>
        <div className="segmented">
          <button
            type="button"
            role="radio"
            aria-checked={prefs.theme === "night"}
            className={prefs.theme === "night" ? "is-on" : ""}
            onClick={() => setPrefs((p) => ({ ...p, theme: "night" }))}
          >
            Noturno
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={prefs.theme === "sepia"}
            className={prefs.theme === "sepia" ? "is-on" : ""}
            onClick={() => setPrefs((p) => ({ ...p, theme: "sepia" }))}
          >
            Sépia
          </button>
        </div>
      </div>
      <div className="reader-settings-row">
        <span>Luz noturna</span>
        <button
          type="button"
          className="btn"
          onClick={() =>
            setPrefs((p) => ({ ...p, nightLight: ((p.nightLight + 1) % 3) as NightLight }))
          }
        >
          {NIGHT_LIGHT_LABELS[prefs.nightLight]}
        </button>
      </div>
      <div className="reader-settings-row">
        <span>Tela cheia</span>
        <button type="button" className="btn" onClick={() => void toggleReadingFullscreen()}>
          {isFullscreen || immersive ? "Sair" : "Entrar"}
        </button>
      </div>
    </div>
  );
}
