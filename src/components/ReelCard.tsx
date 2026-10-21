"use client";

import { useEffect, useState } from "react";

type Reel = {
  id: number;
  handle: string;
  url: string | null;
  caption: string | null;
  views: number;
  likes: number;
  comments: number;
  cover: string | null;
  video: string | null;
  hook: string | null;
  script: string | null;
  cta: string | null;
  transcript: string | null;
  remix_status: "idle" | "transcribing" | "writing" | "done" | "error";
  remix_error: string | null;
};

const progress: Record<string, string> = {
  transcribing: "Расшифровываю речь из видео… Первый раз дольше: скачивается модель.",
  writing: "Пишу сценарий на русском под твой профиль…",
};

type Field = "hook" | "script" | "cta";

const blocks: { key: Field; title: string; hint: string }[] = [
  { key: "hook", title: "Хук", hint: "Первые секунды, которые цепляют" },
  { key: "script", title: "Скрипт", hint: "Основной текст ролика" },
  { key: "cta", title: "CTA", hint: "Призыв к действию в конце" },
];

const num = new Intl.NumberFormat("ru");

function Block({ reel, field, onSaved }: { reel: Reel; field: Field; onSaved: (r: Reel) => void }) {
  const meta = blocks.find((b) => b.key === field)!;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/reels/${reel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: text }),
      });
      if (!r.ok) throw new Error();
      onSaved(await r.json());
      setEditing(false);
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  const value = reel[field];
  return (
    <div className="card">
      <div className="block-head">
        <div>
          <h2>{meta.title}</h2>
          <span className="muted small-text">{meta.hint}</span>
        </div>
        {!editing && (
          <button className="btn light" onClick={() => { setText(value ?? ""); setEditing(true); }}>
            Ред.
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} autoFocus rows={field === "script" ? 10 : 4} />
          {error && <p className="error">{error}</p>}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" disabled={saving} onClick={save}>Сохранить</button>
            <button className="btn light" onClick={() => setEditing(false)}>Отмена</button>
          </div>
        </>
      ) : (
        <p className={value ? "text" : "muted"}>{value || "Пока пусто. Заполнится после Remix или впиши вручную."}</p>
      )}
    </div>
  );
}

export default function ReelCard({ id }: { id: number }) {
  const [reel, setReel] = useState<Reel | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/reels/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setReel)
      .catch(() => setError("Рилс не найден"));
  }, [id]);

  // Пока идёт Remix, раз в пару секунд спрашиваем статус
  const working = reel?.remix_status === "transcribing" || reel?.remix_status === "writing";
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => {
      fetch(`/api/reels/${id}`).then((r) => r.json()).then(setReel).catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, [working, id]);

  async function remix() {
    if (reel && (reel.hook || reel.script || reel.cta) && !confirm("Текущие блоки будут заменены новым сценарием. Продолжить?")) return;
    await fetch(`/api/reels/${id}/remix`, { method: "POST" });
    const r = await fetch(`/api/reels/${id}`);
    setReel(await r.json());
  }

  if (error) return <div className="card"><p className="error">{error}</p></div>;
  if (!reel) return <div className="card"><p className="muted">Загружаю…</p></div>;

  return (
    <div className="reel-page">
      <div className="card source">
        {reel.video ? (
          <video className="player" src={`/api/files/${reel.video}`} poster={reel.cover ? `/api/files/${reel.cover}` : undefined} controls />
        ) : reel.cover ? (
          <img className="player" src={`/api/files/${reel.cover}`} alt="" />
        ) : null}
        <div className="who" style={{ marginTop: 16 }}>@{reel.handle}</div>
        <p className="muted small-text" style={{ marginTop: 6 }}>{reel.caption?.trim() || "Без подписи"}</p>
        <div className="numbers">
          <div className="stat"><b>{num.format(reel.views)}</b><span>просмотры</span></div>
          <div className="stat"><b>{num.format(reel.likes)}</b><span>лайки</span></div>
          <div className="stat"><b>{num.format(reel.comments)}</b><span>комм.</span></div>
        </div>
        <button className="btn light link-btn" onClick={() => window.print()}>Скачать PDF</button>
        {reel.url && <a className="btn light link-btn" style={{ marginLeft: 8 }} href={reel.url} target="_blank" rel="noreferrer">Открыть в Instagram</a>}
        {!reel.video && <p className="muted small-text" style={{ marginTop: 12 }}>Видео не сохранилось, Instagram отдаёт его ненадолго.</p>}
      </div>
      <div className="texts">
        <div className="card dark remix-bar">
          <div>
            <h2>Remix</h2>
            <p className="muted small-text">
              {working
                ? progress[reel.remix_status]
                : reel.remix_status === "error"
                  ? <span className="error-dark">{reel.remix_error}</span>
                  : "Расшифрую речь и перепишу сценарий на русском под твой профиль."}
            </p>
          </div>
          <button className="btn invert" disabled={working} onClick={remix}>
            {working ? "Работаю…" : reel.remix_status === "done" ? "Повторить Remix" : "Сделать Remix"}
          </button>
        </div>
        {blocks.map((b) => (
          <Block key={b.key} reel={reel} field={b.key} onSaved={setReel} />
        ))}
        {reel.transcript && (
          <details className="card">
            <summary className="small-text muted">Оригинал: расшифровка речи</summary>
            <p className="text small-text" style={{ marginTop: 12 }}>{reel.transcript}</p>
          </details>
        )}
      </div>
    </div>
  );
}
