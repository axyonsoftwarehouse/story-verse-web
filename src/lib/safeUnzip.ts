import { gunzipSync, strFromU8 } from "fflate";

/**
 * Descomprime um gzip para texto com teto de tamanho: o buffer de saída é fixo, então um arquivo
 * hostil (gzip bomb) não expande na memória — o fflate escreve até encher e para. Se o texto não
 * couber (ou o arquivo não for gzip válido), lança.
 */
export function gunzipToString(bytes: Uint8Array, maxBytes: number): string {
  if (bytes.length > maxBytes) throw new Error("Arquivo comprimido grande demais.");
  const out = new Uint8Array(maxBytes);
  let decoded: Uint8Array;
  try {
    decoded = gunzipSync(bytes, { out });
  } catch {
    throw new Error("Não foi possível ler o arquivo comprimido.");
  }
  if (decoded.length >= maxBytes) throw new Error("Arquivo grande demais.");
  return strFromU8(decoded);
}
