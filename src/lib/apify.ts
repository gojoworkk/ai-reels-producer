import "server-only";

// Apify actor: https://apify.com/apify/instagram-reel-scraper
const ACTOR_ID = "apify~instagram-reel-scraper";

export type RawReel = {
  id: string;
  account: string;
  fullName?: string;
  url: string;
  caption: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  views: number;
  likes: number;
  comments: number;
  durationSec?: number;
  postedAt?: string;
  transcript?: string;
};

type ApifyItem = Record<string, unknown>;

export function hasApifyToken() {
  return Boolean(process.env.APIFY_TOKEN);
}

async function runActor(input: Record<string, unknown>): Promise<ApifyItem[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("Не задан APIFY_TOKEN. Добавьте его в .env.local и перезапустите сервер.");
  }

  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=300`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Apify вернул ${res.status}: ${body.slice(0, 300)}`);
  }

  const items = (await res.json()) as ApifyItem[];
  const failed = items.find((i) => typeof i.error === "string");
  if (failed && items.length === 1) {
    throw new Error(
      `Apify: ${String(failed.errorDescription ?? failed.error)} (аккаунт закрыт или не существует?)`,
    );
  }
  return items.filter((i) => typeof i.error !== "string");
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

// Название поля с транскриптом в датасете не задокументировано, поэтому проверяем несколько вариантов.
function pickTranscript(item: ApifyItem): string | undefined {
  for (const key of ["transcript", "transcription", "audioTranscript", "videoTranscript"]) {
    const v = item[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (Array.isArray(v)) {
      const text = v
        .map((seg) => (typeof seg === "string" ? seg : str((seg as ApifyItem)?.text) ?? ""))
        .join(" ")
        .trim();
      if (text) return text;
    }
    if (v && typeof v === "object") {
      const text = str((v as ApifyItem).text);
      if (text?.trim()) return text.trim();
    }
  }
  return undefined;
}

function toRawReel(item: ApifyItem): RawReel | null {
  const id = str(item.shortCode) ?? str(item.id);
  const account = str(item.ownerUsername);
  if (!id || !account) return null;
  return {
    id,
    account: account.toLowerCase(),
    fullName: str(item.ownerFullName),
    url: str(item.url) ?? `https://www.instagram.com/reel/${id}/`,
    caption: str(item.caption) ?? "",
    thumbnailUrl: str(item.displayUrl),
    videoUrl: str(item.videoUrl),
    views: num(item.videoPlayCount) || num(item.videoViewCount),
    likes: Math.max(0, num(item.likesCount)),
    comments: num(item.commentsCount),
    durationSec: num(item.videoDuration) || undefined,
    postedAt: str(item.timestamp),
    transcript: pickTranscript(item),
  };
}

export async function fetchLatestReels(username: string, limit = 20): Promise<RawReel[]> {
  const items = await runActor({
    username: [username],
    resultsLimit: limit,
    skipPinnedPosts: true,
  });
  return items.map(toRawReel).filter((r): r is RawReel => r !== null);
}

// Транскрипт платный (поминутно), поэтому берём его только для рилса, по которому пишем сценарий.
export async function fetchReelTranscript(reelUrl: string): Promise<string | undefined> {
  const items = await runActor({
    username: [reelUrl],
    resultsLimit: 1,
    includeTranscript: true,
  });
  for (const item of items) {
    const t = pickTranscript(item);
    if (t) return t;
  }
  return undefined;
}

export function normalizeUsername(input: string): string | null {
  let s = input.trim();
  const m = s.match(/instagram\.com\/([^/?#]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}
