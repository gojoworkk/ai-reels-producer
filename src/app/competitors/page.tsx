import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { TriangleAlert, Users } from "lucide-react";
import { AddCompetitorForm } from "@/components/AddCompetitorForm";
import { CompetitorActions } from "@/components/CompetitorActions";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { hasApifyToken } from "@/lib/apify";
import { readDb } from "@/lib/db";
import { formatCount, formatDate, formatScore } from "@/lib/format";
import { hasAnthropicKey } from "@/lib/scriptwriter";

export default function CompetitorsPage() {
  return (
    <PageContainer>
      <PageHeader
        icon={<Users size={44} strokeWidth={1.4} />}
        title="Конкуренты"
        description="Вставьте Instagram-аккаунт — подтянем последние 20 рилсов и найдём те, что взлетели."
      />
      <Suspense fallback={<div className="h-40 animate-pulse rounded bg-hover" />}>
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
    <>
      {(!apifyReady || !claudeReady) && (
        <div className="mb-6 flex gap-3 rounded-md bg-callout px-4 py-3.5 text-sm">
          <TriangleAlert size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Не хватает ключей в .env.local</p>
            <ul className="mt-1 space-y-0.5 text-muted">
              {!apifyReady && (
                <li>
                  <code className="rounded bg-hover px-1 text-[13px]">APIFY_TOKEN</code> — нужен, чтобы скачивать рилсы
                </li>
              )}
              {!claudeReady && (
                <li>
                  <code className="rounded bg-hover px-1 text-[13px]">ANTHROPIC_API_KEY</code> — нужен, чтобы писать
                  сценарии
                </li>
              )}
            </ul>
            <p className="mt-1 text-muted">После добавления перезапустите сервер.</p>
          </div>
        </div>
      )}

      <AddCompetitorForm />

      <section className="mt-10">
        <h2 className="mb-2 text-sm font-medium text-muted">Аккаунты · {competitors.length}</h2>
        {competitors.length === 0 ? (
          <p className="border-t border-line py-6 text-sm text-faint">Пока ни одного конкурента.</p>
        ) : (
          <ul className="border-t border-line">
            {competitors.map((c) => {
              const reels = db.reels.filter((r) => r.account === c.username);
              const best = reels.reduce((m, r) => Math.max(m, r.score), 0);
              const scripts = reels.filter((r) => r.script).length;
              return (
                <li key={c.username} className="group flex items-center gap-3 border-b border-line px-1 py-3 hover:bg-hover">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-callout text-sm font-semibold uppercase">
                    {c.username.slice(0, 1)}
                  </div>
                  <Link href={`/?account=${encodeURIComponent(c.username)}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      @{c.username}
                      {c.fullName && <span className="ml-2 font-normal text-muted">{c.fullName}</span>}
                    </p>
                    <p className="truncate text-xs text-faint">
                      {reels.length} рилсов · медиана {formatCount(Math.round(c.medianViews))} просмотров · лучший{" "}
                      {formatScore(best)} · сценариев {scripts} · обновлено {formatDate(c.lastFetchedAt)}
                    </p>
                  </Link>
                  <CompetitorActions username={c.username} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
