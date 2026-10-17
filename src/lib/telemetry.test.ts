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
