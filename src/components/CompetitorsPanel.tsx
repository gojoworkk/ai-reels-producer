"use client";

import { useCallback, useEffect, useState } from "react";

type Competitor = {
  id: number;
  handle: string;
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  reels: number;
};

async function api(path: string, method = "GET", body?: object) {
  const r = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail ?? "Ошибка сервера");
  return r.json();
}

export default function CompetitorsPanel() {
  const [list, setList] = useState<Competitor[]>([]);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setList(await api("/competitors"));
    } catch {
      setError("Сервер не отвечает");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Пока что-то грузится, раз в 3 секунды обновляем статус
  const loading = list.some((c) => c.status === "loading");
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [loading, refresh]);

  async function add() {
    setError("");
    setBusy(true);
    try {
      const { id } = await api("/competitors", "POST", { handle: value });
      await api(`/competitors/${id}/load`, "POST");
      setValue("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function reload(id: number) {
    await api(`/competitors/${id}/load`, "POST");
    refresh();
  }

  async function remove(id: number) {
    await api(`/competitors/${id}`, "DELETE");
    refresh();
  }

  const [hours, setHours] = useState(0);
  useEffect(() => {
    api("/refresh").then((d) => setHours(d.hours)).catch(() => {});
  }, []);

  async function changeHours(h: number) {
    setHours(h);
    await api("/refresh", "PUT", { hours: h });
  }

  return (
    <>
      <div className="card item">
        <div>
          <h2>Автообновление</h2>
          <p className="muted small-text">
            Само заново загружает 20 рилсов конкурентов. Работает, пока включены компьютер и приложение. Каждая загрузка тратит кредит Apify.
          </p>
        </div>
        <select className="select" value={hours} onChange={(e) => changeHours(Number(e.target.value))}>
          <option value={0}>Выключено</option>
          <option value={6}>Каждые 6 часов</option>
          <option value={12}>Каждые 12 часов</option>
          <option value={24}>Раз в сутки</option>
        </select>
      </div>

      <div className="card">
        <h2>Добавить аккаунт</h2>
        <p className="muted" style={{ marginBottom: 18 }}>Возьмём 20 последних рилсов.</p>
        <form className="row" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input
            className="input"
            placeholder="Instagram аккаунт или URL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn" disabled={busy || !value.trim()}>Загрузить 20 рилсов</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      {list.map((c) => (
        <div className="card item" key={c.id}>
          <div>
            <strong>@{c.handle}</strong>
            <div className="muted" style={{ marginTop: 4, fontSize: 14 }}>
              {c.status === "loading" && "Загружаю рилсы, это займёт до пары минут…"}
              {c.status === "done" && `Рилсов в базе: ${c.reels}`}
              {c.status === "idle" && "Ещё не загружали"}
              {c.status === "error" && <span className="error">{c.error}</span>}
            </div>
          </div>
          <div className="row">
            <button className="btn light" disabled={c.status === "loading"} onClick={() => reload(c.id)}>
              Обновить
            </button>
            <button className="btn light" onClick={() => remove(c.id)}>Удалить</button>
          </div>
        </div>
      ))}
    </>
  );
}
