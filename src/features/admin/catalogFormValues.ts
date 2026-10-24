import type { CatalogRights } from "../../lib/adminCatalog";

/** Campos de metadados compartilhados entre o cadastro em etapas e a edição do livro. */
export type CatalogMetadataValue = {
  title: string;
  author: string;
  genre: string;
  language: "pt" | "en";
  series: string;
  seriesIndex: string;
  description: string;
  pageCount: string;
};

export type CatalogRightsValue = {
  rights: CatalogRights;
  rightsNote: string;
};

export const EMPTY_METADATA: CatalogMetadataValue = {
  title: "",
  author: "",
  genre: "",
  language: "pt",
  series: "",
  seriesIndex: "",
  description: "",
  pageCount: "",
};
