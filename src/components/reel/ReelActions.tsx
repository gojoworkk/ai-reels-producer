"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  FileType,
  Link2,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { deleteReel } from "@/app/actions";
import { Menu } from "../Menu";
import { btnOutline, btnSolid } from "../ui";
import { useReelJob } from "./ReelJob";

type Props = { reelId: string; url: string; hasScript: boolean };

export const exportUrl = (reelId: string, format: "md" | "txt" | "pdf") =>
  `/download?reel=${encodeURIComponent(reelId)}&format=${format}`;

export function ReelActions({ reelId, url, hasScript }: Props) {
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const { busy, start } = useReelJob();

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 3000);
  }

  async function copy(load: () => Promise<string>, done: string) {
    try {
      await navigator.clipboard.writeText(await load());
      flash(done);
    } catch {
      flash("Не удалось скопировать");
    }
  }

  function remix() {
    if (hasScript && !confirm("Сделать новую версию сценария? Текущая версия и правки будут заменены.")) return;
    start();
  }

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      {hasScript && (
        <Menu
          trigger={(open) => (
            <button type="button" className={btnOutline} aria-expanded={open}>
              <ArrowUpRight size={14} />
              Экспорт
              <ChevronDown size={13} className="text-faint" />
            </button>
          )}
          items={[
            {
              label: "Скопировать текст",
              icon: <Copy size={14} />,
              onSelect: () =>
                copy(async () => {
                  const res = await fetch(`${exportUrl(reelId, "txt")}&inline=1`);
                  if (!res.ok) throw new Error(await res.text());
                  return res.text();
                }, "Сценарий скопирован"),
            },
            { label: "Скачать PDF", icon: <FileType size={14} />, onSelect: () => window.location.assign(exportUrl(reelId, "pdf")) },
            { label: "Скачать .md", icon: <FileDown size={14} />, onSelect: () => window.location.assign(exportUrl(reelId, "md")) },
            { label: "Скачать .txt", icon: <FileText size={14} />, onSelect: () => window.location.assign(exportUrl(reelId, "txt")) },
          ]}
        />
      )}

      <button type="button" className={btnSolid} onClick={remix} disabled={busy} title="Переписать сценарий заново">
        {busy && <Loader2 size={14} className="animate-spin" />}
        {busy ? "Пишем…" : hasScript ? "Remix" : "Создать"}
      </button>

      <Menu
        trigger={(open) => (
          <button type="button" className={`${btnOutline} w-9 px-0`} aria-label="Ещё" aria-expanded={open}>
            <MoreHorizontal size={16} />
          </button>
        )}
        items={[
          {
            label: "Открыть в Instagram",
            icon: <ExternalLink size={14} />,
            onSelect: () => window.open(url, "_blank", "noreferrer"),
          },
          {
            label: "Скопировать ссылку",
            icon: <Link2 size={14} />,
            onSelect: () => copy(async () => url, "Ссылка скопирована"),
          },
          {
            label: "Удалить рилс",
            icon: <Trash2 size={14} />,
            danger: true,
            onSelect: () => {
              if (confirm("Удалить рилс вместе со сценарием, комментариями и файлами?"))
                startTransition(async () => {
                  const res = await deleteReel(reelId);
                  if (!res.ok) flash(res.error);
                });
            },
          },
        ]}
      />

      {toast && (
        <div className="absolute top-full right-0 z-20 mt-2 max-w-72 rounded-md bg-accent px-3 py-1.5 text-xs text-accent-fg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
