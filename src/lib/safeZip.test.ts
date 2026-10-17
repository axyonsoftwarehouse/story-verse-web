import { describe, expect, it } from "vitest";
import { zipSync, strToU8, strFromU8 } from "fflate";
import { unzipBounded } from "./safeZip";

describe("EPUB extraction limits", () => {
  it("extracts ordinary chapter files", async () => {
    const result = await unzipBounded(zipSync({ "text/chapter.xhtml": strToU8("chapter") }));
    expect(strFromU8(result["text/chapter.xhtml"])).toBe("chapter");
  });
  it("rejects small compressed files with oversized output", async () => {
    await expect(unzipBounded(zipSync({ chapter: strToU8("a".repeat(100_000)) }), 2000, 1000)).rejects.toThrow(/grande demais/);
  });
  it("enforces aggregate size and file count", async () => {
    const bytes = zipSync({ a: strToU8("a".repeat(600)), b: strToU8("b".repeat(600)) });
    await expect(unzipBounded(bytes, 1000, 1000)).rejects.toThrow();
    await expect(unzipBounded(bytes, 3000, 1000, 1)).rejects.toThrow();
  });
  it("does not trust a forged uncompressed size in the ZIP header", async () => {
    const bytes = zipSync({ chapter: strToU8("x".repeat(100_000)) });
    // Local header's uncompressed-size field. Streaming output must still enforce the limit.
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(22, 1, true);
    await expect(unzipBounded(bytes, 2000, 1000)).rejects.toThrow(/grande demais/);
  });
});
