import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate, type NavigateFunction } from "react-router-dom";
import { ScrollToTop } from "./ScrollToTop";

afterEach(() => vi.restoreAllMocks());

let navigate: NavigateFunction;
function Grab() {
  navigate = useNavigate();
  return null;
}

describe("ScrollToTop", () => {
  it("leva ao topo ao abrir outra página, mas não ao voltar", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/"]}>
        <ScrollToTop />
        <Grab />
      </MemoryRouter>,
    );
    scrollTo.mockClear();

    act(() => navigate("/biblioteca"));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);

    scrollTo.mockClear();
    act(() => navigate(-1));
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
