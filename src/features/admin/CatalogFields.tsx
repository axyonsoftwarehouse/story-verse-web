import { CATALOG_GENRES, type CatalogRights } from "../../lib/adminCatalog";
import type {
  CatalogMetadataValue,
  CatalogRightsValue,
} from "./catalogFormValues";

const RIGHTS_OPTIONS: { id: CatalogRights; label: string; hint: string }[] = [
  {
    id: "public_domain",
    label: "Domínio público",
    hint: "O autor morreu há mais de 70 anos (ex.: Machado de Assis, Alencar, Eça).",
  },
  {
    id: "own_work",
    label: "Obra própria",
    hint: "O texto é seu e você autoriza a distribuição no Storyverse.",
  },
  {
    id: "free_license",
    label: "Licença livre",
    hint: "Creative Commons ou outra licença que permita redistribuir a obra.",
  },
];

export function CatalogMetadataFields({
  value,
  onChange,
  disabled,
}: {
  value: CatalogMetadataValue;
  onChange: (patch: Partial<CatalogMetadataValue>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="catalog-form-grid">
      <label className="catalog-field is-wide">
        Título *
        <input
          value={value.title}
          onChange={(event) => onChange({ title: event.target.value })}
          maxLength={200}
          required
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      <label className="catalog-field">
        Autor
        <input
          value={value.author}
          onChange={(event) => onChange({ author: event.target.value })}
          maxLength={200}
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      <label className="catalog-field">
        Gênero
        <input
          value={value.genre}
          onChange={(event) => onChange({ genre: event.target.value })}
          list="catalog-genres"
          maxLength={80}
          disabled={disabled}
          autoComplete="off"
          placeholder="Ex.: Clássico"
        />
        <datalist id="catalog-genres">
          {CATALOG_GENRES.map((genre) => (
            <option key={genre} value={genre} />
          ))}
        </datalist>
      </label>

      <label className="catalog-field">
        Idioma
        <select
          value={value.language}
          onChange={(event) =>
            onChange({ language: event.target.value === "en" ? "en" : "pt" })
          }
          disabled={disabled}
        >
          <option value="pt">Português</option>
          <option value="en">Inglês</option>
        </select>
      </label>

      <label className="catalog-field">
        Número de páginas
        <input
          type="number"
          min={0}
          step={1}
          value={value.pageCount}
          onChange={(event) => onChange({ pageCount: event.target.value })}
          disabled={disabled}
          placeholder="Calculado pelo arquivo"
        />
      </label>

      <label className="catalog-field">
        Série
        <input
          value={value.series}
          onChange={(event) => onChange({ series: event.target.value })}
          maxLength={200}
          disabled={disabled}
          placeholder="Opcional"
        />
      </label>

      <label className="catalog-field">
        Volume na série
        <input
          type="number"
          min={0}
          step="0.1"
          value={value.seriesIndex}
          onChange={(event) => onChange({ seriesIndex: event.target.value })}
          disabled={disabled}
          placeholder="Opcional"
        />
      </label>

      <label className="catalog-field is-wide">
        Resumo
        <textarea
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={4}
          maxLength={4000}
          disabled={disabled}
          placeholder="Uma ou duas frases que aparecem na página do livro."
        />
      </label>
    </div>
  );
}

export function CatalogRightsFields({
  value,
  onChange,
  disabled,
}: {
  value: CatalogRightsValue;
  onChange: (patch: Partial<CatalogRightsValue>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="catalog-rights">
      <div className="catalog-rights-options">
        {RIGHTS_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`catalog-right ${value.rights === option.id ? "is-on" : ""}`}
          >
            <input
              type="radio"
              name="catalog-rights"
              value={option.id}
              checked={value.rights === option.id}
              onChange={() => onChange({ rights: option.id })}
              disabled={disabled}
            />
            <span>
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </span>
          </label>
        ))}
      </div>

      <label className="catalog-field is-wide">
        Justificativa {value.rights === "public_domain" ? "(opcional)" : "*"}
        <textarea
          value={value.rightsNote}
          onChange={(event) => onChange({ rightsNote: event.target.value })}
          rows={2}
          maxLength={500}
          disabled={disabled}
          placeholder={
            value.rights === "public_domain"
              ? "Ex.: Aluísio Azevedo morreu em 1913"
              : "Ex.: sou o autor ou tenho autorização por escrito"
          }
        />
      </label>
    </div>
  );
}
