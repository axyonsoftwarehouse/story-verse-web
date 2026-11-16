import type { Dispatch, SetStateAction } from "react";
import { Icon } from "../../components/Icon";
import { naturalVoiceSupported, type NaturalVoice } from "../../lib/naturalVoice";
import { RATE_OPTIONS, type VoiceOption } from "../../lib/speech";

/** Painel da leitura em voz alta: voz, velocidade e voz natural. */
export function VoicePanel({
  chooseRate,
  chooseVoice,
  declineNaturalVoice,
  getNaturalVoice,
  missingNatural,
  naturalDownload: download,
  naturalError,
  setVoicePanelOpen,
  speechRate,
  storedNatural,
  voices,
  voiceUri,
}: {
  chooseRate: (rate: number) => void;
  chooseVoice: (uri: string) => void;
  declineNaturalVoice: () => void;
  getNaturalVoice: (id: string) => Promise<void>;
  missingNatural: NaturalVoice[];
  naturalDownload: { id: string; pct: number } | null;
  naturalError: string | null;
  setVoicePanelOpen: Dispatch<SetStateAction<boolean>>;
  speechRate: number;
  storedNatural: string[] | null;
  voices: VoiceOption[];
  voiceUri: string | undefined;
}) {
  const naturalDownload = download;
  return (
    <>
      <div className="voice-backdrop" onClick={() => setVoicePanelOpen(false)} />
      <div className="voice-panel" role="dialog" aria-label="Voz e velocidade">
        <div className="voice-panel-head">
          <strong>Voz e velocidade</strong>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setVoicePanelOpen(false)}
            aria-label="Fechar"
          >
            {Icon.close}
          </button>
        </div>

        <span className="voice-label">Velocidade</span>
        <div className="voice-rates" role="group" aria-label="Velocidade">
          {RATE_OPTIONS.map((r) => (
            <button
              key={r}
              type="button"
              className={r === speechRate ? "active" : undefined}
              aria-pressed={r === speechRate}
              onClick={() => chooseRate(r)}
            >
              {String(r).replace(".", ",")}x
            </button>
          ))}
        </div>

        <span className="voice-label">Voz</span>
        {naturalVoiceSupported() && missingNatural.length > 0 ? (
          <div className="voice-natural">
            {storedNatural?.length ? (
              <>
                <strong>✨ Mais vozes naturais</strong>
                <span>
                  Cada uma baixa uma vez (cerca de 60 MB) e fica guardada aqui; prefira usar o
                  Wi-Fi.
                </span>
              </>
            ) : (
              <>
                <strong>✨ Voz natural</strong>
                <span>
                  Bem mais humana que as vozes do aparelho. Escolha uma: ela baixa uma vez (cerca de
                  60 MB) e fica guardada aqui; prefira usar o Wi-Fi.
                </span>
              </>
            )}
            <ul className="voice-natural-options">
              {missingNatural.map((v) => (
                <li key={v.id}>
                  <span className="voice-natural-name">{v.name}</span>
                  {naturalDownload?.id === v.id ? (
                    <span className="voice-natural-progress">
                      <span
                        className="voice-natural-bar"
                        role="progressbar"
                        aria-label={`Baixando a voz ${v.name}`}
                        aria-valuenow={naturalDownload.pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${Math.max(3, naturalDownload.pct)}%` }} />
                      </span>
                      <small>{naturalDownload.pct}%</small>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={naturalDownload !== null}
                      aria-label={`Baixar a voz ${v.name}`}
                      onClick={() => void getNaturalVoice(v.id)}
                    >
                      {naturalError === v.id ? "Tentar de novo" : "Baixar"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {naturalError ? (
              <small>Não deu para baixar agora. Confira a internet e tente de novo.</small>
            ) : null}
            {!storedNatural?.length && !naturalDownload ? (
              <button
                type="button"
                className="link-btn voice-natural-later"
                onClick={declineNaturalVoice}
              >
                Agora não
              </button>
            ) : null}
          </div>
        ) : null}
        {voices.length === 0 ? (
          <p className="voice-tip">Procurando as vozes deste aparelho…</p>
        ) : (
          <ul className="voice-list">
            {voices.map((v) => (
              <li key={v.uri}>
                <button
                  type="button"
                  className={v.uri === voiceUri ? "active" : undefined}
                  aria-pressed={v.uri === voiceUri}
                  onClick={() => chooseVoice(v.uri)}
                >
                  <span>{v.label}</span>
                  {v.natural ? <em>natural</em> : null}
                </button>
              </li>
            ))}
          </ul>
        )}

        {voices.length > 0 && !voices.some((v) => v.natural) ? (
          <p className="voice-tip">
            Este aparelho só tem vozes simples. Para uma voz quase humana, grátis: abra o Storyverse
            no <strong>Microsoft Edge</strong> (vozes Francisca e Antônio) ou, no iPhone, baixe uma
            voz <strong>Aprimorada</strong> em Ajustes › Acessibilidade › Conteúdo Falado › Vozes.
          </p>
        ) : null}
      </div>
    </>
  );
}
