import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ReelActions } from "@/components/reel/ReelActions";
import { ScriptCards } from "@/components/reel/ScriptCards";
import { SourceCard } from "@/components/reel/SourceCard";
import { readDb } from "@/lib/db";
import { firstLine } from "@/lib/format";
import { hasAnthropicKey } from "@/lib/scriptwriter";

export default function ReelPage({ params }: PageProps<"/reels/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[1040px] px-4 pt-6 pb-24 md:px-8">
      <Suspense fallback={<div className="mt-14 h-64 animate-pulse rounded-xl bg-hover" />}>
        <ReelContent params={params} />
      </Suspense>
    </div>
  );
}

function hashtags(caption: string) {
  return [...new Set(caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 4).map((t) => t.slice(1));
}

async function ReelContent({ params }: { params: PageProps<"/reels/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const db = await readDb();
  const reel = db.reels.find((r) => r.id === id);
  if (!reel) notFound();

  const ranked = [...db.reels].sort((a, b) => b.score - a.score || b.views - a.views);
  const rank = ranked.findIndex((r) => r.id === reel.id) + 1;
  const title = reel.script?.title || firstLine(reel.caption, 80) || `Рилс @${reel.account}`;
  const canGenerate = hasAnthropicKey();

  return (
    <>
      <nav className="flex min-w-0 items-center gap-1.5 text-[11px] text-faint">
        <Link href="/" className="hover:text-fg">
          Главное
        </Link>
        <span>/</span>
        <span className="truncate">{title}</span>
      </nav>

      {/* На широком экране «Источник» справа, на узком — между заголовком и сценарием */}
      <div className="mt-6 grid gap-x-5 gap-y-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-y-7">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4 lg:col-start-1 lg:row-start-1">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-medium text-faint">Рилс #{rank}</p>
            <h1 className="max-w-md text-[22px] leading-tight font-bold tracking-tight">{title}</h1>
          </div>
          <ReelActions reelId={reel.id} url={reel.url} script={reel.script} canGenerate={canGenerate} />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <ScriptCards
            reelId={reel.id}
            script={reel.script}
            discussion={reel.discussion ?? []}
            caption={reel.caption}
            transcript={reel.transcript}
            canGenerate={canGenerate}
          />
        </div>

        <aside className="max-lg:row-start-2 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <SourceCard
            account={reel.account}
            url={reel.url}
            videoUrl={reel.videoUrl}
            thumbnailUrl={reel.thumbnailUrl}
            postedAt={reel.postedAt}
            views={reel.views}
            likes={reel.likes}
            comments={reel.comments}
            score={reel.score}
            rank={rank}
            total={ranked.length}
            durationSec={reel.durationSec}
            tags={reel.script?.tags?.length ? reel.script.tags : hashtags(reel.caption)}
          />
        </aside>
      </div>
    </>
  );
}
