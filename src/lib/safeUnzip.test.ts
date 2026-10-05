import { gzipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { gunzipToString } from "./safeUnzip";

describe("gunzipToString", () => {
  it("descomprime quando o texto cabe no teto", () => {
    const text = JSON.stringify({ hello: "mundo", n: 42 });
    expect(gunzipToString(gzipSync(strToU8(text)), 1024)).toBe(text);
  });

  it("recusa quando o texto passa do teto (gzip bomb)", () => {
    const gz = gzipSync(strToU8("a".repeat(100_000)));
    expect(() => gunzipToString(gz, 1024)).toThrow(/grande demais/i);
  });

  it("recusa bytes que não são gzip válido", () => {
    expect(() => gunzipToString(new Uint8Array([1, 2, 3, 4]), 1024)).toThrow();
  });
});
