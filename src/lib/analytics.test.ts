import { afterEach, describe, expect, it } from "vitest";
import { installAnalytics, resetAnalyticsForTests, umamiBeforeSend } from "./analytics";

function tracker(): HTMLScriptElement | null {
  return document.head.querySelector('script[src="/u/script.js"]');
}

afterEach(() => {
  tracker()?.remove();
  resetAnalyticsForTests();
});

describe("installAnalytics", () => {
  it("não coloca o tracker sem o id do site", () => {
    installAnalytics("");
    expect(tracker()).toBeNull();
  });

  it("coloca o tracker pela mesma origem, sem query string nem hash", () => {
    installAnalytics("site-qa");
    const script = tracker();
    expect(script).not.toBeNull();
    expect(script?.defer).toBe(true);
    expect(script?.dataset).toMatchObject({
      websiteId: "site-qa",
      hostUrl: "/u",
      excludeSearch: "true",
      excludeHash: "true",
      doNotTrack: "true",
      beforeSend: "storyverseUmamiBeforeSend",
    });
    expect(script?.getAttribute("data-performance")).toBe("true");
    expect((window as unknown as Record<string, unknown>).storyverseUmamiBeforeSend).toBe(
      umamiBeforeSend,
    );
  });

  it("instala uma vez só", () => {
    installAnalytics("site-qa");
    installAnalytics("site-qa");
    expect(document.head.querySelectorAll('script[src="/u/script.js"]')).toHaveLength(1);
  });
});

describe("umamiBeforeSend", () => {
  const QA = "https://qa.storyverse.2.29.42.104.sslip.io";

  it("descarta as telas da equipe", () => {
    expect(umamiBeforeSend("event", { url: "/admin" })).toBe(false);
    expect(umamiBeforeSend("event", { url: "/admin/metricas?x=1" })).toBe(false);
  });

  it("descarta as telas da equipe com a URL completa, que é o que o Umami 3 manda", () => {
    expect(umamiBeforeSend("event", { url: `${QA}/admin` })).toBe(false);
    expect(umamiBeforeSend("performance", { url: `${QA}/admin/financeiro` })).toBe(false);
  });

  it("deixa passar o resto do site", () => {
    const payload = { url: "/biblioteca", website: "site-qa" };
    expect(umamiBeforeSend("event", payload)).toBe(payload);
    expect(umamiBeforeSend("event", { url: "/administracao" })).not.toBe(false);
    expect(umamiBeforeSend("event", { url: `${QA}/biblioteca` })).not.toBe(false);
    expect(umamiBeforeSend("event", {})).not.toBe(false);
  });
});
