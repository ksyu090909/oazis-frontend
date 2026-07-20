"use client";
import React, { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type CeoItem = {
  id: number;
  meeting_id: number;
  title: string;
  status: string;
  comment: string;
  task_id: number | null;
  task_title: string | null;
  task_deadline: string | null;
  task_is_done: boolean | null;
  origin_date: string | null;
  sort_order: number;
};

type CeoMeeting = {
  id: number;
  meeting_date: string;
  notes: string;
  is_completed: boolean;
  items: CeoItem[];
  counts: { discuss: number; in_progress: number; done: number; stopped: number };
  // Пункты, которые были в этой повестке, но уехали на более позднюю планёрку
  carried_away?: (CeoItem & { moved_to: string })[];
};

const STATUS_META: Record<string, { label: string; bg: string; ink: string; border: string }> = {
  discuss:     { label: "Обсудить",  bg: "var(--info-soft)",    ink: "var(--info-ink)",    border: "var(--info-border)" },
  in_progress: { label: "В работе",  bg: "var(--warn-soft)",    ink: "var(--warn-ink)",    border: "var(--warn-border)" },
  done:        { label: "Готово",    bg: "var(--success-soft)", ink: "var(--success-ink)", border: "var(--success-border)" },
  stopped:     { label: "На стопе",  bg: "var(--surface-2)",    ink: "var(--muted)",       border: "var(--border-strong)" },
};
const STATUS_ORDER = ["discuss", "in_progress", "done", "stopped"];

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) {
  return new Date(iso + "T00:00:00").toLocaleDateString("ru-RU", opts);
}

// Ближайший понедельник: сегодня, если понедельник, иначе следующий
function defaultMeetingDate(): string {
  const d = new Date();
  const shift = (8 - d.getDay()) % 7; // getDay(): 1 = понедельник
  d.setDate(d.getDate() + shift);
  return d.toISOString().slice(0, 10);
}

function weekNumber(item: CeoItem, meetingDate: string): number {
  if (!item.origin_date || item.origin_date >= meetingDate) return 1;
  const ms = new Date(meetingDate).getTime() - new Date(item.origin_date).getTime();
  return Math.round(ms / (7 * 24 * 3600 * 1000)) + 1;
}

function StatusChip({ status, active, onClick }: { status: string; active?: boolean; onClick?: () => void }) {
  const m = STATUS_META[status];
  return (
    <span onClick={onClick} style={{
      display: "inline-block", padding: "2px 10px", borderRadius: "var(--r-pill)",
      fontSize: 11, fontWeight: 600, background: m.bg, color: m.ink,
      border: `1px solid ${m.border}`, cursor: onClick ? "pointer" : "default",
      opacity: onClick && !active ? 0.45 : 1,
      boxShadow: onClick && active ? "0 0 0 2px var(--brand-ring)" : "none",
      transition: "opacity var(--dur) var(--ease-out)",
    }}>{m.label}</span>
  );
}

const btnBase: React.CSSProperties = {
  border: "1px solid var(--border-strong)", color: "var(--ink-2)", background: "var(--surface)",
  borderRadius: "var(--r-sm)", padding: "6px 14px", fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "inherit",
};

