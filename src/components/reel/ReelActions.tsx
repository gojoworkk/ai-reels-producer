"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  Copy,
  ExternalLink,
  FileDown,
  FileText,
  Link2,
  Loader2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { deleteReel, generateScript } from "@/app/actions";
import { downloadFile, scriptToText, slugify } from "@/lib/export";
import type { Script } from "@/lib/types";
import { Menu } from "../Menu";
import { btnOutline, btnSolid } from "../ui";

type Props = { reelId: string; url: string; script?: Script; canGenerate: boolean };

export function ReelActions({ reelId, url, script, canGenerate }: Props) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  function remix() {
    if (script && !confirm("Сделать новую версию сценария? Текущая версия и правки будут заменены.")) return;
    startTransition(async () => {
      const res = await generateScript(reelId);
      flash(res.ok ? "Сценарий готов" : res.error);
    });
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(done);
    } catch {
      flash("Браузер не дал доступ к буферу обмена");
    }
  }

  const name = slugify(script?.title ?? reelId);

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      {script && (
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
              onSelect: () => copy(scriptToText(script, url, false), "Сценарий скопирован"),
            },
            {
              label: "Скачать .md",
              icon: <FileDown size={14} />,
              onSelect: () => downloadFile(`${name}.md`, scriptToText(script, url, true), "text/markdown"),
            },
            {
              label: "Скачать .txt",
              icon: <FileText size={14} />,
              onSelect: () => downloadFile(`${name}.txt`, scriptToText(script, url, false), "text/plain"),
            },
          ]}
        />
      )}

      <button
        type="button"
        className={btnSolid}
        onClick={remix}
        disabled={pending || !canGenerate}
        title={canGenerate ? "Переписать сценарий заново" : "Добавьте ANTHROPIC_API_KEY в .env.local"}
      >
        {pending && <Loader2 size={14} className="animate-spin" />}
        {pending ? "Пишем…" : script ? "Remix" : "Создать"}
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
            onSelect: () => copy(url, "Ссылка скопирована"),
          },
          {
            label: "Удалить рилс",
            icon: <Trash2 size={14} />,
            danger: true,
            onSelect: () => {
              if (confirm("Удалить рилс вместе со сценарием и комментариями?")) startTransition(() => deleteReel(reelId));
            },
          },
        ]}
      />

      {toast && (
        <div className="absolute top-full right-0 z-20 mt-2 rounded-md bg-accent px-3 py-1.5 text-xs whitespace-nowrap text-accent-fg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
