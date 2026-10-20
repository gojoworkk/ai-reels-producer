"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileDown, FileType, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { deleteReel, generateScript } from "@/app/actions";
import type { Job } from "@/lib/types";
import { ProgressBar, useJob } from "./JobProgress";
import { Menu } from "./Menu";
import { exportUrl } from "./reel/ReelActions";

// Кнопки в строке списка рилсов: Remix и меню «⋯»
export function ReelRowActions({
  reelId,
  url,
  hasScript,
  activeJob,
}: {
  reelId: string;
  url: string;
  hasScript: boolean;
  activeJob: Job | null;
}) {
  const { job, active, track } = useJob(activeJob);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const busy = pending || active;

  function remix() {
    if (hasScript && !confirm("Переписать сценарий заново? Текущая версия будет заменена.")) return;
    setError(null);
    startTransition(async () => {
      const res = await generateScript(reelId);
      if (res.ok) track(res.data);
      else setError(res.error);
    });
  }

  const failed = !busy && job?.status === "failed" ? job.error : null;

  return (
    <div className="relative z-10 flex items-center justify-end gap-1.5">
      {busy && job ? (
        <ProgressBar job={job} className="w-36" />
      ) : (
        (error || failed) && (
          <span className="max-w-40 truncate text-[11px] text-danger" title={error ?? failed ?? ""}>
            {error ?? failed}
          </span>
        )
      )}
      <button
        type="button"
        onClick={remix}
        disabled={busy}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-line-strong bg-card px-2.5 text-xs font-medium shadow-card hover:bg-hover disabled:opacity-40"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        Remix
      </button>
      <Menu
        trigger={(open) => (
          <button
            type="button"
            aria-label="Ещё"
            aria-expanded={open}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg"
          >
            <MoreHorizontal size={15} />
          </button>
        )}
        items={[
          { label: "Открыть в Instagram", icon: <ExternalLink size={14} />, onSelect: () => window.open(url, "_blank", "noreferrer") },
          ...(hasScript
            ? [
                { label: "Скачать PDF", icon: <FileType size={14} />, onSelect: () => window.location.assign(exportUrl(reelId, "pdf")) },
                { label: "Скачать .md", icon: <FileDown size={14} />, onSelect: () => window.location.assign(exportUrl(reelId, "md")) },
              ]
            : []),
          {
            label: "Удалить рилс",
            icon: <Trash2 size={14} />,
            danger: true,
            onSelect: () => {
              if (confirm("Удалить рилс вместе со сценарием и файлами?"))
                startTransition(async () => {
                  const res = await deleteReel(reelId, false);
                  if (!res.ok) setError(res.error);
                });
            },
          },
        ]}
      />
    </div>
  );
}
