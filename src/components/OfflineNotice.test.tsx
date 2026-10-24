import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineNotice } from "./OfflineNotice";

describe("aviso de modo offline", () => {
  const online = vi.spyOn(window.navigator, "onLine", "get");

  afterEach(() => {
    online.mockReset();
  });

  it("aparece quando a conexão cai e some quando volta", () => {
    online.mockReturnValue(true);
    render(<OfflineNotice />);
    expect(screen.queryByRole("status")).toBeNull();

    online.mockReturnValue(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sem conexão — você está vendo o que já foi carregado.",
    );

    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("já abre avisando se a página carregou sem rede", () => {
    online.mockReturnValue(false);
    render(<OfflineNotice />);
    expect(screen.getByRole("status")).toBeVisible();
  });
});
