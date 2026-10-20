"use client";

import { useState, useTransition } from "react";
import { AtSign, Loader2, Plus } from "lucide-react";
import { addCompetitor } from "@/app/actions";

export function AddCompetitorForm() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || pending) return;
    setStatus(null);
    startTransition(async () => {
      const res = await addCompetitor(value);
      if (res.ok) {
        setValue("");
        setStatus({ ok: true, text: res.message ?? "Готово" });
      } else {
        setStatus({ ok: false, text: res.error });
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="flex gap-2 max-sm:flex-col">
        <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-card px-2.5 focus-within:border-fg/40">
          <AtSign size={16} className="shrink-0 text-faint" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="garyvee или https://instagram.com/garyvee"
            disabled={pending}
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {pending ? "Скачиваем рилсы…" : "Добавить"}
        </button>
      </div>
      <p className={`mt-2 min-h-5 text-xs ${status ? (status.ok ? "text-fg" : "text-danger") : "text-faint"}`}>
        {pending ? "Обычно это занимает 30–90 секунд." : status?.text ?? "Берём последние 20 рилсов, чтобы не тратить лимиты."}
      </p>
    </form>
  );
}
