import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { Thumb } from "@/components/Thumb";
import { Card, btnOutline, btnSolid } from "@/components/ui";
import { readDb } from "@/lib/db";
import { firstLine, formatCount, formatDate, formatScore } from "@/lib/format";

export default function ReelsPage({ searchParams }: PageProps<"/">) {
  return (
    <PageContainer wide>
      <PageHeader
        crumb="Главное"
        title="Все рилсы"
        description="Рилсы конкурентов в порядке «залёта»: во сколько раз просмотры выше обычных для аккаунта."
      >
        <Link href="/competitors" className={btnOutline}>
          Добавить конкурента
        </Link>
      </PageHeader>
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
  const db = await readDb();

  if (!db.reels.length) {
    return (
      <Card className="px-6 py-14 text-center">
        <p className="text-[15px] font-semibold">Здесь пока пусто</p>
        <p className="mt-1 text-[13px] text-muted">Добавьте аккаунт конкурента — мы подтянем его последние 20 рилсов.</p>
        <Link href="/competitors" className={`${btnSolid} mt-5`}>
          Добавить конкурента
        </Link>
      </Card>
    );
  }

  const reels = db.reels
    .filter((r) => !filter || r.account === filter)
    .sort((a, b) => b.score - a.score || b.views - a.views);

  const accounts = [...new Set(db.reels.map((r) => r.account))].sort();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <FilterChip href="/" active={!filter} label="Все аккаунты" count={db.reels.length} />
        {accounts.map((a) => (
          <FilterChip
            key={a}
            href={`/?account=${encodeURIComponent(a)}`}
            active={filter === a}
            label={`@${a}`}
            count={db.reels.filter((r) => r.account === a).length}
          />
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] text-faint">
                <th className="w-14 py-3 pr-2 pl-5 font-medium">#</th>
                <th className="min-w-[240px] px-2 py-3 font-medium">Рилс</th>
                <th className="w-36 px-2 py-3 font-medium max-xl:hidden">Аккаунт</th>
                <th className="w-20 px-2 py-3 font-medium">Залёт</th>
                <th className="w-24 px-2 py-3 font-medium">Просмотры</th>
                <th className="w-20 px-2 py-3 font-medium max-lg:hidden">Лайки</th>
                <th className="w-28 px-2 py-3 font-medium">Сценарий</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {reels.map((reel, i) => (
                <tr key={reel.id} className="group relative border-b border-line last:border-0 hover:bg-hover">
                  <td className="py-2.5 pr-2 pl-5 font-semibold tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2.5">
                    <Link href={`/reels/${reel.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <Thumb src={reel.thumbnailUrl} className="h-12 w-[27px] shrink-0 rounded" />
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-semibold">
                          {reel.script?.title || firstLine(reel.caption) || "Без описания"}
                        </span>
                        <span className="line-clamp-1 text-[11px] text-faint">{formatDate(reel.postedAt)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-2 py-2.5 text-muted max-xl:hidden">@{reel.account}</td>
                  <td className="px-2 py-2.5">
                    <ScoreBadge score={reel.score} />
                  </td>
                  <td className="px-2 py-2.5 tabular-nums">{formatCount(reel.views)}</td>
                  <td className="px-2 py-2.5 text-muted tabular-nums max-lg:hidden">{formatCount(reel.likes)}</td>
                  <td className="px-2 py-2.5">
                    {reel.script ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="size-1.5 rounded-full bg-fg" />
                        Готов
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs text-faint">
                        <span className="size-1.5 rounded-full border border-faint" />
                        Не создан
                      </span>
                    )}
                  </td>
                  <td className="pr-4 text-faint">
                    <ChevronRight size={15} className="opacity-0 transition-opacity group-hover:opacity-100" />
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
