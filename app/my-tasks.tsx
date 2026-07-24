"use client";
import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SprintTask = {
  id: number; title: string; criterion: string; is_done: boolean;
  deadline: string | null; carried_over: boolean; carry_pending: boolean;
};
type SprintData = { goal: string; month: string; done: number; total: number; tasks: SprintTask[] };

export function MyTasksSection() {
  const [data, setData] = useState<SprintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () => {
    fetch(`${API}/api/sprint-tasks/`).then(r => r.json())
      .then((d: SprintData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const patch = async (id: number, body: Record<string, unknown>) => {
    setBusy(id);
    await fetch(`${API}/api/sprint-tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    load();
  };

  const carry = async (id: number) => {
    setBusy(id);
    const r = await fetch(`${API}/api/sprint-tasks/${id}/carry`, { method: "POST" });
    const res = await r.json();
    setBusy(null);
    if (res.pending) alert("Вкладка следующего месяца ещё не создана — задача в очереди на перенос.");
    load();
  };

  const sync = async () => {
    setLoading(true);
    await fetch(`${API}/api/sprint-tasks/sync`, { method: "POST" });
    load();
  };

  if (loading) return <div style={{ padding: 24, color: "#6b7280" }}>Загрузка…</div>;
  if (!data || data.tasks.length === 0)
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "#6b7280" }}>Задач пока нет.</p>
        <button onClick={sync} style={btnStyle}>Обновить из таблицы</button>
      </div>
    );

  const pct = data.total ? Math.round((data.done / data.total) * 100) : 0;

  return (
    <div style={{ padding: 24, maxWidth: 820 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>Мои задачи</h2>
        <button onClick={sync} style={btnStyle}>Обновить</button>
      </div>

      {/* Приоритет от СЕО — цель спринта, закреплена сверху */}
      {data.goal && (
        <div style={{ background: "var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Цель спринта · {data.month}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{data.goal}</div>
          <div style={{ marginTop: 10, height: 6, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#1A6B52" }} />
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{data.done} из {data.total} готово</div>
        </div>
      )}

      {/* Блок задач спринта */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.tasks.map(t => (
          <div key={t.id} style={{
            border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px",
            opacity: busy === t.id ? 0.5 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <input type="checkbox" checked={t.is_done}
                     onChange={e => patch(t.id, { is_done: e.target.checked })}
                     style={{ marginTop: 3, width: 18, height: 18, cursor: "pointer" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--ink)",
                              textDecoration: t.is_done ? "line-through" : "none" }}>{t.title}</div>
                <textarea defaultValue={t.criterion} placeholder="Итог…"
                          onBlur={e => { if (e.target.value !== (t.criterion || "")) patch(t.id, { criterion: e.target.value }); }}
                          style={{ width: "100%", marginTop: 6, border: "1px solid var(--border)",
                                   borderRadius: 6, padding: "6px 8px", fontSize: 13, resize: "vertical", minHeight: 34 }} />
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 6 }}>
                  <input type="date" defaultValue={t.deadline || ""}
                         onBlur={e => { if (e.target.value !== (t.deadline || "")) patch(t.id, { deadline: e.target.value }); }}
                         style={{ border: "1px solid var(--border)", borderRadius: 6, padding: "4px 6px", fontSize: 12 }} />
                  <button onClick={() => carry(t.id)} disabled={t.carried_over}
                          style={{ ...btnStyle, fontSize: 12, opacity: t.carried_over ? 0.5 : 1 }}>
                    {t.carried_over ? "перенесена" : t.carry_pending ? "в очереди →" : "→ след. спринт"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px",
  background: "var(--card)", color: "var(--ink)", cursor: "pointer", fontSize: 13,
};
