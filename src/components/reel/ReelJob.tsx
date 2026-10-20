"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { generateScript } from "@/app/actions";
import type { Job } from "@/lib/types";
import { useJob } from "../JobProgress";

type Ctx = {
  job: Job | null;
  busy: boolean;
  error: string | null;
  start: () => void;
};

const ReelJobContext = createContext<Ctx | null>(null);

/** Общая задача «написать сценарий» для страницы рилса: её запускает Remix, а прогресс видят все карточки. */
export function ReelJobProvider({ reelId, initial, children }: { reelId: string; initial: Job | null; children: ReactNode }) {
  const { job, active, track } = useJob(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await generateScript(reelId);
      if (res.ok) track(res.data);
      else setError(res.error);
    });
  }

  const failed = job?.status === "failed" ? (job.error ?? "Не удалось написать сценарий") : null;
  return (
    <ReelJobContext.Provider value={{ job, busy: pending || active, error: error ?? failed, start }}>
      {children}
    </ReelJobContext.Provider>
  );
}

export function useReelJob(): Ctx {
  const ctx = useContext(ReelJobContext);
  if (!ctx) throw new Error("useReelJob вне ReelJobProvider");
  return ctx;
}
