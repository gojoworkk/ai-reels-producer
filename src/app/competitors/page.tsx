import { connection } from "next/server";
import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { AddCompetitorForm } from "@/components/AddCompetitorForm";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { CompetitorRow } from "@/components/CompetitorActions";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { api } from "@/lib/api";
import type { Competitor, Health } from "@/lib/types";

export default function CompetitorsPage() {
  return (
    <PageContainer>
      <PageHeader
        crumb="Аналитика / Конкуренты"
        title="Конкуренты"
        description="Вставьте Instagram-аккаунт — подтянем последние 20 рилсов и найдём те, что взлетели."
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-hover" />}>
        <CompetitorsContent />
      </Suspense>
    </PageContainer>
  );
}

async function CompetitorsContent() {
  await connection();

  let competitors: Competitor[];
  let health: Health;
  try {
    [competitors, health] = await Promise.all([api<Competitor[]>("/api/competitors"), api<Health>("/api/health")]);
  } catch (err) {
    return <ApiUnavailable error={err} />;
  }

  return (
    <div className="space-y-4">
      {(!health.apify || !health.anthropic) && (
        <Card className="flex gap-3 px-5 py-4 text-[13px]">
          <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Не хватает ключей в backend/.env</p>
            <ul className="mt-1 space-y-0.5 text-muted">
              {!health.apify && (
                <li>
                  <code className="rounded bg-hover px-1 text-xs">APIFY_TOKEN</code> — нужен, чтобы скачивать рилсы
                </li>
              )}
              {!health.anthropic && (
                <li>
                  <code className="rounded bg-hover px-1 text-xs">ANTHROPIC_API_KEY</code> — нужен, чтобы писать сценарии
                </li>
              )}
            </ul>
            <p className="mt-1 text-muted">После добавления бэкенд подхватит ключи при перезапуске.</p>
          </div>
        </Card>
      )}

      <Card className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold">Добавить аккаунт</h2>
        <p className="mt-0.5 mb-4 text-[11px] text-faint">
          Ник или ссылка на Instagram
          {health.sync_interval_hours > 0 && health.apify && ` · автообновление каждые ${health.sync_interval_hours} ч`}
        </p>
        <AddCompetitorForm limit={20} />
      </Card>

      <Card>
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold">Аккаунты</h2>
          <p className="mt-0.5 text-[11px] text-faint">{competitors.length} в отслеживании</p>
        </div>
        {competitors.length === 0 ? (
          <p className="border-t border-line px-5 py-6 text-[13px] text-faint">Пока ни одного конкурента.</p>
        ) : (
          <ul className="border-t border-line">
            {competitors.map((c) => (
              <CompetitorRow key={c.username} c={c} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
