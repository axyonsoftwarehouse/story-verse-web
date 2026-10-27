import type { SupabaseSession } from "./auth";
import { apiRequest } from "./backend";
import type { MetricsRange } from "./adminMetrics";

/**
 * Atividade do fórum (superadmin): tópicos, respostas e denúncias criados por dia ou semana, no
 * calendário de São Paulo. A API já devolve os buckets vazios com zero e conta também o que a
 * moderação escondeu ou apagou depois (a métrica é do que foi criado).
 */

export type CommunityPoint = {
  bucket: string;
  topics: number;
  replies: number;
  reports: number;
};

export function getCommunitySeries(
  session: SupabaseSession,
  range: MetricsRange,
  group: "day" | "week",
): Promise<CommunityPoint[]> {
  const params = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  return apiRequest<CommunityPoint[]>(`/api/v1/admin/metrics/community?${params}&group=${group}`, {
    accessToken: session.access_token,
  });
}

/** Soma os buckets do intervalo (datas AAAA-MM-DD, inclusive). */
export function communityTotals(
  points: CommunityPoint[],
  range: MetricsRange,
): { topics: number; replies: number; reports: number } {
  return points
    .filter((point) => point.bucket >= range.from && point.bucket <= range.to)
    .reduce(
      (sum, point) => ({
        topics: sum.topics + point.topics,
        replies: sum.replies + point.replies,
        reports: sum.reports + point.reports,
      }),
      { topics: 0, replies: 0, reports: 0 },
    );
}
