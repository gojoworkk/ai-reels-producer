import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReelActions } from "@/components/reel/ReelActions";
import { ReelJobProvider } from "@/components/reel/ReelJob";
import { ScriptCards } from "@/components/reel/ScriptCards";
import { SourceCard } from "@/components/reel/SourceCard";
import { ApiUnavailable } from "@/components/ApiUnavailable";
import { ApiError, api } from "@/lib/api";
import { firstLine } from "@/lib/format";
import type { ReelDetail } from "@/lib/types";

export default function ReelPage({ params }: PageProps<"/reels/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-24 md:px-8">
      <Suspense fallback={<div className="mt-14 h-64 animate-pulse rounded-xl bg-hover" />}>
        <ReelContent params={params} />
      </Suspense>
    </div>
  );
}

async function ReelContent({ params }: { params: PageProps<"/reels/[id]">["params"] }) {
  await connection();
  const { id } = await params;

  let reel: ReelDetail;
  try {
    reel = await api<ReelDetail>(`/api/reels/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return <ApiUnavailable error={err} />;
  }

  const title = reel.script?.title || firstLine(reel.caption, 80) || `Рилс @${reel.account}`;
  const job = reel.active_job?.kind === "generate_script" ? reel.active_job : null;

  return (
    <ReelJobProvider reelId={reel.id} initial={job}>
      <nav className="flex min-w-0 items-center gap-1.5 text-[11px] text-faint">
        <Link href="/" className="hover:text-fg">
          Главное
        </Link>
        <span>/</span>
        <span className="truncate">{title}</span>
      </nav>

      {/* На широком экране «Источник» справа, на узком — между заголовком и сценарием */}
      <div className="mt-6 grid gap-x-5 gap-y-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:grid-rows-[auto_1fr] lg:gap-y-7">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 lg:col-start-1 lg:row-start-1">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-medium text-faint">Рилс #{reel.rank}</p>
            <h1 className="max-w-md text-[22px] leading-tight font-bold tracking-tight">{title}</h1>
          </div>
          <ReelActions reelId={reel.id} url={reel.url} hasScript={reel.has_script} />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <ScriptCards
            reelId={reel.id}
            script={reel.script}
            comments={reel.comments_list}
            caption={reel.caption}
            transcript={reel.transcript}
          />
        </div>

        <aside className="max-lg:row-start-2 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <SourceCard reel={reel} />
        </aside>
      </div>
    </ReelJobProvider>
  );
}
