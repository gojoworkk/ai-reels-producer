"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Play } from "lucide-react";
import { formatCount, formatDate, formatScore } from "@/lib/format";
import { formatDuration } from "@/lib/time";
import { Thumb } from "../Thumb";
import { Card, btnOutline } from "../ui";
import { OriginalDialog } from "./OriginalDialog";

type Props = {
  account: string;
  url: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  postedAt?: string;
  views: number;
  likes: number;
  comments: number;
  score: number;
  rank: number;
  total: number;
  durationSec?: number;
  tags: string[];
};

export function SourceCard(p: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <div className="hidden lg:block">{head(p)}</div>

      <div className="flex gap-4 lg:block">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative block w-24 shrink-0 self-start overflow-hidden rounded-lg lg:mx-auto lg:mt-4 lg:w-full lg:max-w-[150px]"
          aria-label="Смотреть оригинал"
        >
          <Thumb src={p.thumbnailUrl} className="aspect-[9/16] w-full" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="flex size-10 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow transition-opacity group-hover:opacity-100">
              <Play size={16} fill="currentColor" />
            </span>
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="lg:hidden">{head(p)}</div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap text-muted">
            <span className="inline-flex items-center gap-1">
              <Play size={11} />
              {formatCount(p.views)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart size={11} />
              {formatCount(p.likes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={11} />
              {formatCount(p.comments)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-line sm:grid-cols-3 lg:block lg:space-y-4 lg:border-t lg:pt-4">
            <Prop label="Залёт">
              <span className="inline-flex items-center rounded-md bg-accent px-1.5 py-0.5 font-semibold text-accent-fg">
                {formatScore(p.score)}
              </span>
              <span className="ml-2 whitespace-nowrap text-muted">
                место {p.rank} из {p.total}
              </span>
            </Prop>
            <Prop label="Длительность">{formatDuration(p.durationSec)}</Prop>
            {p.tags.length > 0 && (
              <Prop label="Теги" className="col-span-2 sm:col-span-1">
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-md border border-line px-2 py-0.5 text-[11px] text-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </Prop>
            )}
          </div>

          <button type="button" className={`${btnOutline} mt-5 w-full max-lg:w-auto`} onClick={() => setOpen(true)}>
            <Play size={13} />
            Смотреть оригинал
          </button>
        </div>
      </div>

      {open && <OriginalDialog url={p.url} videoUrl={p.videoUrl} onClose={() => setOpen(false)} />}
    </Card>
  );
}

function head(p: Props) {
  return (
    <>
      <h2 className="text-[15px] font-semibold">Источник</h2>
      <Link href={`/?account=${encodeURIComponent(p.account)}`} className="mt-2 block text-xs text-muted hover:text-fg lg:mt-3">
        @{p.account}
      </Link>
      <p className="mt-0.5 text-xs text-faint">{formatDate(p.postedAt)}</p>
    </>
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
