import { Unzip, UnzipInflate } from "fflate";

/** Limits actual emitted bytes, including archives that lie about their directory sizes. */
export async function unzipBounded(bytes: Uint8Array, maxTotal = 64 * 1024 * 1024, maxEntry = 16 * 1024 * 1024, maxFiles = 2000): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>;
  let total = 0;
  let count = 0;
  const unzip = new Unzip((file) => {
    if (++count > maxFiles || file.originalSize !== undefined && file.originalSize > maxEntry)
      throw new Error("EPUB grande demais.");
    if (file.name.includes("..") || file.name.startsWith("/") || Object.hasOwn(files, file.name))
      throw new Error("Caminho inválido no EPUB.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    file.ondata = (error, data, final) => {
      if (error) throw error;
      total += data.length;
      size += data.length;
      if (size > maxEntry || total > maxTotal) { file.terminate(); throw new Error("EPUB grande demais."); }
      chunks.push(data.slice());
      if (final) {
        const result = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
        files[file.name] = result;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    unzip.push(bytes.subarray(offset, offset + 1024), offset + 1024 >= bytes.length);
    if (offset > 0 && offset % 65536 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return files;
}
