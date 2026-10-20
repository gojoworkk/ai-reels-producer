"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJob } from "@/app/actions";
import type { Job } from "@/lib/types";

const ACTIVE = new Set(["queued", "running"]);

/** Следит за задачей бэкенда: опрашивает статус, пока она идёт, и обновляет страницу по завершении. */
export function useJob(initial: Job | null) {
  const [job, setJob] = useState<Job | null>(initial);
  const [seenId, setSeenId] = useState(initial?.id);
  const router = useRouter();

  // Новая задача пришла с сервера (после refresh) — начинаем следить за ней
  if (initial && initial.id !== seenId) {
    setSeenId(initial.id);
    setJob(initial);
  }

  const active = job !== null && ACTIVE.has(job.status);

  useEffect(() => {
    if (!job || !ACTIVE.has(job.status)) return;
    const timer = setTimeout(async () => {
      const res = await getJob(job.id);
      if (!res.ok) return;
      setJob(res.data);
      if (!ACTIVE.has(res.data.status)) router.refresh();
    }, 1500);
    return () => clearTimeout(timer);
  }, [job, router]);

  return { job, active, track: (j: Job) => setJob(j) };
}

export function ProgressBar({ job, className = "" }: { job: Job; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
        <span className="truncate">{job.message}</span>
        <span className="shrink-0 tabular-nums">{job.progress}%</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-hover">
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.max(job.progress, 4)}%` }} />
      </div>
    </div>
  );
}
