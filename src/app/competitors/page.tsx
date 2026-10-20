import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { TriangleAlert } from "lucide-react";
import { AddCompetitorForm } from "@/components/AddCompetitorForm";
import { CompetitorActions } from "@/components/CompetitorActions";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui";
import { hasApifyToken } from "@/lib/apify";
import { readDb } from "@/lib/db";
import { formatCount, formatDate, formatScore } from "@/lib/format";
import { hasAnthropicKey } from "@/lib/scriptwriter";

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
  const db = await readDb();
  const apifyReady = hasApifyToken();
  const claudeReady = hasAnthropicKey();

  const competitors = [...db.competitors].sort((a, b) => b.addedAt.localeCompare(a.addedAt));

  return (
    <div className="space-y-4">
      {(!apifyReady || !claudeReady) && (
        <Card className="flex gap-3 px-5 py-4 text-[13px]">
          <TriangleAlert size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Не хватает ключей в .env.local</p>
            <ul className="mt-1 space-y-0.5 text-muted">
              {!apifyReady && (
                <li>
                  <code className="rounded bg-hover px-1 text-xs">APIFY_TOKEN</code> — нужен, чтобы скачивать рилсы
                </li>
              )}
              {!claudeReady && (
                <li>
                  <code className="rounded bg-hover px-1 text-xs">ANTHROPIC_API_KEY</code> — нужен, чтобы писать сценарии
                </li>
              )}
            </ul>
            <p className="mt-1 text-muted">После добавления перезапустите сервер.</p>
          </div>
        </Card>
      )}

      <Card className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold">Добавить аккаунт</h2>
        <p className="mt-0.5 mb-4 text-[11px] text-faint">Ник или ссылка на Instagram</p>
        <AddCompetitorForm />
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
            {competitors.map((c) => {
              const reels = db.reels.filter((r) => r.account === c.username);
              const best = reels.reduce((m, r) => Math.max(m, r.score), 0);
              const scripts = reels.filter((r) => r.script).length;
              return (
                <li
                  key={c.username}
                  className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-0 hover:bg-hover"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg uppercase">
                    {c.username.slice(0, 1)}
                  </div>
                  <Link href={`/?account=${encodeURIComponent(c.username)}`} className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">
                      @{c.username}
                      {c.fullName && <span className="ml-2 font-normal text-muted">{c.fullName}</span>}
                    </p>
                    <p className="truncate text-[11px] text-faint">
                      {reels.length} рилсов · медиана {formatCount(Math.round(c.medianViews))} · лучший {formatScore(best)} ·
                      сценариев {scripts} · обновлено {formatDate(c.lastFetchedAt)}
                    </p>
                  </Link>
                  <CompetitorActions username={c.username} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
