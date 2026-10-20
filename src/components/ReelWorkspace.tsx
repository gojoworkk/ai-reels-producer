"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Camera,
  Check,
  ChevronRight,
  ExternalLink,
  Lightbulb,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { generateScript, saveScript } from "@/app/actions";
import type { Script, ScriptBlock } from "@/lib/types";

type Props = {
  reelId: string;
  url: string;
  videoUrl?: string;
  caption: string;
  transcript?: string;
  script?: Script;
  canGenerate: boolean;
};

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors disabled:opacity-40 disabled:pointer-events-none";
const btnGhost = `${btn} border border-line-strong hover:bg-hover`;
const btnPrimary = `${btn} bg-accent font-medium text-accent-fg hover:opacity-90`;

export function ReelWorkspace({ reelId, url, videoUrl, caption, transcript, script, canGenerate }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Script | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();

  function runGenerate() {
    setError(null);
    startGenerate(async () => {
      const res = await generateScript(reelId);
      if (!res.ok) setError(res.error);
    });
  }

  function startEdit() {
    if (!script) return;
    setDraft(structuredClone(script));
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setDraft(null);
  }

  function save() {
    if (!draft) return;
    setError(null);
    startSave(async () => {
      const res = await saveScript(reelId, draft);
      if (res.ok) {
        setEditing(false);
        setDraft(null);
      } else {
        setError(res.error);
      }
    });
  }

  const current = editing && draft ? draft : script;

  return (
    <>
      <div className="sticky top-0 z-10 mt-6 flex flex-wrap items-center gap-2 border-b border-line bg-bg py-3">
        <button type="button" className={btnGhost} onClick={() => setShowOriginal(true)}>
          <Play size={14} />
          Смотреть оригинал
        </button>

        {script && !editing && (
          <>
            <button type="button" className={btnGhost} onClick={startEdit} title="Редактировать сценарий">
              <Pencil size={14} />
              Редактировать
            </button>
            <button
              type="button"
              className={`${btn} text-muted hover:bg-hover`}
              disabled={generating || !canGenerate}
              onClick={() => confirm("Пересоздать сценарий? Ваши правки будут потеряны.") && runGenerate()}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              {generating ? "Пишем заново…" : "Пересоздать"}
            </button>
          </>
        )}

        {editing && (
          <>
            <button type="button" className={btnPrimary} onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Сохранить
            </button>
            <button type="button" className={`${btn} text-muted hover:bg-hover`} onClick={cancelEdit} disabled={saving}>
              Отмена
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-4 rounded-md bg-callout px-3 py-2 text-sm text-danger">{error}</p>}

      {!current ? (
        <EmptyScript generating={generating} canGenerate={canGenerate} onGenerate={runGenerate} />
      ) : (
        <ScriptBody script={current} editing={editing} onChange={setDraft} />
      )}

      <details className="group mt-12">
        <summary className="flex cursor-pointer list-none items-center gap-1 rounded px-1 py-1 text-sm font-medium text-muted hover:bg-hover">
          <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
          Оригинал: описание и транскрипт
        </summary>
        <div className="mt-2 space-y-4 pl-6 text-sm">
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-faint uppercase">Описание</p>
            <p className="whitespace-pre-wrap text-muted">{caption || "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium tracking-wide text-faint uppercase">Транскрипт</p>
            <p className="whitespace-pre-wrap text-muted">
              {transcript || "Транскрипт подтянется при создании сценария."}
            </p>
          </div>
        </div>
      </details>

      {showOriginal && <OriginalDialog url={url} videoUrl={videoUrl} onClose={() => setShowOriginal(false)} />}
    </>
  );
}

function EmptyScript({
  generating,
  canGenerate,
  onGenerate,
}: {
  generating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="mt-8 rounded-md border border-dashed border-line-strong px-6 py-12 text-center">
      <Sparkles size={22} strokeWidth={1.6} className="mx-auto text-faint" />
      <p className="mt-3 text-[15px] font-medium">Сценария пока нет</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        {generating
          ? "Достаём транскрипт и адаптируем текст на русский. Это займёт около минуты."
          : "Достанем транскрипт рилса и напишем сценарий на русском: хук, основная часть, призыв к действию."}
      </p>
      <button type="button" className={`${btnPrimary} mt-5`} onClick={onGenerate} disabled={generating || !canGenerate}>
        {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        {generating ? "Пишем сценарий…" : "Создать сценарий"}
      </button>
      {!canGenerate && <p className="mt-3 text-xs text-danger">Добавьте ANTHROPIC_API_KEY в .env.local</p>}
    </div>
  );
}

function ScriptBody({
  script,
  editing,
  onChange,
}: {
  script: Script;
  editing: boolean;
  onChange: (s: Script) => void;
}) {
  const set = (patch: Partial<Script>) => onChange({ ...script, ...patch });
  const setBody = (i: number, block: ScriptBlock) => set({ body: script.body.map((b, j) => (j === i ? block : b)) });

  return (
    <article className="mt-8">
      {editing && (
        <Field label="Название" value={script.title} onChange={(title) => set({ title })} className="mb-6 font-semibold" />
      )}

      <div className="flex gap-3 rounded-md bg-callout px-4 py-4">
        <Lightbulb size={18} strokeWidth={1.8} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-3 text-[15px]">
          <div>
            <p className="font-semibold">Идея</p>
            <Editable editing={editing} value={script.idea} onChange={(idea) => set({ idea })} />
          </div>
          <div>
            <p className="font-semibold">Почему залетело</p>
            <Editable editing={editing} value={script.whyItWorks} onChange={(whyItWorks) => set({ whyItWorks })} />
          </div>
        </div>
      </div>

      <Section title="Хук" hint="первые 1–3 секунды">
        <BlockView block={script.hook} editing={editing} onChange={(hook) => set({ hook })} big />
      </Section>

      <Section title="Основная часть">
        <ol className="space-y-5">
          {script.body.map((block, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-5 shrink-0 pt-0.5 text-right text-[15px] text-faint tabular-nums">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <BlockView block={block} editing={editing} onChange={(b) => setBody(i, b)} />
              </div>
              {editing && script.body.length > 1 && (
                <button
                  type="button"
                  title="Удалить блок"
                  className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-fg"
                  onClick={() => set({ body: script.body.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ol>
        {editing && (
          <button
            type="button"
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:bg-hover"
            onClick={() => set({ body: [...script.body, { text: "", visual: "" }] })}
          >
            <Plus size={14} />
            Добавить блок
          </button>
        )}
      </Section>

      <Section title="Призыв к действию">
        <BlockView block={script.cta} editing={editing} onChange={(cta) => set({ cta })} />
      </Section>

      <Section title="Описание к посту">
        <Editable editing={editing} value={script.caption} onChange={(caption) => set({ caption })} />
      </Section>

      <p className="mt-8 text-xs text-faint" suppressHydrationWarning>
        Язык оригинала: {script.sourceLanguage} · создан {new Date(script.generatedAt).toLocaleString("ru-RU")}
        {script.editedAt && ` · изменён ${new Date(script.editedAt).toLocaleString("ru-RU")}`}
      </p>
    </article>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="mb-3 flex items-baseline gap-2 text-[22px] font-semibold tracking-tight">
        {title}
        {hint && <span className="text-sm font-normal text-faint">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function BlockView({
  block,
  editing,
  onChange,
  big = false,
}: {
  block: ScriptBlock;
  editing: boolean;
  onChange: (b: ScriptBlock) => void;
  big?: boolean;
}) {
  return (
    <div>
      <Editable
        editing={editing}
        value={block.text}
        onChange={(text) => onChange({ ...block, text })}
        className={big ? "text-[19px] leading-snug font-medium" : "text-[15px] leading-relaxed"}
        placeholder="Текст"
      />
      <div className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
        <Camera size={14} strokeWidth={1.8} className="mt-[3px] shrink-0 text-faint" />
        <Editable
          editing={editing}
          value={block.visual}
          onChange={(visual) => onChange({ ...block, visual })}
          className="flex-1"
          placeholder="Что в кадре"
        />
      </div>
    </div>
  );
}

function Editable({
  editing,
  value,
  onChange,
  className = "",
  placeholder,
}: {
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  if (!editing) return <p className={`whitespace-pre-wrap ${className}`}>{value}</p>;
  return (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={1}
      className={`-mx-1.5 block w-[calc(100%+12px)] resize-none rounded px-1.5 py-0.5 outline-none placeholder:text-faint hover:bg-hover focus:bg-hover ${className}`}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-faint uppercase">{label}</span>
      <Editable editing value={value} onChange={onChange} className={`text-[19px] ${className}`} />
    </label>
  );
}

function OriginalDialog({ url, videoUrl, onClose }: { url: string; videoUrl?: string; onClose: () => void }) {
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-lg border border-line bg-bg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-sm font-medium">Оригинал</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>
        {videoUrl && !videoFailed ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            onError={() => setVideoFailed(true)}
            className="aspect-[9/16] max-h-[70vh] w-full bg-black"
          />
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Видео нельзя воспроизвести здесь — ссылка Instagram устарела. Откройте рилс в Instagram или обновите
            конкурента.
          </p>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-line px-3 py-2.5 text-sm hover:bg-hover"
        >
          Открыть в Instagram
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
