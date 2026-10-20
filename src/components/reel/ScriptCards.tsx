"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Camera, Check, ChevronRight, Loader2, MessageSquare, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { addComment, deleteComment, saveScript } from "@/app/actions";
import { timeAgo } from "@/lib/time";
import type { Comment, Script, ScriptBlock, ScriptPatch, SectionKey } from "@/lib/types";
import { ProgressBar } from "../JobProgress";
import { Card, btnSmall, btnSmallGhost, btnSmallSolid, btnSolid } from "../ui";
import { useReelJob } from "./ReelJob";

type SaveResult = { ok: true } | { ok: false; error: string };

type Props = {
  reelId: string;
  script: Script | null;
  comments: Comment[];
  caption: string;
  transcript: string | null;
};

export function ScriptCards({ reelId, script, comments, caption, transcript }: Props) {
  const { job, busy, error } = useReelJob();
  const original = <OriginalCard caption={caption} transcript={transcript} />;

  if (!script) {
    return (
      <div className="space-y-4">
        <EmptyScript />
        {original}
      </div>
    );
  }

  const save = async (patch: ScriptPatch): Promise<SaveResult> => {
    const res = await saveScript(reelId, patch);
    return res.ok ? { ok: true } : res;
  };
  const thread = (section: SectionKey) => (
    <Comments
      reelId={reelId}
      section={section}
      aiNote={script.notes?.[section]}
      aiAt={script.generated_at}
      comments={comments.filter((c) => c.section === section)}
    />
  );

  return (
    <div className="space-y-4">
      {busy && job && (
        <Card className="px-5 py-4">
          <p className="mb-2 text-[13px] font-semibold">Remix: пишем новую версию сценария</p>
          <ProgressBar job={job} />
        </Card>
      )}
      {error && !busy && <Card className="px-5 py-3 text-[13px] text-danger">{error}</Card>}

      <EditableCard
        title="Идея"
        subtitle="Разбор оригинала"
        value={{ idea: script.idea, why_it_works: script.why_it_works }}
        onSave={(v) => save(v)}
        view={(v) => (
          <div className="space-y-3">
            <p>{v.idea}</p>
            <p className="text-muted">
              <span className="font-semibold text-fg">Почему залетело. </span>
              {v.why_it_works}
            </p>
          </div>
        )}
        edit={(v, set) => (
          <div className="space-y-3">
            <Area label="Идея" value={v.idea} onChange={(idea) => set({ ...v, idea })} />
            <Area label="Почему залетело" value={v.why_it_works} onChange={(why_it_works) => set({ ...v, why_it_works })} />
          </div>
        )}
      />

      <EditableCard
        title="Хук"
        subtitle="Редактируемый блок · первые 1–3 секунды"
        value={script.hook}
        onSave={(hook) => save({ hook })}
        view={(b) => <BlockView block={b} />}
        edit={(b, set) => <BlockEdit block={b} onChange={set} />}
        footer={thread("hook")}
      />

      <EditableCard
        title="Скрипт"
        subtitle="Редактируемый блок"
        value={script.body}
        onSave={(body) => save({ body })}
        view={(body) => (
          <div className="space-y-3">
            {body.map((b, i) => (
              <BlockView key={i} block={b} />
            ))}
          </div>
        )}
        edit={(body, set) => (
          <div className="space-y-4">
            {body.map((b, i) => (
              <div key={i} className="flex gap-2 border-b border-line pb-4 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <BlockEdit block={b} withLabel onChange={(nb) => set(body.map((x, j) => (j === i ? nb : x)))} />
                </div>
                {body.length > 1 && (
                  <button
                    type="button"
                    title="Удалить пункт"
                    onClick={() => set(body.filter((_, j) => j !== i))}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-faint hover:bg-hover hover:text-fg"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => set([...body, { label: "", text: "", visual: "" }])}
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted hover:bg-hover"
            >
              <Plus size={13} />
              Добавить пункт
            </button>
          </div>
        )}
        footer={thread("body")}
      />

      <EditableCard
        title="Call to action"
        subtitle="Редактируемый блок"
        value={script.cta}
        onSave={(cta) => save({ cta })}
        view={(b) => <BlockView block={b} />}
        edit={(b, set) => <BlockEdit block={b} onChange={set} />}
        footer={thread("cta")}
      />

      <EditableCard
        title="Описание к посту"
        subtitle="Редактируемый блок"
        value={{ caption: script.caption, tags: script.tags.join(", ") }}
        onSave={(v) =>
          save({
            caption: v.caption,
            tags: v.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
          })
        }
        view={(v) => <p className="whitespace-pre-wrap">{v.caption}</p>}
        edit={(v, set) => (
          <div className="space-y-3">
            <Area label="Описание" value={v.caption} onChange={(caption) => set({ ...v, caption })} />
            <Area label="Теги через запятую" value={v.tags} onChange={(tags) => set({ ...v, tags })} />
          </div>
        )}
      />

      {original}

      <p className="px-1 text-[11px] text-faint" suppressHydrationWarning>
        Версия {script.version} · язык оригинала: {script.source_language} · создан {timeAgo(script.generated_at)}
        {script.edited_at && ` · изменён ${timeAgo(script.edited_at)}`}
      </p>
    </div>
  );
}

function EditableCard<T>({
  title,
  subtitle,
  value,
  onSave,
  view,
  edit,
  footer,
}: {
  title: string;
  subtitle: string;
  value: T;
  onSave: (v: T) => Promise<SaveResult>;
  view: (v: T) => ReactNode;
  edit: (v: T, set: (v: T) => void) => ReactNode;
  footer?: ReactNode;
}) {
  const [draft, setDraft] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function save() {
    if (draft === null) return;
    setError(null);
    startSave(async () => {
      const res = await onSave(draft);
      if (res.ok) setDraft(null);
      else setError(res.error);
    });
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="mt-0.5 text-[11px] text-faint">{subtitle}</p>
        </div>
        {draft !== null ? (
          <div className="flex gap-1.5">
            <button type="button" className={btnSmallGhost} onClick={() => setDraft(null)} disabled={saving}>
              <X size={12} />
              Отмена
            </button>
            <button type="button" className={btnSmallSolid} onClick={save} disabled={saving}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Сохранить
            </button>
          </div>
        ) : (
          <button type="button" className={btnSmall} onClick={() => setDraft(structuredClone(value))}>
            <Pencil size={12} />
            Редактировать
          </button>
        )}
      </div>

      <div
        className={`mx-5 mt-4 mb-5 rounded-lg border px-4 py-3.5 text-[14px] leading-relaxed ${
          draft !== null ? "border-line-strong" : "border-line"
        }`}
      >
        {draft !== null ? edit(draft, setDraft) : view(value)}
      </div>
      {error && <p className="-mt-3 mb-4 px-5 text-xs text-danger">{error}</p>}

      {footer}
    </Card>
  );
}

const withDot = (s: string) => (/[.!?…:]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

function BlockView({ block }: { block: ScriptBlock }) {
  return (
    <div>
      <p className="whitespace-pre-wrap">
        {block.label && <span className="font-semibold">{withDot(block.label)} </span>}
        {block.text}
      </p>
      {block.visual && (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-faint">
          <Camera size={12} className="mt-[2px] shrink-0" />
          {block.visual}
        </p>
      )}
    </div>
  );
}

function BlockEdit({
  block,
  onChange,
  withLabel = false,
}: {
  block: ScriptBlock;
  onChange: (b: ScriptBlock) => void;
  withLabel?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {withLabel && (
        <Area label="Заголовок пункта" value={block.label} onChange={(label) => onChange({ ...block, label })} bold />
      )}
      <Area label="Текст" value={block.text} onChange={(text) => onChange({ ...block, text })} />
      <Area label="В кадре" value={block.visual} onChange={(visual) => onChange({ ...block, visual })} small />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  bold = false,
  small = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  bold?: boolean;
  small?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-[0.1em] text-faint uppercase">{label}</span>
      <textarea
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        className={`block w-full resize-none rounded-md bg-hover px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-line-strong ${
          bold ? "font-semibold" : ""
        } ${small ? "text-xs text-muted" : ""}`}
      />
    </label>
  );
}

const AUTHOR_KEY = "reels.author";

function Comments({
  reelId,
  section,
  aiNote,
  aiAt,
  comments,
}: {
  reelId: string;
  section: SectionKey;
  aiNote?: string;
  aiAt: string;
  comments: Comment[];
}) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState(() => {
    try {
      return localStorage.getItem(AUTHOR_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const all: Comment[] = [
    ...(aiNote ? [{ id: "ai", text: aiNote, author: "ИИ-продюсер", created_at: aiAt, section }] : []),
    ...comments,
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const name = author.trim() || "Я";
    try {
      localStorage.setItem(AUTHOR_KEY, name);
    } catch {}
    setError(null);
    startTransition(async () => {
      const res = await addComment(reelId, section, text, name);
      if (res.ok) setText("");
      else setError(res.error);
    });
  }

  return (
    <div className="border-t border-line px-5 py-4">
      {all.map((c) => (
        <div key={c.id} className="group mb-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-faint">
            <MessageSquare size={11} />
            Комментарий
          </p>
          <p className="text-[13px] whitespace-pre-wrap text-muted">{c.text}</p>
          <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
            <span>— {c.author}</span>
            <span className="flex items-center gap-2">
              {c.id !== "ai" && (
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 hover:text-danger"
                  onClick={() => startTransition(() => deleteComment(reelId, c.id).then(() => undefined))}
                >
                  удалить
                </button>
              )}
              <span suppressHydrationWarning>{timeAgo(c.created_at)}</span>
            </span>
          </div>
        </div>
      ))}
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Добавить комментарий…"
          disabled={pending}
          className="h-8 min-w-0 flex-1 rounded-md bg-hover px-2.5 text-[13px] outline-none placeholder:text-faint focus:ring-1 focus:ring-line-strong"
        />
        {text.trim() && (
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Ваше имя"
            aria-label="Ваше имя"
            className="h-8 w-28 rounded-md bg-hover px-2.5 text-[13px] outline-none placeholder:text-faint focus:ring-1 focus:ring-line-strong"
          />
        )}
        {text.trim() && (
          <button type="submit" className={btnSmall} disabled={pending}>
            {pending ? <Loader2 size={12} className="animate-spin" /> : "Отправить"}
          </button>
        )}
      </form>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}

function EmptyScript() {
  const { job, busy, error, start } = useReelJob();

  return (
    <Card className="px-6 py-12 text-center">
      <Sparkles size={22} strokeWidth={1.6} className="mx-auto text-faint" />
      <p className="mt-3 text-[15px] font-semibold">Сценария пока нет</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted">
        Достанем транскрипт рилса и напишем сценарий на русском: хук, скрипт и призыв к действию.
      </p>
      {busy && job ? (
        <ProgressBar job={job} className="mx-auto mt-5 max-w-sm text-left" />
      ) : (
        <button type="button" className={`${btnSolid} mt-5`} disabled={busy} onClick={start}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {busy ? "Запускаем…" : "Создать сценарий"}
        </button>
      )}
      {error && !busy && <p className="mx-auto mt-3 max-w-sm text-xs text-danger">{error}</p>}
    </Card>
  );
}

function OriginalCard({ caption, transcript }: { caption: string; transcript: string | null }) {
  return (
    <Card>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-5 py-4 text-[15px] font-semibold">
          <ChevronRight size={16} className="text-faint transition-transform group-open:rotate-90" />
          Оригинал: описание и транскрипт
        </summary>
        <div className="space-y-4 border-t border-line px-5 py-4 text-[13px]">
          <div>
            <p className="mb-1 text-xs font-semibold">Описание</p>
            <p className="whitespace-pre-wrap text-muted">{caption || "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold">Транскрипт</p>
            <p className="whitespace-pre-wrap text-muted">{transcript || "Транскрипт подтянется при создании сценария."}</p>
          </div>
        </div>
      </details>
    </Card>
  );
}
