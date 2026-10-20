"use client";

import { useState, useTransition } from "react";
import { Download, Globe, Loader2 } from "lucide-react";
import { addCompetitor } from "@/app/actions";

export function AddCompetitorForm({ limit }: { limit: number }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await addCompetitor(value);
      if (res.ok) setValue("");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <label className="flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-card px-3 focus-within:border-fg/40">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Instagram аккаунт или URL"
          disabled={pending}
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-faint"
        />
        <Globe size={16} className="shrink-0 text-faint" />
      </label>
      <button
        type="submit"
        disabled={pending || !value.trim()}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {pending ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
        Загрузить {limit} рилсов
      </button>
      <p className={`min-h-5 text-xs ${error ? "text-danger" : "text-faint"}`}>
        {error ?? "Загрузка идёт в фоне: прогресс появится в списке аккаунтов ниже."}
      </p>
    </form>
  );
}
