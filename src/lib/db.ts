import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Database } from "./types";

// MVP-хранилище: один JSON-файл. Для продакшена заменить на Postgres.
const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

const EMPTY: Database = { competitors: [], reels: [] };

export async function readDb(): Promise<Database> {
  try {
    const raw = await readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<Database>;
    return {
      competitors: parsed.competitors ?? [],
      reels: parsed.reels ?? [],
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY);
    throw err;
  }
}

// Все записи идут через одну очередь, чтобы параллельные действия не затирали друг друга.
let queue: Promise<unknown> = Promise.resolve();

export function updateDb<T>(mutate: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await mutate(db);
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DB_PATH}.tmp`;
    await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
    await rename(tmp, DB_PATH);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}
