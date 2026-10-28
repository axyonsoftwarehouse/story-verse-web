import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useConfirm } from "./ConfirmDialog";

function Harness({ onResult }: { onResult: (ok: boolean) => void }) {
  const { confirm, dialog } = useConfirm();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          void confirm({
            title: "Sair da conta?",
            message: "Você precisará entrar de novo.",
            confirmLabel: "Sair",
            danger: true,
          }).then(onResult)
        }
      >
        Abrir
      </button>
      {dialog}
    </>
  );
}

describe("ConfirmDialog", () => {
  it("confirma e devolve true", async () => {
    let result: boolean | null = null;
    render(<Harness onResult={(ok) => (result = ok)} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    expect(screen.getByRole("alertdialog", { name: "Sair da conta?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    await waitFor(() => expect(result).toBe(true));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("cancelar devolve false; Escape também cancela", async () => {
    let result: boolean | null = null;
    render(<Harness onResult={(ok) => (result = ok)} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(result).toBe(false));

    fireEvent.click(screen.getByRole("button", { name: "Abrir" }));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(result).toBe(false));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
