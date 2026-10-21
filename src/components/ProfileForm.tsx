"use client";

import { useEffect, useState } from "react";

export default function ProfileForm() {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => { setText(d.profile); setLoaded(true); })
      .catch(() => setState("error"));
  }, []);

  async function save() {
    setState("saving");
    try {
      const r = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: text }),
      });
      setState(r.ok ? "saved" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="card">
      <h2>Кто ты и для кого снимаешь</h2>
      <p className="muted small-text" style={{ marginBottom: 16 }}>
        Ниша, аудитория, тон, о чём твои ролики, чем ты отличаешься. Чем конкретнее, тем лучше сценарии.
      </p>
      <textarea
        className="textarea"
        rows={9}
        disabled={!loaded}
        value={text}
        onChange={(e) => { setText(e.target.value); setState(""); }}
        placeholder="Например: я фитнес-тренер, снимаю для женщин 25–40, которые занимаются дома. Говорю просто и с юмором, без занудства. Ролики про привычки, питание и тренировки без инвентаря."
      />
      <div className="row" style={{ marginTop: 14, alignItems: "center" }}>
        <button className="btn" disabled={!loaded || state === "saving"} onClick={save}>Сохранить</button>
        {state === "saved" && <span className="muted small-text">Сохранено</span>}
        {state === "error" && <span className="error" style={{ margin: 0 }}>Не удалось сохранить</span>}
      </div>
    </div>
  );
}
