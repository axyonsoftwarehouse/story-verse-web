import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ebook } from "../../data/types";
import {
  abandonBook,
  recordFinished,
  recordOpened,
  setShelfEnabled,
  shelfEntry,
  shouldPromptFinish,
} from "../../lib/libraryStore";
import { AbandonBookDialog } from "./AbandonBookDialog";
import { BookStatusControl } from "./BookStatusControl";
import { FinishBookDialog } from "./FinishBookDialog";
import { RatingStars } from "./RatingStars";

const dom = { id: "gb-55752", gutenbergId: 55752, title: "Dom Casmurro", author: "Machado de Assis", textLanguage: "pt" } as Ebook;

beforeEach(() => {
  localStorage.clear();
  setShelfEnabled(true);
});

describe("componentes da estante", () => {
  it("estrelas: teclado muda meia estrela e o rótulo acompanha", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RatingStars value={4} onChange={onChange} />);
    const slider = screen.getByRole("slider", { name: "Nota 4 de 5" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith(4.5);
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith(3.5);
    fireEvent.keyDown(slider, { key: "Delete" });
    expect(onChange).toHaveBeenLastCalledWith(null);
    rerender(<RatingStars value={null} onChange={onChange} />);
    expect(screen.getByRole("slider", { name: "Sem nota" })).toBeInTheDocument();
    rerender(<RatingStars value={4.5} onChange={onChange} />);
    expect(screen.getByRole("slider", { name: "Nota 4,5 de 5" })).toBeInTheDocument();
  });

  it("estrelas: clicar na metade da estrela dá meia nota", () => {
    const onChange = vi.fn();
    render(<RatingStars value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Dar 2,5" }));
    expect(onChange).toHaveBeenCalledWith(2.5);
  });

  it("conclusão: salvar grava nota e resenha", () => {
    recordFinished(dom);
    const onClose = vi.fn();
    render(<FinishBookDialog book={dom} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Dar 4,5" }));
    fireEvent.change(screen.getByLabelText("Resenha (opcional)"), { target: { value: "Capitu é um enigma." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(shelfEntry("gb:55752")).toMatchObject({ rating: 4.5, review: "Capitu é um enigma." });
    expect(onClose).toHaveBeenCalled();
  });

  it("conclusão: 'Agora não' fecha sem gravar e não volta a aparecer", () => {
    recordFinished(dom);
    const onClose = vi.fn();
    render(<FinishBookDialog book={dom} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Você terminou. Que nota dá?" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(onClose).toHaveBeenCalled();
    expect(shelfEntry("gb:55752")?.rating).toBeNull();
    expect(shouldPromptFinish("gb:55752")).toBe(false);
  });

  it("abandono não envia sem motivo", () => {
    recordOpened(dom);
    render(<AbandonBookDialog bookKey="gb:55752" onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "Ritmo lento" }));
    fireEvent.click(screen.getByRole("button", { name: "Abandonar" }));
    expect(shelfEntry("gb:55752")).toMatchObject({ status: "abandoned", dnfReason: "slow" });
  });

  it("painel: datas incoerentes não salvam e abandonado pode retomar", () => {
    recordOpened(dom);
    abandonBook("gb:55752", "difficult", null);
    render(<BookStatusControl book={dom} onClose={() => {}} />);
    expect(screen.getByText("Abandonado")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Comecei em"), { target: { value: "2026-10-10" } });
    fireEvent.change(screen.getByLabelText("Terminei em"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar datas" }));
    expect(screen.getByText("A data de início é depois da conclusão.")).toBeInTheDocument();
    expect(shelfEntry("gb:55752")?.finishedOn).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retomar" }));
    expect(shelfEntry("gb:55752")).toMatchObject({ status: "reading", dnfReason: null });
  });

  it("painel: nota só aparece para livro já terminado", () => {
    recordOpened(dom);
    const { unmount } = render(<BookStatusControl book={dom} onClose={() => {}} />);
    expect(screen.queryByRole("slider")).toBeNull();
    unmount();
    recordFinished(dom);
    render(<BookStatusControl book={dom} onClose={() => {}} />);
    expect(screen.getByRole("slider", { name: "Sem nota" })).toBeInTheDocument();
  });

  it("diálogos saem da barra do leitor e vão direto para o body", () => {
    // A barra do leitor usa backdrop-filter: um position:fixed dentro dela fica preso aos 60px dela.
    recordOpened(dom);
    const { container } = render(
      <header className="reader-bar">
        <BookStatusControl book={dom} onClose={() => {}} />
        <FinishBookDialog book={dom} onClose={() => {}} />
        <AbandonBookDialog bookKey="gb:55752" onClose={() => {}} />
      </header>,
    );
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(3);
    for (const dialog of dialogs) {
      expect(container.contains(dialog)).toBe(false);
      expect(dialog.closest(".about-backdrop")?.parentElement).toBe(document.body);
    }
  });
});