export function CeoReportSection() {
  const [meetings, setMeetings] = useState<CeoMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openItemId, setOpenItemId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [itemDraft, setItemDraft] = useState<{ title: string; comment: string }>({ title: "", comment: "" });
  const [newItemTitle, setNewItemTitle] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = async (keepSelection = true) => {
    const res = await fetch(`${API}/api/ceo/meetings`);
    const data: CeoMeeting[] = await res.json();
    setMeetings(data);
    setLoading(false);
    if (!keepSelection || selectedId === null || !data.some(m => m.id === selectedId)) {
      setSelectedId(data[0]?.id ?? null);
      setNotesDraft(data[0]?.notes ?? "");
    }
  };
  useEffect(() => { load(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = meetings.find(m => m.id === selectedId) || null;

  const selectMeeting = (m: CeoMeeting) => {
    setSelectedId(m.id);
    setNotesDraft(m.notes);
    setOpenItemId(null);
  };

  const saveNotes = (meetingId: number, notes: string) => {
    setNotesDraft(notes);
    setMeetings(prev => prev.map(m => (m.id === meetingId ? { ...m, notes } : m)));
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      fetch(`${API}/api/ceo/meetings/${meetingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
    }, 800);
  };

  const createMeeting = async () => {
    const d = window.prompt("Дата планёрки (ГГГГ-ММ-ДД):", defaultMeetingDate());
    if (!d) return;
    const res = await fetch(`${API}/api/ceo/meetings`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_date: d }),
    });
    if (res.status === 409) { alert("Планёрка на эту дату уже есть"); return; }
    const created = await res.json();
    await load(false);
    setSelectedId(created.id);
  };

  const completeMeeting = async (m: CeoMeeting) => {
    const open = m.items.filter(i => i.status !== "done").length;
    if (!window.confirm(
      `Завершить планёрку ${fmtDate(m.meeting_date)}?\n\n` +
      `Незакрытых пунктов: ${open} — они переедут в следующую планёрку.\n` +
      `Готовые останутся зафиксированными здесь.`
    )) return;
    const res = await fetch(`${API}/api/ceo/meetings/${m.id}/complete`, { method: "POST" });
    const body = await res.json();
    await load(false);
    if (body.next_meeting_id) setSelectedId(body.next_meeting_id);
  };

  const deleteMeeting = async (m: CeoMeeting) => {
    if (!window.confirm(`Удалить планёрку ${fmtDate(m.meeting_date)} со всеми пунктами?`)) return;
    await fetch(`${API}/api/ceo/meetings/${m.id}`, { method: "DELETE" });
    await load(false);
  };

  const openItem = (i: CeoItem) => {
    setOpenItemId(i.id);
    setItemDraft({ title: i.title, comment: i.comment });
  };

  const patchItem = async (itemId: number, changes: Record<string, unknown>) => {
    await fetch(`${API}/api/ceo/items/${itemId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    await load();
  };

  const addItem = async () => {
    if (!newItemTitle.trim() || !selected) return;
    await fetch(`${API}/api/ceo/meetings/${selected.id}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newItemTitle.trim() }),
    });
    setNewItemTitle("");
    await load();
  };

  const deleteItem = async (i: CeoItem) => {
    if (!window.confirm(`Удалить пункт «${i.title}»?`)) return;
    await fetch(`${API}/api/ceo/items/${i.id}`, { method: "DELETE" });
    setOpenItemId(null);
    await load();
  };

  const carryItem = async (i: CeoItem) => {
    const res = await fetch(`${API}/api/ceo/items/${i.id}/carry`, { method: "POST" });
    if (res.status === 404) {
      alert("Будущей планёрки ещё нет — создай её кнопкой «+ Новая планёрка», незакрытые пункты перенесутся автоматически.");
      return;
    }
    await load();
  };

  const createTask = async (i: CeoItem) => {
    const res = await fetch(`${API}/api/ceo/items/${i.id}/create_task`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    });
    if (res.status === 409) { alert("Задача уже привязана"); return; }
    await load();
  };

  const moveItem = async (i: CeoItem, dir: -1 | 1) => {
    if (!selected) return;
    const list = selected.items;
    const idx = list.findIndex(x => x.id === i.id);
    const swap = list[idx + dir];
    if (!swap) return;
    await fetch(`${API}/api/ceo/items/${i.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort_order: swap.sort_order }),
    });
    await fetch(`${API}/api/ceo/items/${swap.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort_order: i.sort_order }),
    });
    await load();
  };

  if (loading) return <div style={{ color: "var(--muted)", padding: 24 }}>Загрузка…</div>;

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      {/* Лента планёрок */}
      <div style={{ width: 230, flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase",
          letterSpacing: "0.6px", fontWeight: 600, marginBottom: 10 }}>Планёрки</div>
        {meetings.map(m => {
          const active = m.id === selectedId;
          const c = m.counts;
          const summary = [c.discuss ? `${c.discuss} обсудить` : "", c.in_progress ? `${c.in_progress} в работе` : "",
               c.done ? `${c.done} готово` : "", c.stopped ? `${c.stopped} на стопе` : ""]
                .filter(Boolean).join(" · ") || "пусто";
          return (
            <div key={m.id} onClick={() => selectMeeting(m)} style={{
              background: active ? "var(--brand)" : "var(--surface)",
              color: active ? "#fff" : "var(--ink)",
              border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
              borderRadius: "var(--r-sm)", padding: "9px 12px", marginBottom: 8,
              cursor: "pointer", boxShadow: "var(--shadow-xs)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Пн {fmtDate(m.meeting_date)}</div>
              <div style={{ fontSize: 11, marginTop: 2, color: active ? "rgba(255,255,255,0.8)" : "var(--muted)" }}>
                {summary}
              </div>
            </div>
          );
        })}
        <button onClick={createMeeting} style={{ ...btnBase, width: "100%",
          borderStyle: "dashed", color: "var(--brand-ink)" }}>+ Новая планёрка</button>
      </div>

      {/* Выбранная планёрка */}
      {selected ? (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 650, color: "var(--ink)" }}>
              Планёрка {fmtDate(selected.meeting_date, { day: "numeric", month: "long", year: "numeric" })}
              <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                готово {selected.counts.done} / {selected.items.length}
              </span>
            </h2>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {selected.is_completed ? (
                <span style={{ ...btnBase, cursor: "default", background: "var(--success-soft)",
                  borderColor: "var(--success-border)", color: "var(--success-ink)" }}>Планёрка проведена</span>
              ) : (
                <button onClick={() => completeMeeting(selected)} style={{ ...btnBase,
                  background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }}>
                  Планёрка завершена</button>
              )}
              <button onClick={() => deleteMeeting(selected)} style={{ ...btnBase,
                borderColor: "var(--danger-border)", color: "var(--danger-ink)" }}>Удалить планёрку</button>
            </div>
          </div>

          {/* Конспект */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)",
              textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 5 }}>Конспект встречи</div>
            <textarea value={notesDraft} onChange={e => saveNotes(selected.id, e.target.value)}
              placeholder="Заметки по ходу планёрки — сохраняются автоматически"
              style={{ width: "100%", minHeight: 88, resize: "vertical",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--r-sm)", padding: "10px 12px", fontSize: 13,
                color: "var(--ink)", fontFamily: "inherit", boxSizing: "border-box" }} />
          </div>

          {/* Пункты */}
          {selected.items.map((i, idx) => {
            const wn = weekNumber(i, selected.meeting_date);
            if (i.id !== openItemId) {
              return (
                <div key={i.id} onClick={() => openItem(i)} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)", padding: "11px 14px", marginBottom: 10,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 12, cursor: "pointer", boxShadow: "var(--shadow-xs)",
                }}>
                  <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{i.title}</span>
                  <StatusChip status={i.status} />
                </div>
              );
            }
            return (
              <div key={i.id} style={{ background: "var(--surface)",
                border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)",
                padding: 16, marginBottom: 10, boxShadow: "var(--shadow-md)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input value={itemDraft.title}
                    onChange={e => setItemDraft(d => ({ ...d, title: e.target.value }))}
                    style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--ink)",
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--r-xs)", padding: "6px 10px", fontFamily: "inherit" }} />
                  <button onClick={() => moveItem(i, -1)} disabled={idx === 0}
                    style={{ ...btnBase, padding: "6px 9px", opacity: idx === 0 ? 0.4 : 1 }}>↑</button>
                  <button onClick={() => moveItem(i, 1)} disabled={idx === selected.items.length - 1}
                    style={{ ...btnBase, padding: "6px 9px", opacity: idx === selected.items.length - 1 ? 0.4 : 1 }}>↓</button>
                  <button onClick={() => setOpenItemId(null)} style={{ ...btnBase, padding: "6px 9px" }}>✕</button>
                </div>

                {wn > 1 && i.origin_date && (
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
                    Тянется с планёрки {fmtDate(i.origin_date)} · {wn}-я неделя
                  </div>
                )}

                <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em", margin: "14px 0 6px" }}>Статус</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {STATUS_ORDER.map(s => (
                    <StatusChip key={s} status={s} active={i.status === s}
                      onClick={() => patchItem(i.id, { status: s })} />
                  ))}
                </div>

                <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)",
                  textTransform: "uppercase", letterSpacing: "0.04em", margin: "14px 0 6px" }}>
                  Комментарий — что сказать СЕО</div>
                <textarea value={itemDraft.comment}
                  onChange={e => setItemDraft(d => ({ ...d, comment: e.target.value }))}
                  style={{ width: "100%", minHeight: 60, resize: "vertical",
                    background: "var(--bg)", border: "1px solid var(--border)",
                    borderRadius: "var(--r-sm)", padding: "8px 11px", fontSize: 12.5,
                    color: "var(--ink-2)", fontFamily: "inherit", boxSizing: "border-box" }} />

                {i.task_id && (
                  <>
                    <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)",
                      textTransform: "uppercase", letterSpacing: "0.04em", margin: "14px 0 6px" }}>
                      Связанная задача в планере</div>
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)",
                      borderRadius: "var(--r-sm)", padding: "8px 11px", fontSize: 12.5,
                      display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: "var(--ink-2)" }}>
                        «{i.task_title}»{i.task_deadline ? ` — дедлайн ${fmtDate(i.task_deadline)}` : ""}
                      </span>
                      <span style={{ color: i.task_is_done ? "var(--success-ink)" : "var(--muted)",
                        fontWeight: 600, whiteSpace: "nowrap" }}>
                        {i.task_is_done ? "закрыта ✓" : "в планере"}
                      </span>
                    </div>
                  </>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                  <button onClick={() => patchItem(i.id, { title: itemDraft.title, comment: itemDraft.comment })}
                    style={{ ...btnBase, background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }}>
                    Сохранить</button>
                  {!i.task_id && (
                    <button onClick={() => createTask(i)} style={{ ...btnBase,
                      background: "var(--brand-soft)", borderColor: "var(--brand)", color: "var(--brand-ink)" }}>
                      Создать задачу к понедельнику</button>
                  )}
                  <button onClick={() => carryItem(i)} style={btnBase}>Перенести на след. планёрку</button>
                  <button onClick={() => deleteItem(i)} style={{ ...btnBase,
                    borderColor: "var(--danger-border)", color: "var(--danger-ink)" }}>Удалить</button>
                </div>
              </div>
            );
          })}

          {/* Уехавшие дальше — были в этой повестке, ведутся в более поздней планёрке */}
          {!!selected.carried_away?.length && (
            <div style={{ marginTop: 18, marginBottom: 14, opacity: 0.55 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--muted)",
                textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Перенесено на следующие планёрки
              </div>
              {selected.carried_away.map(i => (
                <div key={i.id} style={{
                  background: "var(--surface)", border: "1px dashed var(--border)",
                  borderRadius: "var(--r-md)", padding: "9px 14px", marginBottom: 8,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{i.title}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>→ {fmtDate(i.moved_to)}</span>
                    <StatusChip status={i.status} />
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Добавление пункта */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addItem(); }}
              placeholder="+ Добавить пункт и нажать Enter"
              style={{ flex: 1, background: "var(--surface)", border: "1px dashed var(--border-strong)",
                borderRadius: "var(--r-sm)", padding: "9px 12px", fontSize: 13,
                color: "var(--ink)", fontFamily: "inherit" }} />
            <button onClick={addItem} style={btnBase}>Добавить</button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, color: "var(--muted)", padding: 24 }}>
          Планёрок ещё нет — создай первую кнопкой «+ Новая планёрка».
        </div>
      )}
    </div>
  );
}
