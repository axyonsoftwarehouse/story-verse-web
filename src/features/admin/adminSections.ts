export type AdminSectionId =
  | "overview"
  | "accounts"
  | "sanctions"
  | "features"
  | "catalog"
  | "forum"
  | "metrics"
  | "site"
  | "billing"
  | "audit";

export type AdminSection = {
  id: AdminSectionId;
  path: string;
  label: string;
};

const SECTIONS: AdminSection[] = [
  { id: "overview", path: "/admin", label: "Visão geral" },
  { id: "accounts", path: "/admin/contas", label: "Contas" },
  { id: "sanctions", path: "/admin/sancoes", label: "Sanções" },
  { id: "features", path: "/admin/features", label: "Recursos em teste" },
  { id: "catalog", path: "/admin/acervo", label: "Acervo" },
  { id: "forum", path: "/admin/moderacao/forum", label: "Fórum" },
  { id: "metrics", path: "/admin/metricas", label: "Métricas" },
  { id: "site", path: "/admin/site", label: "Site" },
  { id: "billing", path: "/admin/financeiro", label: "Financeiro" },
  { id: "audit", path: "/admin/auditoria", label: "Auditoria" },
];

export function isStaff(roles: string[]): boolean {
  return roles.some((role) => role === "superadmin" || role === "moderator" || role === "support");
}

export function isSuperadmin(roles: string[]): boolean {
  return roles.includes("superadmin");
}

export function canSeeAccounts(roles: string[]): boolean {
  return roles.includes("superadmin") || roles.includes("support");
}

export function canModerate(roles: string[]): boolean {
  return roles.includes("superadmin") || roles.includes("moderator");
}

export function visibleSections(roles: string[]): AdminSection[] {
  if (!isStaff(roles)) return [];
  return SECTIONS.filter((section) => {
    if (section.id === "accounts") return canSeeAccounts(roles);
    if (["features", "audit", "billing", "metrics", "site"].includes(section.id)) {
      return isSuperadmin(roles);
    }
    if (section.id === "catalog") return canModerate(roles);
    return true;
  });
}
