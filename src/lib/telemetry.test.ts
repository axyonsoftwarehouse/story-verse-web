import { describe, expect, it } from "vitest";
import { sanitizeTelemetry } from "./telemetry";

describe("telemetry credentials", () => {
  it("removes URL query and fragment and redacts nested credentials", () => {
    const result = sanitizeTelemetry({ url: "https://example.test/login?code=secret#access_token=access&refresh_token=refresh", nested: { refresh_token: "refresh" } });
    expect(result.url).toBe("https://example.test/login");
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(result.nested.refresh_token).toBe("[redacted]");
  });
  it("sanitizes credentials embedded in error strings", () => {
    expect(sanitizeTelemetry("failed access_token=abc&refresh_token=xyz")).not.toMatch(/abc|xyz/);
  });
});

describe("respostas esperadas da API (S10)", () => {
  it("401, 402 e 403 não viram issue; 400, 409 e 500 viram", async () => {
    const { ApiHttpError } = await import("./backend");
    const { isExpectedFailure } = await import("./telemetry");
    const erro = (status: number) => new ApiHttpError("x", status, undefined, {});
    expect(isExpectedFailure(erro(401))).toBe(true);
    expect(isExpectedFailure(erro(402))).toBe(true);
    expect(isExpectedFailure(erro(403))).toBe(true);
    expect(isExpectedFailure(erro(400))).toBe(false);
    expect(isExpectedFailure(erro(409))).toBe(false);
    expect(isExpectedFailure(erro(500))).toBe(false);
  });
});
