"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { refreshCompetitor, removeCompetitor } from "@/app/actions";

export function CompetitorActions({ username }: { username: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const iconBtn =
    "relative z-10 inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-active hover:text-fg disabled:opacity-40";

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {error && <span className="mr-2 max-w-48 truncate text-xs text-danger" title={error}>{error}</span>}
      <a
        href={`https://www.instagram.com/${username}/`}
        target="_blank"
        rel="noreferrer"
        title="Открыть в Instagram"
        className={iconBtn}
      >
        <ExternalLink size={15} />
      </a>
      <button
        type="button"
        title="Обновить рилсы"
        disabled={pending}
        className={iconBtn}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await refreshCompetitor(username);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
      </button>
      <button
        type="button"
        title="Удалить вместе с рилсами"
        disabled={pending}
        className={iconBtn}
        onClick={() => {
          if (!confirm(`Удалить @${username} и все его рилсы со сценариями?`)) return;
          startTransition(async () => {
            await removeCompetitor(username);
          });
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
