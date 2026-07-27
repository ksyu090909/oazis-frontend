"use client";
import React, { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SprintTask = {
  id: number; title: string; criterion: string; is_done: boolean;
  deadline: string | null; carried_over: boolean; carry_pending: boolean; block: number;
};
type SprintData = {
  goal: string; month: string; done: number; total: number; blocks: number; tasks: SprintTask[];
};

const MONTHS_NOM = ["январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
function monthLabel(m: string): string {
  const [y, mm] = (m || "").split("-");
  const idx = Number(mm) - 1;
  return idx >= 0 && idx < 12 ? `${MONTHS_NOM[idx]} ${y}` : m;
}

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

  const sync = async () => { setLoading(true); await fetch(`${API}/api/sprint-tasks/sync`, { method: "POST" }); load(); };

  if (loading) return <div style={{ padding: 24, color: "var(--muted)" }}>Загрузка…</div>;
  if (!data || data.tasks.length === 0)
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--muted)" }}>Задач пока нет.</p>
        <button onClick={sync} style={btn}>Обновить из таблицы</button>
      </div>
    );

  const pct = data.total ? Math.round((data.done / data.total) * 100) : 0;

  // Группируем задачи по неделям-блокам (порядок сохранён — задачи приходят по строкам).
  const groups: SprintTask[][] = [];
  data.tasks.forEach(t => { (groups[t.block] ||= []).push(t); });

  return (
    <div style={{ padding: 24, maxWidth: 940 }}>
      {/* Шапка отчёта */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>Мои задачи</h2>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
            Отчёт к планёрке с СЕО · {monthLabel(data.month)}
          </div>
        </div>
        <button onClick={sync} style={btn}>Обновить</button>
      </div>

      {/* Цель спринта + прогресс */}
      {data.goal && (
        <div style={{
          display: "flex", alignItems: "center", gap: 20,
          background: "var(--success-soft)", border: "1px solid var(--success-border)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 22,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, color: "var(--success-ink)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>Цель спринта</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{data.goal}</div>
          </div>
          <div style={{ textAlign: "right", minWidth: 130 }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: "var(--success-ink)", lineHeight: 1 }}>
              {data.done}<span style={{ color: "var(--muted)", fontSize: 15, fontWeight: 500 }}> / {data.total}</span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 3 }}>задач готово</div>
            <div style={{ height: 5, background: "var(--success-border)", borderRadius: 3, marginTop: 7, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--success)" }} />
            </div>
          </div>
        </div>
      )}

      {/* Недельные блоки */}
      {groups.map((tasks, gi) => (
        <div key={gi} style={{ marginBottom: 22 }}>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 10, margin: "0 0 8px 2px",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {groups.length > 1 ? `Неделя ${gi + 1}` : "Задачи спринта"}
            </span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>
              {tasks.filter(t => t.is_done).length} из {tasks.length} готово
            </span>
          </div>

          <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col style={{ width: "32%" }} />
                <col />
                <col style={{ width: 116 }} />
                <col style={{ width: 104 }} />
              </colgroup>
              <thead>
                <tr style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "left", background: "var(--bg)" }}>
                  <th style={{ padding: "8px 6px 8px 16px", fontWeight: 500 }}></th>
                  <th style={{ padding: "8px 8px", fontWeight: 500 }}>Задача</th>
                  <th style={{ padding: "8px 8px", fontWeight: 500 }}>Итог / критерий</th>
                  <th style={{ padding: "8px 8px", fontWeight: 500 }}>Дедлайн</th>
                  <th style={{ padding: "8px 16px 8px 8px", fontWeight: 500 }}></th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} style={{ borderTop: "1px solid var(--border)", opacity: busy === t.id ? 0.5 : 1 }}>
                    <td style={{ padding: "12px 6px 12px 16px", verticalAlign: "top" }}>
                      <button onClick={() => patch(t.id, { is_done: !t.is_done })}
                        aria-label={t.is_done ? "Снять отметку" : "Отметить готовой"}
                        style={{
                          width: 18, height: 18, borderRadius: 5, padding: 0, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          border: t.is_done ? "none" : "1.5px solid var(--border-strong)",
                          background: t.is_done ? "var(--success)" : "transparent",
                          color: "#fff", fontSize: 12, lineHeight: 1,
                        }}>{t.is_done ? "✓" : ""}</button>
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top", fontWeight: t.is_done ? 400 : 500, lineHeight: 1.4, color: t.is_done ? "var(--muted)" : "var(--ink)", textDecoration: t.is_done ? "line-through" : "none", wordBreak: "break-word" }}>
                      {t.title}
                    </td>
                    <td style={{ padding: "8px 8px", verticalAlign: "top" }}>
                      <textarea defaultValue={t.criterion} placeholder="—"
                        onBlur={e => { if (e.target.value !== (t.criterion || "")) patch(t.id, { criterion: e.target.value }); }}
                        rows={1}
                        style={{
                          width: "100%", border: "1px solid transparent", background: "transparent",
                          borderRadius: 6, padding: "4px 6px", fontSize: 13, lineHeight: 1.5,
                          color: "var(--ink-2)", resize: "vertical", minHeight: 30,
                          fontFamily: "inherit", outline: "none",
                        }}
                        onFocus={e => { e.target.style.border = "1px solid var(--border-strong)"; e.target.style.background = "var(--card)"; }}
                        onBlurCapture={e => { e.target.style.border = "1px solid transparent"; e.target.style.background = "transparent"; }} />
                    </td>
                    <td style={{ padding: "12px 8px", verticalAlign: "top" }}>
                      <input type="date" defaultValue={t.deadline || ""}
                        onBlur={e => { if (e.target.value !== (t.deadline || "")) patch(t.id, { deadline: e.target.value }); }}
                        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 6px", fontSize: 12, color: "var(--ink-2)", background: "var(--card)", fontFamily: "inherit" }} />
                    </td>
                    <td style={{ padding: "12px 16px 12px 8px", verticalAlign: "top", textAlign: "right" }}>
                      <button onClick={() => carry(t.id)} disabled={t.carried_over}
                        title="Перенести в следующий спринт"
                        style={{
                          border: "1px solid var(--border)", background: "var(--card)", borderRadius: 6,
                          padding: "4px 9px", fontSize: 12, color: "var(--ink-2)", whiteSpace: "nowrap",
                          cursor: t.carried_over ? "default" : "pointer", opacity: t.carried_over ? 0.55 : 1,
                        }}>
                        {t.carried_over ? "перенесена" : t.carry_pending ? "в очереди" : "→ спринт"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
        Отметка, итог и дедлайн сохраняются прямо в спринт-таблицу. «→ спринт» переносит задачу в следующий месяц.
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  border: "1px solid var(--border-strong)", borderRadius: 8, padding: "7px 13px",
  background: "var(--card)", color: "var(--ink)", cursor: "pointer", fontSize: 13,
};
