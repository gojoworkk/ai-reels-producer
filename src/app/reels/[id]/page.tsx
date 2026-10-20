import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Calendar, ChevronRight, Clock, Eye, Hash, Heart, MessageCircle, TrendingUp, User } from "lucide-react";
import { ReelWorkspace } from "@/components/ReelWorkspace";
import { Thumb } from "@/components/Thumb";
import { readDb } from "@/lib/db";
import { firstLine, formatCount, formatDate, formatScore } from "@/lib/format";
import { hasAnthropicKey } from "@/lib/scriptwriter";

export default function ReelPage({ params }: PageProps<"/reels/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pt-6 pb-24 md:px-12">
      <Suspense fallback={<div className="mt-14 h-64 animate-pulse rounded bg-hover" />}>
        <ReelContent params={params} />
      </Suspense>
    </div>
  );
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

  const props = [
    { icon: Hash, label: "Место в рейтинге", value: `${rank} из ${ranked.length}` },
    { icon: User, label: "Аккаунт", value: `@${reel.account}` },
    { icon: TrendingUp, label: "Залёт", value: `${formatScore(reel.score)} к медиане аккаунта` },
    { icon: Eye, label: "Просмотры", value: formatCount(reel.views) },
    { icon: Heart, label: "Лайки", value: formatCount(reel.likes) },
    { icon: MessageCircle, label: "Комментарии", value: formatCount(reel.comments) },
    { icon: Clock, label: "Длительность", value: reel.durationSec ? `${Math.round(reel.durationSec)} сек` : "—" },
    { icon: Calendar, label: "Опубликован", value: formatDate(reel.postedAt) },
  ];

  return (
    <>
      <nav className="flex items-center gap-1 text-sm text-muted">
        <Link href="/" className="rounded px-1.5 py-0.5 hover:bg-hover">
          Главная
        </Link>
        <ChevronRight size={14} className="text-faint" />
        <Link href={`/?account=${encodeURIComponent(reel.account)}`} className="rounded px-1.5 py-0.5 hover:bg-hover">
          @{reel.account}
        </Link>
      </nav>

      <div className="mt-10 flex gap-6 max-sm:flex-col-reverse md:mt-14">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-sm font-medium text-muted">Рилс #{rank}</p>
          <h1 className="text-[30px] leading-tight font-bold tracking-tight md:text-[36px]">{title}</h1>

          <dl className="mt-6 space-y-0.5 text-sm">
            {props.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex min-h-[30px] items-center">
                <dt className="flex w-44 shrink-0 items-center gap-2 text-muted">
                  <Icon size={15} strokeWidth={1.8} className="text-faint" />
                  {label}
                </dt>
                <dd className="min-w-0 truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Thumb src={reel.thumbnailUrl} className="aspect-[9/16] w-36 shrink-0 rounded-md border border-line" />
      </div>

      <ReelWorkspace
        reelId={reel.id}
        url={reel.url}
        videoUrl={reel.videoUrl}
        caption={reel.caption}
        transcript={reel.transcript}
        script={reel.script}
        canGenerate={hasAnthropicKey()}
      />
    </>
  );
}
