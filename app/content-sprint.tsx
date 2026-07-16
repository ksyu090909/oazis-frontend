"use client";
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Video = {
  n: number; theme: string; author: string; pub_date: string | null;
  script: boolean; shot: boolean; edit: boolean; publish: boolean; script_text: string;
};

const START = new Date("2026-07-15T00:00:00");
const DEADLINE = new Date("2026-08-31T23:59:59");

function Bar({ value, total, tone = "brand" }: { value: number; total: number; tone?: "brand" | "success" }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ height: 6, background: "var(--surface-2)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, borderRadius: "var(--r-pill)",
        background: tone === "success" ? "var(--success)" : "var(--brand)", transition: "width var(--dur) var(--ease-out)" }} />
    </div>
  );
}

function Kpi({ label, value, total, tone = "brand" }: { label: string; value: number; total: number; tone?: "brand" | "success" }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "16px 18px", boxShadow: "var(--shadow-xs)" }}>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1, marginBottom: 10 }}>
        {value}<span style={{ fontSize: 16, color: "var(--muted)", fontWeight: 500 }}> / {total}</span>
      </div>
      <Bar value={value} total={total} tone={tone} />
    </div>
  );
}

function Check({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <input type="checkbox" checked={on} onChange={onToggle}
    style={{ width: 18, height: 18, accentColor: "var(--brand)", cursor: "pointer", verticalAlign: "middle" }} />;
}

export function ContentSprint() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState<Date | null>(null);
  const [tab, setTab] = useState<"pipeline" | "scripts">("pipeline");
  const [selN, setSelN] = useState<number | null>(null);
  useEffect(() => { setNow(new Date()); }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("content_videos").select("*").order("n");
      if (error) { setLoading(false); return; }
      setVideos((data || []).map(v => ({ ...v, script_text: v.script_text ?? "" })));
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (selN === null && videos.length) setSelN(videos[0].n); }, [videos, selN]);

  const setLocal = (n: number, changes: Partial<Video>) =>
    setVideos(prev => prev.map(v => (v.n === n ? { ...v, ...changes } : v)));
  const persist = (n: number, changes: Partial<Video>) => {
    supabase.from("content_videos").update(changes).eq("n", n).then(() => {});
  };
  const save = (n: number, changes: Partial<Video>) => { setLocal(n, changes); persist(n, changes); };

  const addVideo = async () => {
    const nextN = videos.reduce((m, v) => Math.max(m, v.n), 0) + 1;
    const row: Video = { n: nextN, theme: "", author: "Ксения", pub_date: null, script: false, shot: false, edit: false, publish: false, script_text: "" };
    setVideos(prev => [...prev, row]);
    setSelN(nextN);
    await supabase.from("content_videos").insert({ n: nextN, theme: "", author: "Ксения" });
  };

  const removeVideo = async (n: number) => {
    if (!confirm("Удалить этот ролик вместе со сценарием?")) return;
    setVideos(prev => prev.filter(v => v.n !== n));
    if (selN === n) setSelN(null);
    await supabase.from("content_videos").delete().eq("n", n);
  };

  const total = videos.length;
  const c = (f: keyof Video) => videos.filter(v => v[f]).length;
  const stats = useMemo(() => {
    const script = c("script"), shot = c("shot"), edit = c("edit"), pub = c("publish");
    const kTot = videos.filter(v => v.author === "Ксения").length;
    const yTot = videos.filter(v => v.author === "Юля").length;
    const kScr = videos.filter(v => v.author === "Ксения" && v.script).length;
    const yScr = videos.filter(v => v.author === "Юля" && v.script).length;
    return { script, shot, edit, pub, kTot, yTot, kScr, yScr };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos]);

  const daysLeft = now ? Math.max(0, Math.ceil((DEADLINE.getTime() - now.getTime()) / 86400000)) : null;
  const behind = useMemo(() => {
    if (!now || !total) return false;
    const totalDays = (DEADLINE.getTime() - START.getTime()) / 86400000;
    const elapsed = Math.min(Math.max((now.getTime() - START.getTime()) / 86400000, 0), totalDays);
    return stats.pub < Math.round((elapsed / totalDays) * total);
  }, [now, stats.pub, total]);

  const th: React.CSSProperties = { background: "var(--surface-2)", color: "var(--muted)", textTransform: "uppercase", fontSize: 10.5, letterSpacing: "0.5px", fontWeight: 600, textAlign: "left", padding: "10px 10px", borderBottom: "1px solid var(--border)" };
  const thc: React.CSSProperties = { ...th, textAlign: "center", width: 66 };
  const td: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid var(--border)", fontSize: 13.5, verticalAlign: "middle" };
  const tdc: React.CSSProperties = { ...td, textAlign: "center" };
  const inlineInput: React.CSSProperties = { width: "100%", border: "1px solid transparent", background: "transparent", borderRadius: "var(--r-sm)", padding: "6px 8px", fontSize: 13.5, fontFamily: "inherit", color: "var(--ink)" };
  const ghostBtn: React.CSSProperties = { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };

  const TeamCard = ({ initial, name, role, task, metrics }: { initial: string; name: string; role: string; task: string; metrics: { label: string; value: number; total: number; tone?: "brand" | "success" }[] }) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 18, boxShadow: "var(--shadow-xs)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: "var(--r-pill)", background: "var(--brand-soft)", color: "var(--brand-ink)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 15, flexShrink: 0 }}>{initial}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: "var(--ink)" }}>{name}</div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{role}</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12 }}>{task}</div>
      {metrics.map(m => (
        <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-2)", width: 78, flexShrink: 0 }}>{m.label}</span>
          <span style={{ flex: 1 }}><Bar value={m.value} total={m.total} tone={m.tone} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", width: 44, textAlign: "right" }}>{m.value} / {m.total}</span>
        </div>
      ))}
    </div>
  );

  const sel = videos.find(v => v.n === selN) || null;
  const tabBtn = (key: "pipeline" | "scripts"): React.CSSProperties => ({
    padding: "9px 16px", fontSize: 13.5, fontWeight: tab === key ? 600 : 500, background: "none", border: "none",
    cursor: "pointer", color: tab === key ? "var(--brand-ink)" : "var(--ink-2)",
    borderBottom: tab === key ? "2px solid var(--brand)" : "2px solid transparent", marginBottom: -1, fontFamily: "inherit",
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600 }}>Контент-спринт</div>
          <h1 style={{ margin: "4px 0 2px", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>{total} видео за спринт</h1>
          <div style={{ color: "var(--muted)", fontSize: 14 }}>15 июля – 31 августа 2026 · витрина роста людей</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: behind ? "var(--warn)" : "var(--brand)" }}>{daysLeft ?? "—"}</div>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>дней до дедлайна</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
        <button style={tabBtn("pipeline")} onClick={() => setTab("pipeline")}>Пайплайн</button>
        <button style={tabBtn("scripts")} onClick={() => setTab("scripts")}>Сценарии</button>
      </div>

      {loading ? (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Загрузка…</div>
      ) : tab === "pipeline" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            <Kpi label="Опубликовано" value={stats.pub} total={total} tone="success" />
            <Kpi label="Сценарии" value={stats.script} total={total} />
            <Kpi label="Снято" value={stats.shot} total={total} />
            <Kpi label="Монтаж" value={stats.edit} total={total} />
          </div>

          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, margin: "0 2px 12px" }}>Команда и ответственность</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
            <TeamCard initial="К" name="Ксения" role="руководитель · автор" task="Участие в контенте + написание сценариев." metrics={[{ label: "Сценарии", value: stats.kScr, total: stats.kTot }]} />
            <TeamCard initial="Ю" name="Юля" role="HR-менеджер" task="Публикация технически вовремя + сценарии." metrics={[{ label: "Сценарии", value: stats.yScr, total: stats.yTot }, { label: "Публикации", value: stats.pub, total, tone: "success" }]} />
            <TeamCard initial="Е" name="Ева" role="офис-менеджер · оператор" task="Съёмка и монтаж всех роликов." metrics={[{ label: "Снято", value: stats.shot, total }, { label: "Монтаж", value: stats.edit, total }]} />
          </div>

          <div style={{ fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontWeight: 600, margin: "0 2px 12px" }}>Пайплайн роликов</div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 34, textAlign: "center" }}>№</th>
                  <th style={th}>Тема ролика</th>
                  <th style={th}>Автор</th>
                  <th style={thc}>Сценарий</th>
                  <th style={thc}>Снято</th>
                  <th style={thc}>Монтаж</th>
                  <th style={thc}>Опубл.</th>
                  <th style={th}>Дата</th>
                  <th style={{ ...th, width: 34 }}></th>
                </tr>
              </thead>
              <tbody>
                {videos.map(v => (
                  <tr key={v.n} style={{ opacity: v.publish ? 0.6 : 1 }}>
                    <td style={{ ...tdc, color: "var(--muted)" }}>{v.n}</td>
                    <td style={td}>
                      <input value={v.theme} placeholder="Название темы…"
                        onChange={e => setLocal(v.n, { theme: e.target.value })}
                        onBlur={e => persist(v.n, { theme: e.target.value.trim() })}
                        style={{ ...inlineInput, minWidth: 200 }} />
                    </td>
                    <td style={td}>
                      <select value={v.author} onChange={e => save(v.n, { author: e.target.value })}
                        style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "5px 8px", fontSize: 12.5, fontFamily: "inherit" }}>
                        <option value="Ксения">Ксения</option>
                        <option value="Юля">Юля</option>
                      </select>
                    </td>
                    <td style={tdc}><Check on={v.script} onToggle={() => save(v.n, { script: !v.script })} /></td>
                    <td style={tdc}><Check on={v.shot} onToggle={() => save(v.n, { shot: !v.shot })} /></td>
                    <td style={tdc}><Check on={v.edit} onToggle={() => save(v.n, { edit: !v.edit })} /></td>
                    <td style={tdc}><Check on={v.publish} onToggle={() => save(v.n, { publish: !v.publish })} /></td>
                    <td style={td}>
                      <input type="date" value={v.pub_date ?? ""} onChange={e => save(v.n, { pub_date: e.target.value })}
                        style={{ background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "5px 7px", fontSize: 12, fontFamily: "inherit" }} />
                    </td>
                    <td style={tdc}>
                      <button onClick={() => removeVideo(v.n)} title="Удалить ролик"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 17, lineHeight: 1, padding: 2 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 14 }}>
            <button onClick={addVideo} style={ghostBtn}>＋ Добавить ролик</button>
          </div>

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", color: "var(--muted)", fontSize: 12.5, margin: "16px 2px 0" }}>
            <span><b style={{ color: "var(--ink-2)" }}>Сценарий</b> → Ксения / Юля</span>
            <span><b style={{ color: "var(--ink-2)" }}>Снято + Монтаж</b> → Ева</span>
            <span><b style={{ color: "var(--ink-2)" }}>Опубликовано</b> → Юля (в срок)</span>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", boxShadow: "var(--shadow-xs)", maxHeight: 640, overflowY: "auto" }}>
            {videos.map(v => {
              const active = v.n === selN;
              const hasText = (v.script_text || "").trim().length > 0;
              return (
                <button key={v.n} onClick={() => setSelN(v.n)}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", background: active ? "var(--brand-soft)" : "transparent", fontFamily: "inherit" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)", width: 20, flexShrink: 0 }}>{v.n}</span>
                  <span style={{ flex: 1, fontSize: 13, color: active ? "var(--brand-ink)" : "var(--ink)", fontWeight: active ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.theme || "Без названия"}</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: hasText ? "var(--success)" : "var(--border-strong)" }} title={hasText ? "Сценарий написан" : "Пусто"} />
                </button>
              );
            })}
            {videos.length === 0 && <div style={{ padding: 16, color: "var(--muted)", fontSize: 13 }}>Нет роликов</div>}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 20, boxShadow: "var(--shadow-xs)", minHeight: 520 }}>
            {sel ? (
              <>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>Ролик {sel.n} · автор {sel.author}</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>{sel.theme || "Без названия"}</div>
                <textarea
                  value={sel.script_text}
                  onChange={e => setLocal(sel.n, { script_text: e.target.value })}
                  onBlur={e => persist(sel.n, { script_text: e.target.value })}
                  placeholder="Здесь пишем сценарий ролика: хук, раскадровка, текст на экран, закадр, звук, CTA…"
                  style={{ width: "100%", minHeight: 420, resize: "vertical", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "14px 16px", fontSize: 14.5, lineHeight: 1.7, fontFamily: "inherit", color: "var(--ink)", background: "var(--surface)" }} />
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>Сохраняется автоматически, когда кликаешь вне поля.</div>
              </>
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>Выбери ролик слева, чтобы написать сценарий.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
