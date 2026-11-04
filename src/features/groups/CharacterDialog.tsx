import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { refreshAuthSession } from "../../lib/auth";
import { setCharacter, type Group } from "../../lib/groups";
import { prepareImage, uploadGroupPhoto } from "../../lib/profileMedia";
import { PersonFace } from "./GroupParts";
import { GIcon } from "./groupIcons";

/**
 * Roleplay: criar ou editar o personagem da pessoa (nome e foto). Dentro do grupo, a foto e o
 * nome do personagem aparecem no lugar dos dela.
 */
export function CharacterDialog({ group, me, onClose, onSaved }: { group: Group; me: string; onClose: () => void; onSaved: (g: Group) => void }) {
  const [name, setName] = useState(group.my_character ?? "");
  const [photo, setPhoto] = useState<string | null>(group.my_character_photo ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = Boolean(group.my_character);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      // Recorte quadrado no centro, como a foto de perfil.
      const prepared = await prepareImage(file, "avatar");
      setBlob(prepared);
      setPreview(URL.createObjectURL(prepared));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível usar esta imagem.");
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      let url = photo;
      if (blob) url = await uploadGroupPhoto(await refreshAuthSession(), blob);
      onSaved(await setCharacter(group.id, trimmed, url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar o personagem.");
      setBusy(false);
    }
  }

  const shown = preview ?? photo;

  return createPortal(
    <div className="about-backdrop group-sheet-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="group-sheet group-character" role="dialog" aria-modal="true" aria-labelledby="character-title" onSubmit={save}>
        <header className="group-sheet-head">
          <h2 id="character-title">{editing ? "Seu personagem" : "Criar seu personagem"}</h2>
          <button type="button" className="group-icon-btn" onClick={onClose} aria-label="Fechar" disabled={busy}>
            {GIcon.close}
          </button>
        </header>
        <p className="group-sheet-sub">Neste grupo, todo mundo vê a foto e o nome do seu personagem no lugar dos seus.</p>

        <div className="group-character-photo">
          <button type="button" className="group-photo-pick" onClick={() => fileRef.current?.click()} aria-label="Escolher a foto do personagem">
            <span className="group-character-face">
              <PersonFace id={me} name={name || "?"} photo={shown} />
            </span>
            <span className="group-photo-badge">{GIcon.camera}</span>
          </button>
          <div className="group-form-photo-text">
            <strong>Foto do personagem</strong>
            <span>Um retrato, uma ilustração, o que combinar com a história.</span>
            {shown ? (
              <button
                type="button"
                className="group-text-btn"
                onClick={() => {
                  setBlob(null);
                  setPreview(null);
                  setPhoto(null);
                }}
              >
                Tirar foto
              </button>
            ) : null}
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
        </div>

        <label className="group-field">
          <span>Nome do personagem</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder="Ex.: Mina Harker" autoFocus={!editing} />
        </label>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="group-sheet-actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Salvando…" : editing ? "Salvar" : "Entrar na história"}
          </button>
        </footer>
      </form>
    </div>,
    document.body,
  );
}
