import { CATALOG_GENRES, type CatalogRights } from "../../lib/adminCatalog";
import type { DetailSource } from "../../lib/bookMetadata";
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

const SOURCE_LABEL: Record<DetailSource, string> = {
  arquivo: "do arquivo",
  "Open Library": "da Open Library",
  Wikipedia: "da Wikipedia",
};

export function CatalogMetadataFields({
  value,
  onChange,
  sources = {},
  disabled,
}: {
  value: CatalogMetadataValue;
  onChange: (patch: Partial<CatalogMetadataValue>) => void;
  /** Campos preenchidos sozinhos: mostra de onde veio, para o admin revisar. */
  sources?: Partial<Record<keyof CatalogMetadataValue, DetailSource>>;
  disabled?: boolean;
}) {
  const from = (field: keyof CatalogMetadataValue) => {
    const source = sources[field];
    return source ? <span className="catalog-field-source"> · {SOURCE_LABEL[source]}</span> : null;
  };
  return (
    <div className="catalog-form-grid">
      <label className="catalog-field is-wide">
        <span>
          Título *
          {from("title")}
        </span>
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
        <span>
          Autor
          {from("author")}
        </span>
        <input
          value={value.author}
          onChange={(event) => onChange({ author: event.target.value })}
          maxLength={200}
          disabled={disabled}
          autoComplete="off"
        />
      </label>

      <label className="catalog-field">
        <span>
          Gênero
          {from("genre")}
        </span>
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
        <span>
          Série
          {from("series")}
        </span>
        <input
          value={value.series}
          onChange={(event) => onChange({ series: event.target.value })}
          maxLength={200}
          disabled={disabled}
          placeholder="Opcional"
        />
      </label>

      <label className="catalog-field">
        <span>
          Volume na série
          {from("seriesIndex")}
        </span>
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
        <span>
          Resumo
          {from("description")}
        </span>
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
