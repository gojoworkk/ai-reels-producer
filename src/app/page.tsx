import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowUpRight, Clapperboard, Eye, FileText, Hash, Heart, TrendingUp, User } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/PageHeader";
import { Thumb } from "@/components/Thumb";
import { readDb } from "@/lib/db";
import { firstLine, formatCount, formatDate, formatScore } from "@/lib/format";

export default function ReelsPage({ searchParams }: PageProps<"/">) {
  return (
    <PageContainer wide>
      <PageHeader
        icon={<Clapperboard size={44} strokeWidth={1.4} />}
        title="Все рилсы"
        description="Рилсы конкурентов, отсортированные по тому, насколько они обогнали обычные просмотры аккаунта."
      />
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
      <div className="rounded-md border border-line px-6 py-14 text-center">
        <p className="text-[15px] font-medium">Здесь пока пусто</p>
        <p className="mt-1 text-sm text-muted">Добавьте аккаунт конкурента — мы подтянем его последние 20 рилсов.</p>
        <Link
          href="/competitors"
          className="mt-5 inline-flex h-8 items-center rounded-md bg-accent px-3 text-sm font-medium text-accent-fg hover:opacity-90"
        >
          Добавить конкурента
        </Link>
      </div>
    );
  }

  const reels = db.reels
    .filter((r) => !filter || r.account === filter)
    .sort((a, b) => b.score - a.score || b.views - a.views);

  const accounts = [...new Set(db.reels.map((r) => r.account))].sort();

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-line pb-2">
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

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[13px] text-muted">
              <Th icon={Hash} className="w-12">Место</Th>
              <Th icon={Clapperboard} className="min-w-[260px]">Рилс</Th>
              <Th icon={User} className="w-36 max-xl:hidden">Аккаунт</Th>
              <Th icon={TrendingUp} className="w-24">Залёт</Th>
              <Th icon={Eye} className="w-24">Просмотры</Th>
              <Th icon={Heart} className="w-20 max-lg:hidden">Лайки</Th>
              <Th icon={FileText} className="w-28">Сценарий</Th>
            </tr>
          </thead>
          <tbody>
            {reels.map((reel, i) => (
              <tr key={reel.id} className="group relative border-b border-line hover:bg-hover">
                <td className="px-2 py-2 align-middle tabular-nums text-muted">{i + 1}</td>
                <td className="px-2 py-2">
                  <Link href={`/reels/${reel.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                    <Thumb src={reel.thumbnailUrl} className="h-12 w-[27px] shrink-0 rounded-[3px]" />
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-medium">
                        {reel.script?.title || firstLine(reel.caption) || "Без описания"}
                      </span>
                      <span className="line-clamp-1 text-xs text-faint">{formatDate(reel.postedAt)}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2 text-muted max-xl:hidden">@{reel.account}</td>
                <td className="px-2 py-2">
                  <ScoreBadge score={reel.score} />
                </td>
                <td className="px-2 py-2 tabular-nums">{formatCount(reel.views)}</td>
                <td className="px-2 py-2 tabular-nums text-muted max-lg:hidden">{formatCount(reel.likes)}</td>
                <td className="px-2 py-2">
                  {reel.script ? (
                    <span className="inline-flex items-center rounded-[3px] bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-fg">
                      Готов
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-faint">
                      Не создан
                      <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100" />
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-faint">
        «Залёт» — во сколько раз просмотры рилса выше медианы по последним 20 рилсам этого аккаунта.
      </p>
    </>
  );
}

function Th({
  icon: Icon,
  children,
  className = "",
}: {
  icon: typeof Hash;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-2 py-1.5 font-normal ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <Icon size={14} strokeWidth={1.8} className="text-faint" />
        {children}
      </span>
    </th>
  );
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-sm transition-colors ${
        active ? "bg-active font-medium" : "text-muted hover:bg-hover"
      }`}
    >
      {label}
      <span className="text-xs text-faint">{count}</span>
    </Link>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const strong = score >= 2;
  return (
    <span
      className={`inline-flex items-center rounded-[3px] px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
        strong ? "bg-fg text-bg" : "bg-callout text-muted"
      }`}
    >
      {formatScore(score)}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded bg-hover" />
      ))}
    </div>
  );
}
