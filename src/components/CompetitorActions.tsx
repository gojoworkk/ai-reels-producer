"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { removeCompetitor, syncCompetitor } from "@/app/actions";
import { formatCount, formatScore } from "@/lib/format";
import { timeAgo } from "@/lib/time";
import type { Competitor } from "@/lib/types";
import { ProgressBar, useJob } from "./JobProgress";

// Строка конкурента: статистика, прогресс загрузки и действия
export function CompetitorRow({ c }: { c: Competitor }) {
  const { job, active, track } = useJob(c.active_job);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = pending || active;

  const failed = !busy && (job ?? c.last_job)?.status === "failed" ? (job ?? c.last_job)?.error : null;

  const iconBtn =
    "relative z-10 inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-active hover:text-fg disabled:opacity-40";

  return (
    <li className="border-b border-line px-5 py-3 last:border-0 hover:bg-hover">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg uppercase">
          {c.username.slice(0, 1)}
        </div>
        <Link href={`/?account=${encodeURIComponent(c.username)}`} className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">
            @{c.username}
            {c.full_name && <span className="ml-2 font-normal text-muted">{c.full_name}</span>}
          </p>
          <p className="truncate text-[11px] text-faint" suppressHydrationWarning>
            {c.reels_count} рилсов · медиана {formatCount(Math.round(c.median_views))} · лучший {formatScore(c.best_score)}{" "}
            · сценариев {c.scripts_count}
            {c.last_synced_at ? ` · обновлено ${timeAgo(c.last_synced_at)}` : " · ещё не загружен"}
          </p>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          <a href={`https://www.instagram.com/${c.username}/`} target="_blank" rel="noreferrer" title="Открыть в Instagram" className={iconBtn}>
            <ExternalLink size={15} />
          </a>
          <button
            type="button"
            title="Загрузить свежие рилсы"
            disabled={busy}
            className={iconBtn}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await syncCompetitor(c.username);
                if (res.ok) track(res.data);
                else setError(res.error);
              })
            }
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          </button>
          <button
            type="button"
            title="Удалить вместе с рилсами"
            disabled={busy}
            className={iconBtn}
            onClick={() => {
              if (!confirm(`Удалить @${c.username} со всеми рилсами, сценариями и файлами?`)) return;
              startTransition(async () => {
                const res = await removeCompetitor(c.username);
                if (!res.ok) setError(res.error);
              });
            }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {busy && job && <ProgressBar job={job} className="mt-2.5 pl-12" />}
      {(error || failed) && <p className="mt-1.5 pl-12 text-xs text-danger">{error ?? failed}</p>}
    </li>
  );
}
