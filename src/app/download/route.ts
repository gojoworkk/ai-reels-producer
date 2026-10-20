import type { NextRequest } from "next/server";
import { ApiError, apiFetch } from "@/lib/api";

// Прокси для скачивания экспортов: браузер не знает API_TOKEN, поэтому файл забирает сервер Next.js.
// /download?reel=<id>&format=md|txt|pdf — сценарий;  /download?list=csv[&account=<ник>] — таблица рилсов
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const reel = params.get("reel");
  const format = params.get("format") ?? "md";
  const account = params.get("account");

  let path: string;
  if (reel && ["md", "txt", "pdf"].includes(format)) {
    path = `/api/reels/${encodeURIComponent(reel)}/export?format=${format}`;
  } else if (params.get("list") === "csv") {
    path = `/api/export/reels.csv${account ? `?account=${encodeURIComponent(account)}` : ""}`;
  } else {
    return new Response("Неизвестный экспорт", { status: 400 });
  }

  try {
    const res = await apiFetch(path);
    const headers = new Headers();
    for (const name of ["content-type", "content-disposition"]) {
      const value = res.headers.get(name);
      if (value) headers.set(name, value);
    }
    if (params.get("inline")) headers.delete("content-disposition");
    return new Response(res.body, { headers });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return new Response(err instanceof Error ? err.message : "Ошибка экспорта", { status });
  }
}
