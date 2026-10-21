"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Reel = {
  id: number;
  competitor_id: number;
  handle: string;
  url: string | null;
  caption: string | null;
  views: number;
  likes: number;
  comments: number;
  duration: number | null;
  posted_at: string | null;
  cover: string | null;
  hook: string | null;
  script: string | null;
  cta: string | null;
  remix_status: string;
};

const working = (r: Reel) => r.remix_status === "transcribing" || r.remix_status === "writing";

type Sort = "views" | "likes" | "date";

const sorts: { key: Sort; label: string }[] = [
  { key: "views", label: "Просмотры" },
  { key: "likes", label: "Лайки" },
  { key: "date", label: "Дата" },
];

const num = new Intl.NumberFormat("ru", { notation: "compact", maximumFractionDigits: 1 });

function time(sec: number | null) {
  if (sec == null) return "—";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ReelsTable() {
  const [reels, setReels] = useState<Reel[] | null>(null);
  const [error, setError] = useState(false);
  const [sort, setSort] = useState<Sort>("views");
  const [account, setAccount] = useState<string>("all");

  useEffect(() => {
    fetch("/api/reels")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setReels)
      .catch(() => setError(true));
  }, []);

  const router = useRouter();

  async function remix(r: Reel) {
    if ((r.hook || r.script || r.cta) && !confirm("У этого рилса уже есть сценарий, он будет заменён. Продолжить?")) return;
    await fetch(`/api/reels/${r.id}/remix`, { method: "POST" });
    router.push(`/reels/${r.id}`);
  }

  const accounts = useMemo(() => [...new Set((reels ?? []).map((r) => r.handle))], [reels]);

  // Лидер аккаунта — рилс с максимумом просмотров среди его рилсов
  const leaders = useMemo(() => {
    const best = new Map<string, Reel>();
    for (const r of reels ?? []) {
      const b = best.get(r.handle);
      if (!b || r.views > b.views) best.set(r.handle, r);
    }
    return new Set([...best.values()].map((r) => r.id));
  }, [reels]);

  const rows = useMemo(() => {
    const list = (reels ?? []).filter((r) => account === "all" || r.handle === account);
    const value = (r: Reel) => (sort === "date" ? Date.parse(r.posted_at ?? "") || 0 : sort === "likes" ? r.likes : r.views);
    return [...list].sort((a, b) => value(b) - value(a));
  }, [reels, sort, account]);

  if (error) return <div className="card"><p className="error">Сервер не отвечает</p></div>;
  if (!reels) return <div className="card"><p className="muted">Загружаю…</p></div>;
  if (!reels.length) {
    return (
      <div className="card dark">
        <h2>Пока пусто</h2>
        <p className="muted">Добавь конкурента на вкладке «Конкуренты», и здесь появится рейтинг рилсов.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div className="chips">
          {sorts.map((s) => (
            <button key={s.key} className={sort === s.key ? "chip on" : "chip"} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="row">
          <select className="select" value={account} onChange={(e) => setAccount(e.target.value)}>
            <option value="all">Все аккаунты</option>
            {accounts.map((a) => (
              <option key={a} value={a}>@{a}</option>
            ))}
          </select>
          <a className="btn light link-btn" style={{ margin: 0 }} href={account === "all" ? "/api/export.csv" : `/api/export.csv?handle=${account}`}>
            Скачать CSV
          </a>
        </div>
      </div>

      <div className="table">
        {rows.map((r, i) => (
          <div className="reel" key={r.id}>
            <span className="rank">{i + 1}</span>
            <Link href={`/reels/${r.id}`}>
              {r.cover ? <img className="thumb" src={`/api/files/${r.cover}`} alt="" /> : <span className="thumb" />}
            </Link>
            <div className="info">
              <div className="who">
                @{r.handle}
                {leaders.has(r.id) && <span className="badge">Лидер</span>}
              </div>
              <Link className="caption" href={`/reels/${r.id}`}>
                {r.caption?.trim() || "Без подписи"}
              </Link>
            </div>
            <div className="stat"><b>{num.format(r.views)}</b><span>просмотры</span></div>
            <div className="stat"><b>{num.format(r.likes)}</b><span>лайки</span></div>
            <div className="stat"><b>{num.format(r.comments)}</b><span>комм.</span></div>
            <div className="stat"><b>{time(r.duration)}</b><span>{r.posted_at ? new Date(r.posted_at).toLocaleDateString("ru") : ""}</span></div>
            <button className="btn small" disabled={working(r)} onClick={() => remix(r)}>
              {working(r) ? "…" : "Remix"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
