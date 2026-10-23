import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ebook } from "../../data/types";
import { applyServerEntry, setShelfEnabled } from "../../lib/libraryStore";
import { LibraryPage } from "./LibraryPage";
import { e } from "./testEntry";

const toEbook = (entry: { bookKey: string; title: string; author: string | null }) =>
  ({ id: entry.bookKey.replace(":", "-"), gutenbergId: 1, title: entry.title, author: entry.author ?? "", textLanguage: "pt" }) as Ebook;

beforeEach(() => {
  localStorage.clear();
  setShelfEnabled(true);
});

describe("Minha estante", () => {
  it("estante vazia explica como começar", () => {
    render(<LibraryPage onClose={() => {}} onOpenBook={() => {}} available={() => true} bookFor={toEbook} />);
    expect(screen.getByText("Sua estante está vazia. Abra um livro e ele aparece aqui.")).toBeInTheDocument();
  });

  it("mostra 'arquivo removido' e não abre o livro", () => {
    applyServerEntry(e({ bookKey: "local:-1", source: "local", title: "Meu PDF" }), null, null);
    const onOpenBook = vi.fn();
    render(<LibraryPage onClose={() => {}} onOpenBook={onOpenBook} available={() => false} bookFor={toEbook} />);
    expect(screen.getByText("arquivo removido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir Meu PDF" })).toBeNull();
  });

  it("abre o livro e o painel do livro", () => {
    applyServerEntry(e({ bookKey: "gb:55752", title: "Dom Casmurro", author: "Machado de Assis", status: "reading" }), null, null);
    const onOpenBook = vi.fn();
    render(<LibraryPage onClose={() => {}} onOpenBook={onOpenBook} available={() => true} bookFor={toEbook} />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Dom Casmurro" }));
    expect(onOpenBook).toHaveBeenCalledWith(expect.objectContaining({ title: "Dom Casmurro" }));
    fireEvent.click(screen.getByRole("button", { name: "Detalhes de Dom Casmurro" }));
    expect(screen.getByRole("dialog", { name: "Dom Casmurro" })).toBeInTheDocument();
  });

  it("filtro sem resultado avisa", () => {
    applyServerEntry(e({ bookKey: "gb:55752", title: "Dom Casmurro", status: "reading" }), null, null);
    render(<LibraryPage onClose={() => {}} onOpenBook={() => {}} available={() => true} bookFor={toEbook} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "finished" } });
    expect(screen.getByText("Nenhum livro com esses filtros.")).toBeInTheDocument();
  });
});
