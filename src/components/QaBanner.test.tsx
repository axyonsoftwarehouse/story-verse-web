import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QaBanner } from "./QaBanner";

describe("faixa do ambiente de QA", () => {
  it("mostra a faixa só no QA", () => {
    const { rerender } = render(<QaBanner env="qa" />);
    expect(screen.getByRole("status")).toHaveTextContent("Ambiente de QA — dados de teste, nada aqui é real.");
    rerender(<QaBanner env="production" />);
    expect(screen.queryByRole("status")).toBeNull();
    rerender(<QaBanner />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
