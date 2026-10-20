import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Download, Play } from "lucide-react";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { ReelRowActions } from "@/components/ReelRowActions";
import { Thumb } from "@/components/Thumb";
import { Card, btnOutline, btnSolid } from "@/components/ui";
import { api } from "@/lib/api";
import { firstLine, formatCount, formatDate, formatScore } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import type { Reel } from "@/lib/types";

export default function ReelsPage({ searchParams }: PageProps<"/">) {
  return (
    <PageContainer wide>
      <Suspense fallback={<TableSkeleton />}>
        <ReelsTable searchParams={searchParams} />
      </Suspense>
    </PageContainer>
  );
}

async function ReelsTable({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const { account } = await searchParams;
  const filter = typeof account === "string" ? account : undefined;

  let all: Reel[];
  let accounts: string[];
  try {
    [all, accounts] = await Promise.all([api<Reel[]>("/api/reels"), api<string[]>("/api/accounts")]);
  } catch (err) {
    return (
      <>
        <Header />
        <ApiUnavailable error={err} />
      </>
    );
  }

  const reels = filter ? all.filter((r) => r.account === filter) : all;
  const csvHref = `/download?list=csv${filter ? `&account=${encodeURIComponent(filter)}` : ""}`;

  return (
    <>
      <Header csvHref={all.length ? csvHref : undefined} />

      {!all.length ? (
        <Card className="px-6 py-14 text-center">
          <p className="text-[15px] font-semibold">Здесь пока пусто</p>
          <p className="mt-1 text-[13px] text-muted">Добавьте аккаунт конкурента — мы подтянем его последние 20 рилсов.</p>
          <Link href="/competitors" className={`${btnSolid} mt-5`}>
            Добавить конкурента
          </Link>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <FilterChip href="/" active={!filter} label="Все аккаунты" count={all.length} />
            {accounts.map((a) => (
              <FilterChip
                key={a}
                href={`/?account=${encodeURIComponent(a)}`}
                active={filter === a}
                label={`@${a}`}
                count={all.filter((r) => r.account === a).length}
              />
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] text-faint">
                    <th className="w-12 py-3 pr-2 pl-5 font-medium">#</th>
                    <th className="min-w-[240px] px-2 py-3 font-medium">Рилс</th>
                    <th className="w-20 px-2 py-3 font-medium">Залёт</th>
                    <th className="w-24 px-2 py-3 font-medium">Просмотры</th>
                    <th className="w-24 px-2 py-3 font-medium max-xl:hidden">Сценарий</th>
                    <th className="w-[230px] py-3 pr-4 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {reels.map((reel, i) => (
                    <tr key={reel.id} className="group relative border-b border-line last:border-0 hover:bg-hover">
                      <td className="py-2.5 pr-2 pl-5 font-semibold tabular-nums">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <Link href={`/reels/${reel.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                          <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md">
                            <Thumb src={reel.cover_url ?? undefined} className="h-full w-full" />
                            <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/25 text-white">
                              <Play size={12} fill="currentColor" />
                              <span className="mt-0.5 text-[9px] font-medium tabular-nums">
                                {formatDuration(reel.duration_sec ?? undefined)}
                              </span>
                            </span>
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-1 font-semibold">
                              {reel.script_title || firstLine(reel.caption) || "Без описания"}
                            </span>
                            <span className="line-clamp-1 text-[11px] text-faint">
                              @{reel.account} · {formatDate(reel.posted_at ?? undefined)}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-2 py-2.5">
                        <ScoreBadge score={reel.score} />
                      </td>
                      <td className="px-2 py-2.5 tabular-nums">{formatCount(reel.views)}</td>
                      <td className="px-2 py-2.5 max-xl:hidden">
                        {reel.has_script ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span className="size-1.5 rounded-full bg-fg" />
                            Готов
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-faint">
                            <span className="size-1.5 rounded-full border border-faint" />
                            Нет
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 pl-2">
                        <ReelRowActions
                          reelId={reel.id}
                          url={reel.url}
                          hasScript={reel.has_script}
                          activeJob={reel.active_job}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 px-1 text-[11px] text-faint">
            «Залёт» — во сколько раз просмотры рилса выше медианы по последним 20 рилсам этого аккаунта.
          </p>
        </>
      )}
    </>
  );
}

function Header({ csvHref }: { csvHref?: string }) {
  return (
    <PageHeader
      crumb="Главное"
      title="Все рилсы"
      description="Рилсы конкурентов в порядке «залёта»: во сколько раз просмотры выше обычных для аккаунта."
    >
      <div className="flex gap-2">
        {csvHref && (
          <a href={csvHref} className={btnOutline}>
            <Download size={14} />
            CSV
          </a>
        )}
        <Link href="/competitors" className={btnOutline}>
          Добавить конкурента
        </Link>
      </div>
    </PageHeader>
  );
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${
        active ? "border-line bg-card font-medium shadow-card" : "border-transparent text-muted hover:bg-hover"
      }`}
    >
      {label}
      <span className="text-faint">{count}</span>
    </Link>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const strong = score >= 2;
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        strong ? "bg-accent text-accent-fg" : "border border-line text-muted"
      }`}
    >
      {formatScore(score)}
    </span>
  );
}

function TableSkeleton() {
  return <div className="h-96 animate-pulse rounded-xl bg-hover" />;
}
