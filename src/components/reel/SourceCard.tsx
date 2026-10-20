"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Heart, MessageCircle, Play } from "lucide-react";
import { formatCount, formatDate, formatScore } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import type { ReelDetail } from "@/lib/types";
import { Thumb } from "../Thumb";
import { Card, btnOutline } from "../ui";

export function SourceCard({ reel }: { reel: ReelDetail }) {
  return (
    <Card className="p-4">
      <div className="hidden lg:block">
        <Head reel={reel} />
      </div>

      <div className="flex gap-4 lg:block">
        <div className="w-28 shrink-0 self-start lg:mx-auto lg:mt-4 lg:w-full lg:max-w-[170px]">
          <Player src={reel.video_url} poster={reel.cover_url} />
          {reel.previews.length > 0 && (
            <div className="mt-1.5 grid grid-cols-3 gap-1" title="Кадры из видео">
              {reel.previews.map((src) => (
                <Thumb key={src} src={src} className="aspect-[9/16] w-full rounded" />
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="lg:hidden">
            <Head reel={reel} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap text-muted">
            <span className="inline-flex items-center gap-1">
              <Play size={11} />
              {formatCount(reel.views)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart size={11} />
              {formatCount(reel.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={11} />
              {formatCount(reel.comments)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:block lg:space-y-4 lg:border-t lg:border-line lg:pt-4">
            <Prop label="Залёт">
              <span className="inline-flex items-center rounded-md bg-accent px-1.5 py-0.5 font-semibold text-accent-fg">
                {formatScore(reel.score)}
              </span>
              <span className="ml-2 whitespace-nowrap text-muted">
                место {reel.rank} из {reel.total}
              </span>
            </Prop>
            <Prop label="Длительность">{formatDuration(reel.duration_sec ?? undefined)}</Prop>
            {reel.tags.length > 0 && (
              <Prop label="Теги" className="col-span-2 sm:col-span-1">
                <div className="flex flex-wrap gap-1.5">
                  {reel.tags.map((t) => (
                    <span key={t} className="rounded-md border border-line px-2 py-0.5 text-[11px] text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </Prop>
            )}
          </div>

          <a href={reel.url} target="_blank" rel="noreferrer" className={`${btnOutline} mt-5 w-full max-lg:w-auto`}>
            <ExternalLink size={13} />
            Оригинал в Instagram
          </a>
        </div>
      </div>
    </Card>
  );
}

function Head({ reel }: { reel: ReelDetail }) {
  return (
    <>
      <h2 className="text-[15px] font-semibold">Источник</h2>
      <Link href={`/?account=${encodeURIComponent(reel.account)}`} className="mt-2 block text-xs text-muted hover:text-fg lg:mt-3">
        @{reel.account}
      </Link>
      <p className="mt-0.5 text-xs text-faint">{formatDate(reel.posted_at ?? undefined)}</p>
    </>
  );
}

// Видео из файлового хранилища бэкенда; если файла нет или ссылка Instagram протухла — показываем обложку
function Player({ src, poster }: { src: string | null; poster: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Thumb src={poster ?? undefined} className="aspect-[9/16] w-full rounded-lg" />;
  return (
    <video
      src={src}
      poster={poster ?? undefined}
      controls
      playsInline
      preload="none"
      onError={() => setFailed(true)}
      className="aspect-[9/16] w-full rounded-lg bg-black object-cover"
    />
  );
}

function Prop({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-xs font-semibold">{label}</p>
      <div className="text-xs">{children}</div>
    </div>
  );
}
