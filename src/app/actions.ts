"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { api, json } from "@/lib/api";
import type { Comment, Competitor, Job, Script, ScriptPatch, SectionKey } from "@/lib/types";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function attempt<T>(fn: () => Promise<T>, refreshAfter = true): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (refreshAfter) refresh();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function addCompetitor(username: string) {
  return attempt(() => api<Competitor>("/api/competitors", { method: "POST", body: json({ username }) }));
}

export async function syncCompetitor(username: string) {
  return attempt(() => api<Job>(`/api/competitors/${encodeURIComponent(username)}/sync`, { method: "POST" }));
}

export async function removeCompetitor(username: string) {
  return attempt(() => api(`/api/competitors/${encodeURIComponent(username)}`, { method: "DELETE" }));
}

export async function generateScript(reelId: string) {
  return attempt(() => api<Job>(`/api/reels/${encodeURIComponent(reelId)}/script`, { method: "POST" }));
}

export async function saveScript(reelId: string, patch: ScriptPatch) {
  return attempt(() =>
    api<Script>(`/api/reels/${encodeURIComponent(reelId)}/script`, { method: "PATCH", body: json(patch) }),
  );
}

export async function addComment(reelId: string, section: SectionKey, text: string, author: string) {
  return attempt(() =>
    api<Comment>(`/api/reels/${encodeURIComponent(reelId)}/comments`, {
      method: "POST",
      body: json({ section, text, author }),
    }),
  );
}

export async function deleteComment(reelId: string, commentId: string) {
  return attempt(() =>
    api(`/api/reels/${encodeURIComponent(reelId)}/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" }),
  );
}

export async function deleteReel(reelId: string, goHome = true) {
  const res = await attempt(() => api(`/api/reels/${encodeURIComponent(reelId)}`, { method: "DELETE" }));
  if (res.ok && goHome) redirect("/");
  return res;
}

// Опрос статуса задачи: интерфейс показывает прогресс загрузки и обработки
export async function getJob(jobId: string) {
  return attempt(() => api<Job>(`/api/jobs/${encodeURIComponent(jobId)}`), false);
}

export async function refreshPage() {
  refresh();
}
