"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { fetchLatestReels, fetchReelTranscript, normalizeUsername, type RawReel } from "@/lib/apify";
import { readDb, updateDb } from "@/lib/db";
import { writeScript } from "@/lib/scriptwriter";
import type { Reel, Script, SectionKey } from "@/lib/types";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

function median(values: number[]) {
  const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function syncAccount(username: string): Promise<number> {
  const fetched: RawReel[] = await fetchLatestReels(username, 20);
  if (!fetched.length) throw new Error(`У @${username} не нашлось рилсов.`);

  const med = median(fetched.map((r) => r.views));
  const now = new Date().toISOString();

  await updateDb((db) => {
    const existing = new Map(db.reels.map((r) => [r.id, r]));
    for (const raw of fetched) {
      const prev = existing.get(raw.id);
      const reel: Reel = {
        ...prev,
        id: raw.id,
        account: raw.account,
        url: raw.url,
        caption: raw.caption,
        thumbnailUrl: raw.thumbnailUrl,
        videoUrl: raw.videoUrl,
        views: raw.views,
        likes: raw.likes,
        comments: raw.comments,
        durationSec: raw.durationSec,
        postedAt: raw.postedAt,
        score: med > 0 ? raw.views / med : 0,
        transcript: prev?.transcript ?? raw.transcript,
        fetchedAt: now,
      };
      existing.set(raw.id, reel);
    }
    db.reels = [...existing.values()];

    const fullName = fetched[0]?.fullName;
    const competitor = db.competitors.find((c) => c.username === username);
    if (competitor) {
      competitor.lastFetchedAt = now;
      competitor.medianViews = med;
      competitor.fullName = fullName ?? competitor.fullName;
    } else {
      db.competitors.push({ username, fullName, addedAt: now, lastFetchedAt: now, medianViews: med });
    }
  });

  return fetched.length;
}

export async function addCompetitor(input: string): Promise<ActionResult> {
  const username = normalizeUsername(input);
  if (!username) return { ok: false, error: "Введите ник или ссылку на Instagram-аккаунт." };

  try {
    const count = await syncAccount(username);
    refresh();
    return { ok: true, message: `Загружено ${count} рилсов @${username}` };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function refreshCompetitor(username: string): Promise<ActionResult> {
  try {
    const count = await syncAccount(username);
    refresh();
    return { ok: true, message: `Обновлено ${count} рилсов` };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function removeCompetitor(username: string): Promise<ActionResult> {
  await updateDb((db) => {
    db.competitors = db.competitors.filter((c) => c.username !== username);
    db.reels = db.reels.filter((r) => r.account !== username);
  });
  refresh();
  return { ok: true };
}

export async function generateScript(reelId: string): Promise<ActionResult> {
  try {
    const db = await readDb();
    const reel = db.reels.find((r) => r.id === reelId);
    if (!reel) return { ok: false, error: "Рилс не найден." };

    if (!reel.transcript && !reel.transcriptFetched) {
      reel.transcript = await fetchReelTranscript(reel.url);
      reel.transcriptFetched = true;
      await updateDb((d) => {
        const r = d.reels.find((x) => x.id === reelId);
        if (r) {
          r.transcript = reel.transcript;
          r.transcriptFetched = true;
        }
      });
    }

    const script = await writeScript(reel);
    await updateDb((d) => {
      const r = d.reels.find((x) => x.id === reelId);
      if (r) r.script = script;
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorText(err) };
  }
}

export async function saveScript(reelId: string, script: Script): Promise<ActionResult> {
  const found = await updateDb((db) => {
    const reel = db.reels.find((r) => r.id === reelId);
    if (!reel) return false;
    reel.script = { ...script, editedAt: new Date().toISOString() };
    return true;
  });
  if (!found) return { ok: false, error: "Рилс не найден." };
  refresh();
  return { ok: true };
}

export async function addComment(
  reelId: string,
  section: SectionKey,
  text: string,
  author: string,
): Promise<ActionResult> {
  const body = text.trim();
  if (!body) return { ok: false, error: "Пустой комментарий." };
  const found = await updateDb((db) => {
    const reel = db.reels.find((r) => r.id === reelId);
    if (!reel) return false;
    reel.discussion = [
      ...(reel.discussion ?? []),
      {
        id: crypto.randomUUID(),
        section,
        text: body.slice(0, 2000),
        author: author.trim().slice(0, 40) || "Я",
        createdAt: new Date().toISOString(),
      },
    ];
    return true;
  });
  if (!found) return { ok: false, error: "Рилс не найден." };
  refresh();
  return { ok: true };
}

export async function deleteComment(reelId: string, commentId: string): Promise<ActionResult> {
  await updateDb((db) => {
    const reel = db.reels.find((r) => r.id === reelId);
    if (reel) reel.discussion = reel.discussion?.filter((c) => c.id !== commentId);
  });
  refresh();
  return { ok: true };
}

export async function deleteReel(reelId: string): Promise<void> {
  await updateDb((db) => {
    db.reels = db.reels.filter((r) => r.id !== reelId);
  });
  redirect("/");
}
