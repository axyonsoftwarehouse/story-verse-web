import { describe, expect, it } from "vitest";
import { validateProductionConfig } from "./buildConfig";
describe("production backend configuration", () => {
  it("rejects loopback and missing backend", () => {
    expect(() => validateProductionConfig({})).toThrow();
    expect(() => validateProductionConfig({ VITE_API_URL: "http://127.0.0.1:54421" })).toThrow();
  });
  it("rejects private AI credentials even when a valid API is configured", () => {
    expect(() => validateProductionConfig({ VITE_API_URL: "https://api.example.test", VITE_GROQ_API_KEY: "secret" })).toThrow();
  });
  it("accepts a public HTTPS API", () => {
    expect(() => validateProductionConfig({ VITE_API_URL: "https://api.example.test" })).not.toThrow();
  });
});
