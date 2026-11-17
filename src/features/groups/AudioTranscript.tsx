import { useState } from "react";
import { downloadModel, transcribe, TranscriptError } from "../../lib/audioTranscript";

type Estado =
  | { tipo: "inicio" }
  | { tipo: "verificando" }
  | { tipo: "baixarModelo" }
  | { tipo: "baixando" }
  | { tipo: "transcrevendo" }
  | { tipo: "texto"; texto: string }
  | { tipo: "aviso"; mensagem: string };

/**
 * “Ler transcrição” embaixo do áudio da conversa. A transcrição acontece **no aparelho**; quando o
 * navegador só sabe transcrever na nuvem, o botão explica em vez de mandar o áudio para fora.
 */
export function AudioTranscript({ url }: { url: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicio" });

  async function transcrever() {
    setEstado({ tipo: "verificando" });
    try {
      const texto = await transcribe(url);
      setEstado({ tipo: "texto", texto });
    } catch (erro) {
      if (erro instanceof TranscriptError && erro.reason === "needs-download") {
        setEstado({ tipo: "baixarModelo" });
        return;
      }
      if (erro instanceof TranscriptError && erro.reason === "empty") {
        setEstado({ tipo: "aviso", mensagem: "Não deu para entender a fala deste áudio." });
        return;
      }
      if (erro instanceof TranscriptError && erro.reason === "unsupported") {
        setEstado({
          tipo: "aviso",
          mensagem: "Este navegador não transcreve no próprio aparelho. Para não mandar seu áudio para um serviço externo, a leitura fica desligada aqui.",
        });
        return;
      }
      setEstado({ tipo: "aviso", mensagem: "Não foi possível transcrever agora. Tente de novo." });
    }
  }

  async function baixarModelo() {
    setEstado({ tipo: "baixando" });
    const ok = await downloadModel();
    if (!ok) {
      setEstado({
        tipo: "aviso",
        mensagem: "O download do modelo de voz não terminou. Esse modelo é oferecido pelo Google Chrome; em outros navegadores a transcrição no aparelho não existe.",
      });
      return;
    }
    await transcrever();
  }

  const ocupado = estado.tipo === "verificando" || estado.tipo === "baixando" || estado.tipo === "transcrevendo";

  if (estado.tipo === "texto") {
    return (
      <span className="audio-transcript">
        <button type="button" className="audio-transcript-toggle" onClick={() => setEstado({ tipo: "inicio" })}>
          Ocultar transcrição
        </button>
        <span className="audio-transcript-text" role="status">
          {estado.texto}
        </span>
      </span>
    );
  }

  return (
    <span className="audio-transcript">
      <button
        type="button"
        className="audio-transcript-toggle"
        disabled={ocupado}
        aria-busy={ocupado || undefined}
        onClick={() => void transcrever()}
      >
        {estado.tipo === "verificando" || estado.tipo === "transcrevendo" ? "Transcrevendo…" : "Ler transcrição"}
      </button>
      {estado.tipo === "baixarModelo" ? (
        <>
          <small className="audio-transcript-note">
            O modelo de voz em português ainda não está neste aparelho. O download é de uma vez (~100 MB), fica no
            navegador e é oferecido pelo Google Chrome.
          </small>
          <button type="button" className="audio-transcript-toggle" onClick={() => void baixarModelo()}>
            Baixar modelo de voz
          </button>
        </>
      ) : null}
      {estado.tipo === "baixando" ? <small className="audio-transcript-note">Baixando o modelo de voz…</small> : null}
      {estado.tipo === "aviso" ? (
        <small className="audio-transcript-note" role="alert">
          {estado.mensagem}
        </small>
      ) : null}
    </span>
  );
}
