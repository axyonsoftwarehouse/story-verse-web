import { afterEach, describe, expect, it } from "vitest";
import { grantRemoteTranslationConsent, hasRemoteTranslationConsent } from "./translate";

afterEach(() => localStorage.clear());

describe("consentimento da tradução remota", () => {
  it("começa sem consentimento e passa a valer depois de concedido", () => {
    expect(hasRemoteTranslationConsent()).toBe(false);
    grantRemoteTranslationConsent();
    expect(hasRemoteTranslationConsent()).toBe(true);
  });
});
