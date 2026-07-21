"use client";
import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { ContentSprint } from "./content-sprint";
import { SspSection } from "./ssp-report";
import { CeoReportSection } from "./ceo-report";
import { RepeatSalesPanel, REPEAT_DATA } from "./sales-repeat";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Direction = { id: number; key: string; label: string; color: string; sort_order: number };

// Module-level direction store — updated when Dashboard loads directions
const dirStore: { list: Direction[] } = { list: [] };
function dirLabel(key: string) {
  return dirStore.list.find(d => d.key === key)?.label || key;
}
function dirColor(key: string) {
  return dirStore.list.find(d => d.key === key)?.color || "#6b7280";
}
function dirOrder(): string[] {
  return dirStore.list.length
    ? dirStore.list.map(d => d.key)
    : ["personal", "finance", "sales", "support", "care", "marketing", "instagram", "hr", "other"];
}

const PRESET_COLORS = [
  "#7c3aed","#2563eb","#059669","#d97706","#db2777",
  "#ea580c","#c026d3","#0891b2","var(--danger)","#6b7280",
];

// ── Месяцы ──────────────────────────────────────────────────────────────────
const MONTHS_RU = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
// Текущий месяц по-русски (0 = январь).
function currentMonthRu(): string {
  return MONTHS_RU[new Date().getMonth()];
}
// Список месяцев текущего года от startIdx (0 = январь) до текущего месяца включительно.
// На 1-е число нового месяца новый месяц добавляется автоматически.
function monthsThrough(startIdx = 0): string[] {
  const end = Math.max(new Date().getMonth(), startIdx);
  return MONTHS_RU.slice(startIdx, end + 1);
}

const PRIORITY_OPTIONS = [
  { value: "high", label: "Высокий", color: "var(--danger)" },
  { value: "medium", label: "Средний", color: "var(--warn)" },
  { value: "low", label: "Низкий", color: "var(--success)" },
];

type Task = {
  id: number;
  title: string;
  description?: string;
  direction: string;
  priority: string;
  deadline?: string;
  is_done: boolean;
  repeat: string;
  repeat_days?: string;
  source: string;
  created_at?: string;
  done_at?: string;
  scheduled_time?: string;
  excluded_dates?: string;
  repeat_until?: string;
};

type RiskDeal = {
  client: string;
  broker: string;
  commission: number;
  age_days: number;
  stage: string;
  stage_id: string;
  is_fired: boolean;
  url: string;
};

type DealStage = { id: string; name: string };
type DealCategory = { id: number; name: string; stages: DealStage[] };
type DealsMeta = { categories: DealCategory[] };

type SupportDeal = {
  id: number;
  client: string;
  executor: string;
  status: string;
  age_days: number;
  last_update: string;
  note: string;
  is_risk: boolean;
};

// Заглушка — заменить на fetch из Google Sheets API
const MOCK_SUPPORT_DEALS: SupportDeal[] = [
  { id: 1, client: "Иванов А.В.", executor: "Мария", status: "Оформление ипотеки", age_days: 5, last_update: "2026-06-19", note: "Ждём одобрение банка", is_risk: false },
  { id: 2, client: "Петрова С.И.", executor: "Анна", status: "Сбор документов", age_days: 12, last_update: "2026-06-12", note: "", is_risk: true },
  { id: 3, client: "Сидоров Д.П.", executor: "Мария", status: "Регистрация ДДУ", age_days: 2, last_update: "2026-06-22", note: "Документы переданы в МФЦ", is_risk: false },
  { id: 4, client: "Козлова Е.Н.", executor: "Анна", status: "Подписание договора", age_days: 8, last_update: "2026-06-16", note: "Клиент не выходит на связь", is_risk: true },
  { id: 5, client: "Новиков В.С.", executor: "Олег", status: "Выдача ключей", age_days: 1, last_update: "2026-06-23", note: "", is_risk: false },
];

const NAV_ITEMS = [
  { key: "deals",       label: "Главная",         icon: "⌂"  },
  { key: "ceo",         label: "Отчёт СЕО",       icon: "◈"  },
  { key: "sales",       label: "Отдел продаж",    icon: "↗"  },
  { key: "support",     label: "Сопровождение",   icon: "✓"  },
  { key: "rnp",         label: "Эффективность компании", icon: "📋" },
  { key: "ssp",         label: "ССП 2026",        icon: "◎"  },
  { key: "weekly",      label: "HR",              icon: "📅" },
  { key: "knowledge",   label: "Обучение",        icon: "📖" },
  { key: "content",     label: "Контент",         icon: "🎬" },
  { key: "finance",     label: "Финансы",         icon: "₽"  },
  { key: "motivation",  label: "Мотивация",       icon: "🎯" },
  { key: "brokers",     label: "Расходы компании", icon: "💳" },
  { key: "team",        label: "Команда",         icon: "👥" },
  { key: "legal",       label: "Юр-риски",        icon: "⚖"  },
  { key: "legal_processes", label: "Юр. процессы", icon: "§" },
  { key: "competitors", label: "Рынок",            icon: "⊛"  },
];
const DEPARTMENTS = NAV_ITEMS;

// Единый набор навигационных иконок (line-стиль, наследуют currentColor от состояния)
const NAV_ICON_PATHS: Record<string, React.ReactNode> = {
  deals: (<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /></>),
  ceo: (<><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8 9h8" /><path d="M8 13h5" /><path d="M15.5 15.5l1.5 1.5 3-3" /></>),
  sales: (<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>),
  support: (<><path d="M12 3l7 3v5c0 4.6-3.1 7.7-7 9-3.9-1.3-7-4.4-7-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  rnp: (<><path d="M3 12h4l2.5 7 4-14L16 12h5" /></>),
  ssp: (<><circle cx="12" cy="12" r="8.4" /><path d="M12 3.6v4.2" /><path d="M12 16.2v4.2" /><path d="M3.6 12h4.2" /><path d="M16.2 12h4.2" /><path d="M9.5 12.2l1.8 1.8 3.4-3.6" /></>),
  weekly: (<><circle cx="9" cy="8" r="3.4" /><path d="M3.4 20a5.8 5.8 0 0 1 11.2 0" /><path d="M15.8 12.6l1.7 1.7L21 11" /></>),
  knowledge: (<><path d="M12 6.5C10.5 5.4 8.2 4.8 6 4.8c-1.4 0-2.4.3-3 .5v13c.6-.2 1.6-.5 3-.5 2.2 0 4.5.6 6 1.7 1.5-1.1 3.8-1.7 6-1.7 1.4 0 2.4.3 3 .5v-13c-.6-.2-1.6-.5-3-.5-2.2 0-4.5.6-6 1.7z" /><path d="M12 6.5V19" /></>),
  content: (<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9.5l5 2.8-5 2.8z" /></>),
  finance: (<><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18" /><circle cx="16.5" cy="14.5" r="1.1" /></>),
  motivation: (<><circle cx="12" cy="12" r="8.4" /><circle cx="12" cy="12" r="4.4" /><circle cx="12" cy="12" r="1" /></>),
  brokers: (<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 9.5h18" /><path d="M6.5 14.5h4" /></>),
  team: (<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5a5.6 5.6 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.7" /><path d="M17.6 19.5a5.6 5.6 0 0 0-2.6-4.7" /></>),
  legal: (<><path d="M12 4v16" /><path d="M7 8h10" /><path d="M7 8l-3 6a3 3 0 0 0 6 0z" /><path d="M17 8l3 6a3 3 0 0 1-6 0z" /><path d="M8.5 20h7" /></>),
  legal_processes: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /><path d="M9 12.5h6" /><path d="M9 16h6" /></>),
  competitors: (<><path d="M4 20V10.5" /><path d="M10 20V4" /><path d="M16 20v-6.5" /><path d="M3.5 20h17" /></>),
};

function NavIcon({ k }: { k: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {NAV_ICON_PATHS[k] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

// Переиспользуемая карточка-метрика для сводных показателей
function StatCard({ label, value, hint, tone = "default" }: {
  label: string; value: React.ReactNode; hint?: string; tone?: "default" | "danger";
}) {
  const [hover, setHover] = useState(false);
  const valueColor = tone === "danger" ? "var(--danger)" : "var(--ink)";
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--r-md)", padding: "18px 22px",
        boxShadow: hover ? "var(--shadow-sm)" : "var(--shadow-xs)",
        transition: "box-shadow var(--dur) var(--ease-out)",
      }}
    >
      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.6px", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", color: valueColor, lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

const fmt = (n: number) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(1).replace(".0", "") + " млн"
    : n >= 1_000
    ? (n / 1_000).toFixed(0) + " тыс"
    : String(n);

function fmtDeadline(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

// ── Inline Task Editor ──────────────────────────────────────────────────────
type EditFormProps = {
  initial?: Partial<Task>;
  defaultDirection?: string;
  onSave: (data: Partial<Task>) => Promise<void>;
  onCancel: () => void;
};

const WEEK_DAYS = [
  { key: "MON", label: "Пн" },
  { key: "TUE", label: "Вт" },
  { key: "WED", label: "Ср" },
  { key: "THU", label: "Чт" },
  { key: "FRI", label: "Пт" },
  { key: "SAT", label: "Сб" },
  { key: "SUN", label: "Вс" },
];

function TaskEditForm({ initial = {}, defaultDirection = "personal", onSave, onCancel }: EditFormProps) {
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [direction, setDirection] = useState(initial.direction || defaultDirection);
  const [priority, setPriority] = useState(initial.priority || "medium");
  const [deadline, setDeadline] = useState(initial.deadline || "");
  const [scheduledTime, setScheduledTime] = useState(initial.scheduled_time || "");
  const [repeat, setRepeat] = useState(initial.repeat || "none");
  const [repeatDays, setRepeatDays] = useState<string[]>(
    initial.repeat_days ? initial.repeat_days.split(",").map(s => s.trim()) : []
  );
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);

  const toggleDay = (key: string) => {
    setRepeatDays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      description: description || undefined,
      direction, priority,
      deadline: deadline || undefined,
      scheduled_time: scheduledTime || undefined,
      repeat,
      repeat_days: repeat === "weekly" && repeatDays.length > 0 ? repeatDays.join(",") : undefined,
    });
    setSaving(false);
  };

  const inputStyle = {
    width: "100%", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "6px 10px",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "var(--surface)", color: "var(--ink)", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <input ref={titleRef} value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Название задачи" style={{ ...inputStyle, fontSize: 14, fontWeight: 500 }}
        onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }} />
      <textarea value={description} onChange={e => setDescription(e.target.value)}
        placeholder="Описание (необязательно)" rows={2}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select value={direction} onChange={e => setDirection(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          {dirOrder().map(d => <option key={d} value={d}>{dirLabel(d)}</option>)}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label} приоритет</option>)}
        </select>
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
          style={{ ...inputStyle, width: "auto" }} />
        <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
          placeholder="Время" style={{ ...inputStyle, width: "auto" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { value: "none", label: "Не повторять" },
            { value: "daily", label: "Каждый день" },
            { value: "weekly", label: "Каждую неделю" },
            { value: "monthly", label: "Каждый месяц" },
          ].map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { setRepeat(opt.value); if (opt.value !== "weekly") setRepeatDays([]); }}
              style={{
                padding: "4px 10px", borderRadius: "var(--r-pill)", fontSize: 12, cursor: "pointer",
                fontFamily: "inherit", border: "1.5px solid",
                borderColor: repeat === opt.value ? "var(--ink)" : "var(--border-strong)",
                background: repeat === opt.value ? "var(--ink)" : "var(--surface)",
                color: repeat === opt.value ? "var(--surface)" : "var(--ink-2)",
                fontWeight: repeat === opt.value ? 600 : 400,
              }}>
              {opt.label}
            </button>
          ))}
        </div>
        {repeat === "weekly" && (
          <div style={{ display: "flex", gap: 5 }}>
            {WEEK_DAYS.map(d => (
              <button key={d.key} type="button" onClick={() => toggleDay(d.key)}
                style={{
                  width: 34, height: 34, borderRadius: "50%", border: "1.5px solid",
                  borderColor: repeatDays.includes(d.key) ? "var(--brand)" : "var(--border-strong)",
                  background: repeatDays.includes(d.key) ? "var(--brand)" : "var(--surface)",
                  color: repeatDays.includes(d.key) ? "var(--surface)" : "var(--ink-2)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}>
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={!title.trim() || saving}
          style={{ background: "var(--brand)", color: "var(--surface)", border: "none", borderRadius: "var(--r-xs)", padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: (!title.trim() || saving) ? "default" : "pointer", opacity: (!title.trim() || saving) ? 0.5 : 1, fontFamily: "inherit", transition: "opacity var(--dur) var(--ease-out)" }}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button onClick={onCancel}
          style={{ background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "7px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Postpone Popup ──────────────────────────────────────────────────────────
function PostponePopup({ current, onSelect, onClose }: { current?: string; onSelect: (d: string) => void; onClose: () => void }) {
  const today = new Date();
  const options = [
    { label: "Завтра", date: new Date(today.getTime() + 86400000) },
    { label: "Послезавтра", date: new Date(today.getTime() + 2 * 86400000) },
    { label: "Через неделю", date: new Date(today.getTime() + 7 * 86400000) },
  ];
  const [custom, setCustom] = useState(current || "");

  return (
    <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: 12, zIndex: 200, minWidth: 190, boxShadow: "var(--shadow-md)" }}>
      {options.map(o => {
        const v = o.date.toISOString().split("T")[0];
        return (
          <div key={v} onClick={() => { onSelect(v); onClose(); }}
            style={{ padding: "7px 10px", borderRadius: "var(--r-xs)", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between", color: "var(--ink)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}>
            <span>{o.label}</span>
            <span style={{ color: "var(--muted)", fontSize: 11 }}>{fmtDeadline(v)}</span>
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 8 }}>
        <input type="date" value={custom} onChange={e => setCustom(e.target.value)}
          style={{ width: "100%", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "5px 8px", fontSize: 12, fontFamily: "inherit", color: "var(--ink)" }} />
        {custom && (
          <button onClick={() => { onSelect(custom); onClose(); }}
            style={{ marginTop: 6, width: "100%", background: "var(--brand)", color: "var(--surface)", border: "none", borderRadius: "var(--r-xs)", padding: "6px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Выбрать
          </button>
        )}
      </div>
      <button onClick={onClose} style={{ marginTop: 4, width: "100%", background: "none", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Закрыть</button>
    </div>
  );
}

// ── Task Row ────────────────────────────────────────────────────────────────
type TaskRowProps = {
  task: Task;
  today: string;
  onDone: () => void;
  onDelete: () => void;
  onUpdate: (data: Partial<Task>) => void;
  onDuplicate: () => void;
  isArchive?: boolean;
};

function TaskRow({ task, today, onDone, onDelete, onUpdate, onDuplicate, isArchive }: TaskRowProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showPostpone, setShowPostpone] = useState(false);
  const isOverdue = !isArchive && task.deadline && task.deadline < today;
  const priorityDot: Record<string, string> = { high: "var(--danger)", medium: "var(--warn)", low: "var(--success)" };

  if (editing) {
    return (
      <TaskEditForm
        initial={task}
        onSave={async data => { onUpdate(data); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const btnStyle = {
    background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "3px 8px",
    fontSize: 11, color: "var(--ink-2)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const,
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowPostpone(false); }}
      style={{
        background: isArchive ? "var(--surface-2)" : "var(--surface)",
        border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "11px 14px",
        display: "flex", alignItems: "flex-start", gap: 10,
        boxShadow: hovered ? "var(--shadow-sm)" : "none",
        opacity: isArchive ? 0.75 : 1,
        transition: "box-shadow var(--dur) var(--ease-out)",
      }}>
      {/* Checkbox */}
      <button onClick={onDone}
        style={{
          marginTop: 3, width: 16, height: 16, borderRadius: "50%",
          border: isArchive ? "1.5px solid var(--success)" : "1.5px solid var(--border-strong)",
          background: isArchive ? "var(--success)" : "none",
          cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        }}
        title={isArchive ? "Вернуть в работу" : "Отметить выполненной"}>
        {isArchive && <span style={{ color: "var(--surface)", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <span
            style={{ fontSize: 14, fontWeight: 500, cursor: "pointer", textDecoration: isArchive ? "line-through" : "none", color: isArchive ? "var(--muted)" : "var(--ink)" }}
            onDoubleClick={() => !isArchive && setEditing(true)}
            title={isArchive ? "" : "Двойной клик для редактирования"}>
            {task.title}
          </span>
          {!isArchive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: priorityDot[task.priority] || "var(--border-strong)", flexShrink: 0, marginTop: 5 }} />}
        </div>
        {task.description && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {task.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
          {isArchive ? (
            <>
              {task.created_at && (
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  Поставлена: {fmtDate(task.created_at)}
                </span>
              )}
              {task.done_at && (
                <span style={{ fontSize: 11, color: "var(--success-ink)", fontWeight: 500 }}>
                  Выполнена: {fmtDate(task.done_at)}
                </span>
              )}
              {task.deadline && (
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  Срок: {fmtDeadline(task.deadline)}
                </span>
              )}
            </>
          ) : (
            <>
              {task.deadline && (
                <span style={{ fontSize: 11, color: isOverdue ? "var(--danger)" : "var(--muted)", fontWeight: isOverdue ? 600 : 400 }}>
                  {isOverdue ? "⚠ " : ""}до {fmtDeadline(task.deadline)}
                </span>
              )}
              {task.repeat !== "none" && <span style={{ fontSize: 11, color: "var(--muted)" }}>↻ повтор</span>}
            </>
          )}

          {hovered && (
            <div style={{ display: "flex", gap: 4, marginLeft: "auto", position: "relative" }}>
              {!isArchive && <button style={btnStyle} onClick={() => setEditing(true)}>✏ Изменить</button>}
              {!isArchive && (
                <div style={{ position: "relative" }}>
                  <button style={btnStyle} onClick={() => setShowPostpone(!showPostpone)}>📅 Перенести</button>
                  {showPostpone && (
                    <PostponePopup
                      current={task.deadline}
                      onSelect={d => onUpdate({ deadline: d })}
                      onClose={() => setShowPostpone(false)}
                    />
                  )}
                </div>
              )}
              <button style={btnStyle} onClick={onDuplicate} title="Создать копию">⟳ Повторить</button>
              <button
                style={{ ...btnStyle, color: "var(--danger)", borderColor: "var(--danger-border)" }}
                onClick={onDelete}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-soft)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"; }}>
                ✕ Удалить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Direction Group ─────────────────────────────────────────────────────────
type GroupProps = {
  direction: string;
  tasks: Task[];
  today: string;
  onDone: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
  onDuplicate: (task: Task) => void;
  onAdd: (data: Partial<Task>) => Promise<void>;
  isArchive?: boolean;
};

function DirectionGroup({ direction, tasks, today, onDone, onDelete, onUpdate, onDuplicate, onAdd, isArchive }: GroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const overdue = tasks.filter(t => t.deadline && t.deadline < today).length;

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", cursor: "pointer", userSelect: "none" }}
        onClick={() => setCollapsed(!collapsed)}>
        <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform var(--dur) var(--ease-out)" }}>▼</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {dirLabel(direction)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{tasks.length}</span>
        {!isArchive && overdue > 0 && <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>{overdue} просрочено</span>}
      </div>

      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 4 }}>
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} today={today}
              isArchive={isArchive}
              onDone={() => onDone(task.id)}
              onDelete={() => onDelete(task.id)}
              onUpdate={data => onUpdate(task.id, data)}
              onDuplicate={() => onDuplicate(task)} />
          ))}

          {!isArchive && (
            addingTask ? (
              <TaskEditForm
                defaultDirection={direction}
                onSave={async data => { await onAdd({ ...data, direction }); setAddingTask(false); }}
                onCancel={() => setAddingTask(false)}
              />
            ) : (
              <button
                onClick={() => setAddingTask(true)}
                style={{ background: "none", border: "1px dashed var(--border-strong)", borderRadius: "var(--r-sm)", padding: "8px 14px", fontSize: 12, color: "var(--muted)", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color var(--dur) var(--ease-out), color var(--dur) var(--ease-out)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--brand)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--brand-ink)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--muted)"; }}>
                + Добавить задачу
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}


// ── Archive Panel ───────────────────────────────────────────────────────────
type ArchivePanelProps = {
  today: string;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (task: Task) => void;
};

function ArchivePanel({ today, onRestore, onDelete, onDuplicate }: ArchivePanelProps) {
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/tasks/?is_done=true`)
      .then(r => r.json())
      .then(d => setDoneTasks(Array.isArray(d) ? d : []))
      .catch(() => setDoneTasks([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: "24px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Загрузка архива…</div>;
  if (doneTasks.length === 0) return <div style={{ padding: "32px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Выполненных задач пока нет</div>;

  // Group by direction, within each direction sort by done_at desc
  const grouped: Record<string, Task[]> = {};
  for (const t of doneTasks) {
    const d = t.direction || "other";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(t);
  }
  for (const dir of Object.keys(grouped)) {
    grouped[dir].sort((a, b) => (b.done_at || "").localeCompare(a.done_at || ""));
  }
  const dirs = dirOrder().filter(d => grouped[d]);

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        {doneTasks.length} выполненных задач · в каждой задаче показана дата постановки и завершения
      </div>
      {dirs.map(dir => (
        <ArchiveDirectionGroup
          key={dir}
          direction={dir}
          tasks={grouped[dir]}
          today={today}
          onRestore={onRestore}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      ))}
    </div>
  );
}

// ── Archive Direction Group ─────────────────────────────────────────────────
type ArchiveDirGroupProps = {
  direction: string;
  tasks: Task[];
  today: string;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (task: Task) => void;
};

function ArchiveDirectionGroup({ direction, tasks, today, onRestore, onDelete, onDuplicate }: ArchiveDirGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform var(--dur) var(--ease-out)" }}>▼</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)", letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {dirLabel(direction)}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{tasks.length}</span>
      </div>
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingLeft: 4 }}>
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} today={today} isArchive
              onDone={() => onRestore(task.id)}
              onDelete={() => onDelete(task.id)}
              onUpdate={() => {}}
              onDuplicate={() => onDuplicate(task)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Calendar Week View ───────────────────────────────────────────────────────
const DAY_NAMES = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const DAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const REPEAT_DAY_MAP: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8–20
const SLOT_H = 52; // px per hour
const COL_W = 148; // px per day column
const TIME_W = 44; // px for time label column
// dirColor() replaces DIR_COLORS — reads from dirStore

function getWeekDays(fromDate: Date): Date[] {
  const day = fromDate.getDay();
  const mon = new Date(fromDate);
  mon.setDate(fromDate.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
}
function toYMD(d: Date) { return d.toISOString().split("T")[0]; }
function hourFromTime(t?: string) { return t ? parseInt(t.split(":")[0]) : null; }

// Mini task chip for calendar grid
function CalendarChip({ task, onDone, onUpdate, onDelete, dragging, onDragStart }: {
  task: Task; onDone: () => void; onUpdate: (d: Partial<Task>) => void; onDelete: () => void;
  dragging: boolean; onDragStart: () => void;
}) {
  const color = dirColor(task.direction);
  const [hov, setHov] = useState(false);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <>
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 500 }}
          onClick={() => setEditing(false)} />
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 501, width: 360, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)", padding: 16 }}
          onClick={e => e.stopPropagation()}>
          <TaskEditForm
            initial={task}
            onSave={async data => { onUpdate(data); setEditing(false); }}
            onCancel={() => setEditing(false)} />
        </div>
      </>
    );
  }

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.setData("taskId", String(task.id)); onDragStart(); }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: color + "18", borderLeft: `3px solid ${color}`, borderRadius: "0 5px 5px 0",
        padding: "3px 6px", fontSize: 11, cursor: "grab", userSelect: "none", position: "relative",
        opacity: dragging ? 0.4 : 1, transition: "opacity 0.15s",
        marginBottom: 2,
      }}>
      <div style={{ fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
        {task.title}
      </div>
      {task.scheduled_time && <div style={{ fontSize: 10, color: "var(--muted)" }}>{task.scheduled_time}</div>}
      {hov && (
        <div style={{ position: "absolute", right: 4, top: 2, display: "flex", gap: 3 }}>
          <button onClick={e => { e.stopPropagation(); setEditing(true); }}
            style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 4px", fontSize: 10, cursor: "pointer", color: "var(--ink-2)" }}>✏</button>
          <button onClick={e => { e.stopPropagation(); onDone(); }}
            style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 4px", fontSize: 10, cursor: "pointer", color: "var(--success)" }}>✓</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: "var(--surface)", border: "1px solid var(--danger-border)", borderRadius: 4, padding: "1px 4px", fontSize: 10, cursor: "pointer", color: "var(--danger)" }}>✕</button>
        </div>
      )}
    </div>
  );
}

type WeeklyViewProps = {
  tasks: Task[];
  today: string;
  onDone: (id: number) => void;
  onDelete: (id: number, date?: string) => void;
  onUpdate: (id: number, data: Partial<Task>) => void;
  onDuplicate: (task: Task) => void;
  onAdd: (data: Partial<Task>) => Promise<void>;
};

function WeeklyView({ tasks, today, onDone, onDelete, onUpdate, onDuplicate, onAdd }: WeeklyViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ date: string; hour: number | null } | null>(null);
  const [addingInSlot, setAddingInSlot] = useState<{ date: string; hour: number } | null>(null);
  const [appleEvents, setAppleEvents] = React.useState<any[]>([]);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);
  const weekStart = toYMD(weekDays[0]);
  const weekEnd = toYMD(weekDays[6]);

  React.useEffect(() => {
    fetch(`${API}/api/calendar/events?start=${weekStart}&end=${weekEnd}`)
      .then(r => r.json())
      .then(d => setAppleEvents(d.events || []))
      .catch(() => setAppleEvents([]));
  }, [weekStart, weekEnd]);

  // Build day buckets
  // recurring tasks appear on their repeat_days columns (virtual)
  const byDay: Record<string, Task[]> = {};
  const unscheduled: Task[] = [];
  const overdue: Task[] = [];

  for (const t of tasks) {
    // Recurring weekly — show on repeat_days of current week
    if (t.repeat === "weekly" && t.repeat_days) {
      const days = t.repeat_days.split(",").map(s => s.trim());
      const excl = t.excluded_dates ? t.excluded_dates.split(",").map(s => s.trim()) : [];
      for (const day of weekDays) {
        const ymd = toYMD(day);
        if (excl.includes(ymd)) continue;
        if (t.repeat_until && ymd > t.repeat_until) continue;
        const ruKey = ["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"][day.getDay()];
        const eng = Object.keys(REPEAT_DAY_MAP).find(k => REPEAT_DAY_MAP[k] === day.getDay()) || "";
        if (days.includes(eng) || days.includes(ruKey)) {
          if (!byDay[ymd]) byDay[ymd] = [];
          if (!byDay[ymd].find(x => x.id === t.id)) byDay[ymd].push(t);
        }
      }
      continue;
    }

    if (!t.deadline) { unscheduled.push(t); continue; }
    if (t.deadline < weekStart) { if (weekOffset === 0) overdue.push(t); else unscheduled.push(t); continue; }
    if (t.deadline > weekEnd) { if (weekOffset === 0) unscheduled.push(t); continue; }
    if (!byDay[t.deadline]) byDay[t.deadline] = [];
    byDay[t.deadline].push(t);
  }

  const handleDrop = (date: string, hour: number | null) => {
    if (!draggingId) return;
    const updates: Partial<Task> = { deadline: date };
    if (hour !== null) updates.scheduled_time = `${String(hour).padStart(2, "0")}:00`;
    onUpdate(draggingId, updates);
    setDraggingId(null);
    setDropTarget(null);
  };

  const weekLabel = weekOffset === 0 ? "Эта неделя"
    : weekOffset === 1 ? "Следующая неделя"
    : weekOffset === -1 ? "Прошлая неделя"
    : `${weekDays[0].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })} — ${weekDays[6].toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`;

  const totalW = TIME_W + COL_W * 7;

  return (
    <div>
      {/* Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setWeekOffset(w => w - 1)}
          style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "5px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "var(--ink-2)" }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", minWidth: 220, textAlign: "center" }}>{weekLabel}</span>
        <button onClick={() => setWeekOffset(w => w + 1)}
          style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "5px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "var(--ink-2)" }}>›</button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            style={{ fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            Сегодня
          </button>
        )}
      </div>

      {/* Просроченные */}
      {overdue.length > 0 && (
        <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger-border)", borderRadius: "var(--r-sm)", padding: "8px 14px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--danger-ink)", marginRight: 4 }}>⚠ Просроченные</span>
          {overdue.map(t => (
            <span key={t.id} style={{ fontSize: 11, background: "var(--danger-border)", color: "var(--danger-ink)", borderRadius: "var(--r-xs)", padding: "2px 8px", cursor: "pointer" }}
              onClick={() => onUpdate(t.id, { deadline: today })}>
              {t.title}
            </span>
          ))}
        </div>
      )}

      {/* Calendar grid — 7 columns fill available width */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", background: "var(--surface)", overflow: "hidden" }}>
        <div>

          {/* Day headers */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: TIME_W, flexShrink: 0 }} />
            {weekDays.map(day => {
              const ymd = toYMD(day);
              const isToday = ymd === today;
              return (
                <div key={ymd} style={{ flex: 1, minWidth: 0, padding: "10px 8px", borderLeft: "1px solid var(--border)", textAlign: "center", background: isToday ? "var(--brand)" : "var(--surface)" }}>
                  <div style={{ fontSize: 11, color: isToday ? "rgba(255,255,255,0.72)" : "var(--muted)", fontWeight: 500 }}>{DAY_SHORT[day.getDay()]}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isToday ? "var(--surface)" : "var(--ink)", marginTop: 1 }}>{day.getDate()}</div>
                  <div style={{ fontSize: 10, color: isToday ? "rgba(255,255,255,0.6)" : "var(--faint)" }}>{day.toLocaleDateString("ru-RU", { month: "short" })}</div>
                </div>
              );
            })}
          </div>

          {/* All-day row — tasks without scheduled_time */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", minHeight: 36 }}>
            <div style={{ width: TIME_W, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}>
              <span style={{ fontSize: 9, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>весь<br/>день</span>
            </div>
            {weekDays.map(day => {
              const ymd = toYMD(day);
              const allDay = (byDay[ymd] || []).filter(t => !t.scheduled_time);
              const isDropTarget = dropTarget?.date === ymd && dropTarget?.hour === null;
              return (
                <div key={ymd}
                  onDragOver={e => { e.preventDefault(); setDropTarget({ date: ymd, hour: null }); }}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={() => handleDrop(ymd, null)}
                  style={{ flex: 1, minWidth: 0, borderLeft: "1px solid var(--border)", padding: "4px 4px", background: isDropTarget ? "var(--brand-soft)" : "transparent", minHeight: 36 }}>
                  {allDay.map(t => (
                    <CalendarChip key={t.id} task={t}
                      onDone={() => onDone(t.id)}
                      onUpdate={d => onUpdate(t.id, d)}
                      onDelete={() => onDelete(t.id, ymd)}
                      dragging={draggingId === t.id}
                      onDragStart={() => setDraggingId(t.id)} />
                  ))}
                  {appleEvents.filter(e => e.date === ymd && e.allday).map((e, i) => (
                    <div key={`ac-ad-${i}`} style={{ background: e.calendar === "personal" ? "var(--warn-soft)" : "var(--info-soft)", borderLeft: `3px solid ${e.calendar === "personal" ? "var(--warn)" : "var(--info)"}`, borderRadius: "0 5px 5px 0", padding: "2px 6px", fontSize: 11, marginBottom: 2 }} title={e.cal_name}>
                      <span style={{ marginRight: 3 }}>🍎</span>{e.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          {HOURS.map(hour => (
            <div key={hour} style={{ display: "flex", height: SLOT_H, borderBottom: "1px solid var(--border)" }}>
              {/* Time label */}
              <div style={{ width: TIME_W, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 6, paddingTop: 3 }}>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{hour}:00</span>
              </div>
              {/* Day slots */}
              {weekDays.map(day => {
                const ymd = toYMD(day);
                const slotTasks = (byDay[ymd] || []).filter(t => hourFromTime(t.scheduled_time) === hour);
                const isDropTarget = dropTarget?.date === ymd && dropTarget?.hour === hour;
                const isToday = ymd === today;
                return (
                  <div key={ymd}
                    onDragOver={e => { e.preventDefault(); setDropTarget({ date: ymd, hour }); }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={() => handleDrop(ymd, hour)}
                    onClick={() => setAddingInSlot({ date: ymd, hour })}
                    style={{
                      flex: 1, minWidth: 0, borderLeft: "1px solid var(--border)",
                      padding: "2px 4px", position: "relative", cursor: "pointer",
                      background: isDropTarget ? "var(--brand-soft)" : isToday ? "rgba(26,107,82,0.04)" : "transparent",
                    }}>
                    {slotTasks.map(t => (
                      <CalendarChip key={t.id} task={t}
                        onDone={() => onDone(t.id)}
                        onUpdate={d => onUpdate(t.id, d)}
                        onDelete={() => onDelete(t.id, ymd)}
                        dragging={draggingId === t.id}
                        onDragStart={() => setDraggingId(t.id)} />
                    ))}
                    {appleEvents.filter(e => e.date === ymd && !e.allday && e.start_time && parseInt(e.start_time.split(":")[0]) === hour).map((e, i) => (
                      <div key={`ac-${i}`} title={`${e.cal_name}: ${e.start_time}–${e.end_time}`}
                        style={{ background: e.calendar === "personal" ? "var(--warn-soft)" : "var(--info-soft)", borderLeft: `3px solid ${e.calendar === "personal" ? "var(--warn)" : "var(--info)"}`, borderRadius: "0 5px 5px 0", padding: "2px 6px", fontSize: 11, marginBottom: 2, userSelect: "none" }}>
                        <div style={{ fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                          <span style={{ marginRight: 3 }}>🍎</span>{e.title}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--muted)" }}>{e.start_time}–{e.end_time}</div>
                      </div>
                    ))}
                    {addingInSlot?.date === ymd && addingInSlot?.hour === hour && (
                      <div style={{ position: "absolute", top: 0, left: 0, zIndex: 50, width: COL_W * 2, background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", boxShadow: "var(--shadow-md)", padding: 8 }}
                        onClick={e => e.stopPropagation()}>
                        <TaskEditForm
                          initial={{ deadline: ymd, scheduled_time: `${String(hour).padStart(2, "0")}:00` }}
                          onSave={async data => { await onAdd(data); setAddingInSlot(null); }}
                          onCancel={() => setAddingInSlot(null)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Входящие — без срока / без дня. Также зона возврата задачи с календаря */}
      {(() => {
        const isDropZone = dropTarget?.date === "__inbox__";
        return (
          <div
            onDragOver={e => { e.preventDefault(); setDropTarget({ date: "__inbox__", hour: null }); }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => {
              if (draggingId) {
                onUpdate(draggingId, { deadline: undefined, scheduled_time: undefined } as Partial<Task>);
                // explicitly clear via API
                fetch(`${API}/api/tasks/${draggingId}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ deadline: null, scheduled_time: null }),
                });
              }
              setDraggingId(null); setDropTarget(null);
            }}
            style={{ marginTop: 12, border: `1px solid ${isDropZone ? "var(--brand)" : "var(--border)"}`, borderRadius: "var(--r-md)", overflow: "hidden", transition: "border-color var(--dur) var(--ease-out)", background: isDropZone ? "var(--brand-soft)" : "transparent" }}>
            <div style={{ padding: "10px 16px", background: isDropZone ? "var(--brand-soft)" : "var(--surface-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isDropZone ? "var(--brand-ink)" : "var(--ink-2)" }}>Входящие</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: "1px 7px" }}>{unscheduled.length}</span>
              <span style={{ fontSize: 11, color: isDropZone ? "var(--brand)" : "var(--muted)" }}>
                {isDropZone ? "↓ отпустите, чтобы убрать дату" : "— перетащите задачу в нужный день и время"}
              </span>
            </div>
            <div style={{ padding: "10px 12px" }}>
              {unscheduled.length === 0 && !isDropZone && (
                <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 2px" }}>Нет неразобранных задач</div>
              )}
              {dirOrder().filter(dir => unscheduled.some(t => t.direction === dir)).map(dir => (
                <div key={dir} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: dirColor(dir), textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4, paddingLeft: 2 }}>
                    {dirLabel(dir)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {unscheduled.filter(t => t.direction === dir).map(t => (
                      <div key={t.id}
                        draggable
                        onDragStart={e => { e.dataTransfer.setData("taskId", String(t.id)); setDraggingId(t.id); }}
                        onDragEnd={() => setDraggingId(null)}
                        style={{ opacity: draggingId === t.id ? 0.4 : 1, cursor: "grab" }}>
                        <TaskRow task={t} today={today}
                          onDone={() => onDone(t.id)}
                          onDelete={() => onDelete(t.id)}
                          onUpdate={d => onUpdate(t.id, d)}
                          onDuplicate={() => onDuplicate(t)} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Deal Row ────────────────────────────────────────────────────────────────
function DealRow({ d, last }: { d: RiskDeal; last: boolean }) {
  const critical = d.age_days >= 180;
  const warn = d.age_days >= 60;
  const dotColor = critical ? "var(--danger)" : warn ? "var(--warn)" : "var(--success)";
  const ageColor = critical ? "var(--danger)" : warn ? "var(--warn)" : "var(--muted)";
  return (
    <a href={d.url} target="_blank" rel="noreferrer"
      style={{ display: "grid", gridTemplateColumns: "8px 1fr 1fr 120px 70px 16px", alignItems: "center", gap: 16, padding: "11px 20px", borderBottom: last ? "none" : "1px solid var(--border)", textDecoration: "none", color: "inherit", transition: "background var(--dur) var(--ease-out)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, justifySelf: "center" }} />
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{d.client}</div>
      <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{d.broker || "—"}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", textAlign: "right" }}>
        {d.commission > 0 ? `${d.commission.toLocaleString("ru-RU")} ₽` : "—"}
      </div>
      <div style={{ fontSize: 12, color: ageColor, fontWeight: 600, textAlign: "right" }}>
        {d.age_days} дн.
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ justifySelf: "center", color: "var(--faint)" }}>
        <path d="M7 17L17 7M17 7H7M17 7v10" />
      </svg>
    </a>
  );
}

const STAGE_ORDER = ["Дожим", "Бронь", "Показ проведён", "Показ назначен", "Открыта сделка"];
const STAGE_COLOR: Record<string, string> = {
  "Дожим": "var(--danger)",
  "Бронь": "#9f7aea",
  "Показ проведён": "#3182ce",
  "Показ назначен": "#38a169",
  "Открыта сделка": "var(--warn)",
};

function DealStageGroup({ stage, deals }: { stage: string; deals: RiskDeal[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalCommission = deals.reduce((s, d) => s + (d.commission || 0), 0);
  const color = STAGE_COLOR[stage] || "var(--muted)";

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden", marginBottom: 8 }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none", borderBottom: collapsed ? "none" : "1px solid var(--border)", background: "var(--surface-2)" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: "var(--ink)" }}>{stage}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-pill)", padding: "2px 8px" }}>{deals.length}</span>
        {totalCommission > 0 && (
          <span style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 500 }}>{fmt(totalCommission)} ₽</span>
        )}
        <span style={{ fontSize: 11, color: "var(--muted)", transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform var(--dur) var(--ease-out)", display: "inline-block" }}>▼</span>
      </div>
      {!collapsed && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "8px 1fr 1fr 120px 70px 16px", gap: 16, padding: "7px 20px", borderBottom: "1px solid var(--border)" }}>
            <div />
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Клиент</div>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Брокер</div>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "right" }}>Комиссия</div>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "right" }}>Без движ.</div>
            <div />
          </div>
          {deals.map((d, i) => <DealRow key={d.url} d={d} last={i === deals.length - 1} />)}
        </>
      )}
    </div>
  );
}

// ── Sales Dashboard (Отдел продаж — рейтинг + воронка) ─────────────────────
type SalesBroker = {
  rank: number; name: string; leads: number; quals: number; leads12: number;
  shows: number; meetings: number; deposits: number; deals: number;
  commission: number; avg_check: number; leads_pct: number; dep_pct: number; tier: string | null;
};
type FunnelStage = { stage: string; value: number; conv: number | null };
type SalesData = {
  period: string; company_val: number; company_eff: number;
  funnel: FunnelStage[]; bottleneck: string; brokers: SalesBroker[];
};

const SALES_VIEWS = [
  { key: "funnel",  label: "Воронка" },
  { key: "brokers", label: "Рейтинг брокеров" },
  { key: "rnp",     label: "РНП" },
  { key: "repeat",  label: "Повторные" },
] as const;
type SalesView = (typeof SALES_VIEWS)[number]["key"];

function SalesViewTabs({ view, setView }: { view: SalesView; setView: (v: SalesView) => void }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {SALES_VIEWS.map(v => (
        <button key={v.key} onClick={() => setView(v.key)} style={{
          fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: "var(--r-sm)", cursor: "pointer", fontFamily: "inherit",
          background: view === v.key ? "var(--ink)" : "var(--surface)", color: view === v.key ? "var(--surface)" : "var(--ink-2)",
          border: view === v.key ? "1px solid var(--ink)" : "1px solid var(--border-strong)",
          transition: "background var(--dur) var(--ease-out)",
        }}>{v.label}</button>
      ))}
    </div>
  );
}

/** Шапка + переключатель. Рисуется всегда, в том числе при ошибке загрузки —
 *  иначе падение Google Sheets отрезает доступ к подразделам, которым данные не нужны. */
function SalesShell({ title, subtitle, view, setView, children }: {
  title: string; subtitle: string; view: SalesView; setView: (v: SalesView) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{subtitle}</div>
        </div>
        <SalesViewTabs view={view} setView={setView} />
      </div>
      {children}
    </div>
  );
}

function SalesDashboard() {
  const [data, setData] = React.useState<SalesData | null>(null);
  const [rnpData, setRnpData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<SalesView>("funnel");
  const [rnpMonth, setRnpMonth] = React.useState(currentMonthRu());

  React.useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/sales/rating`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Ошибка загрузки данных"); setLoading(false); });
  }, []);

  React.useEffect(() => {
    if (view !== "rnp") return;
    setRnpData(null);
    fetch(`${API}/api/sales/rnp?month=${encodeURIComponent(rnpMonth)}`)
      .then(r => r.json())
      .then(d => setRnpData(d))
      .catch(() => {});
  }, [view, rnpMonth]);

  // Повторные продажи — статичная раскладка, ей данные из Sheets не нужны.
  // Рисуем до проверок загрузки, иначе падение /api/sales/rating прячет и этот подраздел.
  if (view === "repeat") return (
    <SalesShell title="Повторные продажи · Отдел продаж" subtitle={`Данные на ${REPEAT_DATA.updated} · вносятся вручную`} view={view} setView={setView}>
      <RepeatSalesPanel />
    </SalesShell>
  );

  if (loading) return (
    <SalesShell title="РНП · Отдел продаж" subtitle="Google Sheets" view={view} setView={setView}>
      <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Загрузка данных продаж…</div>
    </SalesShell>
  );
  if (error || !data) return (
    <SalesShell title="РНП · Отдел продаж" subtitle="Google Sheets" view={view} setView={setView}>
      <div style={{ padding: 40, textAlign: "center", color: "var(--danger)", fontSize: 13 }}>
        {error || "Ошибка загрузки данных"}
        <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>Подраздел «Повторные» доступен — ему данные не нужны.</div>
      </div>
    </SalesShell>
  );

  const maxFunnelVal = data.funnel[0]?.value || 1;

  return (
    <div>
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>РНП · Отдел продаж</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Период: {data.period} · Google Sheets</div>
        </div>
        <SalesViewTabs view={view} setView={setView} />
      </div>

      {/* Метрики верхнего уровня */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Вал компании", value: fmt(data.company_val) + " ₽", sub: data.period },
          { label: "Эффективность", value: fmt(data.company_eff) + " ₽", sub: "вал закрытых сделок" },
          { label: "Сделок", value: Math.round(data.funnel.find(f => f.stage === "Сделки")?.value || 0).toString(), sub: "закрыто за период" },
          { label: "Узкое место", value: data.bottleneck, sub: "мин. конверсия", accent: true },
        ].map((m, i) => (
          <div key={i} style={{ background: m.accent ? "var(--warn-soft)" : "var(--surface)", border: `1px solid ${m.accent ? "var(--warn-border)" : "var(--border)"}`, borderRadius: "var(--r-sm)", padding: "16px 20px", boxShadow: "var(--shadow-xs)" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4, fontWeight: 600 }}>{m.label}</div>
            <div style={{ fontSize: m.accent ? 16 : 22, fontWeight: 700, color: m.accent ? "var(--warn-ink)" : "var(--ink)", letterSpacing: "-0.02em" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Воронка */}
      {view === "funnel" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "24px 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>Воронка продаж</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 24 }}>Подсвечено узкое место — этап с худшей конверсией</div>
          {data.funnel.map((stage, i) => {
            const barW = Math.max((stage.value / maxFunnelVal) * 100, 2);
            const isBottleneck = stage.stage === data.bottleneck;
            return (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <div style={{ width: 140, fontSize: 13, color: "var(--ink-2)", flexShrink: 0, textAlign: "right" }}>{stage.stage}</div>
                  <div style={{ flex: 1, position: "relative", height: 32, background: "var(--surface-2)", borderRadius: "var(--r-xs)", overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${barW}%`,
                      background: isBottleneck ? "var(--warn)" : "var(--brand)",
                      borderRadius: "var(--r-xs)", display: "flex", alignItems: "center", paddingLeft: 10,
                      transition: "width 0.4s var(--ease-out)",
                    }}>
                      <span style={{ color: "var(--surface)", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{Math.round(stage.value)}</span>
                    </div>
                    {isBottleneck && (
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, background: "var(--warn)", color: "var(--surface)", borderRadius: 4, padding: "2px 7px" }}>УЗКОЕ МЕСТО</span>
                    )}
                  </div>
                  {stage.conv !== null && (
                    <div style={{ width: 60, fontSize: 12, color: isBottleneck ? "var(--warn-ink)" : "var(--muted)", fontWeight: isBottleneck ? 600 : 400, flexShrink: 0 }}>↓ {stage.conv}%</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Рейтинг брокеров */}
      {view === "brokers" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--surface-2)" }}>
              <tr>
                {["#", "Брокер", "Лиды", "Квалы", "Показы", "Встречи", "Задатки", "Сделки", "Вал", "Ср. чек"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: h === "#" || h === "Брокер" ? "left" : "right", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.brokers.map((b, i) => {
                const isTop3 = b.rank <= 3;
                const rankColor = b.rank === 1 ? "#e0a416" : b.rank === 2 ? "#9ca3af" : b.rank === 3 ? "#c2714f" : "var(--faint)";
                return (
                  <tr key={i}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: isTop3 ? rankColor : "transparent", color: isTop3 ? "var(--surface)" : "var(--muted)", fontSize: 12, fontWeight: 700 }}>{b.rank}</span>
                    </td>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid var(--border)", fontWeight: 500, fontSize: 13, color: "var(--ink)" }}>{b.name}</td>
                    {[b.leads, b.quals, b.shows, b.meetings, Math.round(b.deposits)].map((v, j) => (
                      <td key={j} style={{ padding: "12px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontSize: 13, color: "var(--ink-2)" }}>{v}</td>
                    ))}
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontSize: 13, color: "var(--ink-2)" }}>{Math.round(b.deals)}</td>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontSize: 13, fontWeight: b.rank <= 3 ? 600 : 400, color: b.rank === 1 ? "var(--warn-ink)" : "var(--ink)" }}>{fmt(b.commission)} ₽</td>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid var(--border)", textAlign: "right", fontSize: 12, color: "var(--muted)" }}>{fmt(b.avg_check)} ₽</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* РНП — план vs факт */}
      {view === "rnp" && (
        <div>
          {/* Выбор месяца */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {monthsThrough(0).map(m => (
              <button key={m} onClick={() => setRnpMonth(m)} style={{
                padding: "5px 14px", borderRadius: "var(--r-pill)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                background: rnpMonth === m ? "var(--brand)" : "var(--surface)",
                color: rnpMonth === m ? "var(--surface)" : "var(--ink-2)",
                border: `1px solid ${rnpMonth === m ? "var(--brand)" : "var(--border-strong)"}`,
                fontWeight: rnpMonth === m ? 600 : 400,
                transition: "background var(--dur) var(--ease-out)",
              }}>{m}</button>
            ))}
          </div>

          {!rnpData ? (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Загрузка РНП…</div>
          ) : rnpData.empty ? (
            <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Нет данных за {rnpData.month} — вкладка ещё не заведена в таблице</div>
          ) : (
            <>
              {/* Воронка план/факт */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "24px 28px", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20, color: "var(--ink)" }}>Воронка — план vs факт · {rnpData.month}</div>
                {rnpData.funnel.map((f: any, i: number) => {
                  const isVal = f.metric.includes("₽");
                  const planVal = f.plan;
                  const factVal = f.fact;
                  const pct = f.pct;
                  const barFact = planVal > 0 ? Math.min((factVal / planVal) * 100, 100) : 0;
                  const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--warn)" : "var(--danger)";
                  return (
                    <div key={i} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                        <span style={{ fontWeight: 500, color: "var(--ink-2)" }}>{f.metric}</span>
                        <span style={{ color: "var(--muted)" }}>
                          факт: <b style={{ color: "var(--ink)" }}>{isVal ? `${fmt(factVal)} ₽` : Math.round(factVal)}</b>
                          {" / "}план: {isVal ? `${fmt(planVal)} ₽` : Math.round(planVal)}
                          <span style={{ marginLeft: 10, fontWeight: 700, color }}>{pct}%</span>
                        </span>
                      </div>
                      <div style={{ height: 10, background: "var(--surface-2)", borderRadius: "var(--r-pill)", overflow: "hidden", position: "relative" }}>
                        <div style={{ height: "100%", width: `${barFact}%`, background: color, borderRadius: "var(--r-pill)", transition: "width 0.4s var(--ease-out)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Рейтинг РНП брокеров */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", fontSize: 14, fontWeight: 600, borderBottom: "1px solid var(--border)", color: "var(--ink)" }}>Брокеры · {rnpData.month}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      {["Брокер", "Сделки факт", "Вал факт", "КВАЛы 12+", "Показы", "Встречи", "Задатки"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rnpData.brokers.map((b: any, i: number) => {
                      const m = (name: string) => b.metrics?.find((x: any) => x.metric === name);
                      return (
                        <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "10px 14px", fontWeight: 500, borderBottom: "1px solid var(--border)", color: "var(--ink)" }}>{b.name}</td>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", color: b.deals_fact > 0 ? "var(--success-ink)" : "var(--muted)", fontWeight: 600 }}>{b.deals_fact || "—"}</td>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", fontWeight: b.val_fact > 0 ? 600 : 400, color: b.val_fact > 0 ? "var(--ink)" : "var(--muted)" }}>{b.val_fact > 0 ? `${fmt(b.val_fact)} ₽` : "—"}</td>
                          {["КВАЛы 12+","Показы","Встречи","Задатки"].map(name => {
                            const met = m(name);
                            return <td key={name} style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", color: "var(--ink-2)" }}>{met ? `${met.fact} / ${Math.round(met.plan)}` : "—"}</td>;
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sales Table (Отдел продаж — Битрикс) ───────────────────────────────────
function SalesTable({ deals, loading, error, onRefresh }: { deals: RiskDeal[]; loading: boolean; error: string | null; onRefresh: () => void }) {
  const thStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13, borderBottom: "1px solid var(--border)", verticalAlign: "middle" };

  const riskMoney = deals.reduce((s, d) => s + (d.commission || 0), 0);

  return (
    <div>
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Отдел продаж</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Первичный источник: Битрикс24 · только чтение</div>
        </div>
        <button onClick={onRefresh} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>↻ Обновить</button>
      </div>

      {/* Метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Зависших сделок</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: deals.length > 0 ? "var(--danger)" : "var(--ink)" }}>{loading ? "—" : deals.length}</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Под риском</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: riskMoney > 0 ? "var(--danger)" : "var(--ink)" }}>{loading ? "—" : riskMoney > 0 ? `${fmt(riskMoney)} ₽` : "—"}</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Уволенных брокеров</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{loading ? "—" : deals.filter(d => d.is_fired).length}</div>
        </div>
      </div>

      {/* Таблица */}
      {loading ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Загрузка из Битрикс24…</div>
      ) : error ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>
          <button onClick={onRefresh} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "1px solid var(--border-strong)", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>Попробовать снова</button>
        </div>
      ) : deals.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Зависших сделок нет</div>
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--surface-2)" }}>
              <tr>
                <th style={thStyle}>Клиент</th>
                <th style={thStyle}>Брокер</th>
                <th style={thStyle}>Стадия</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Комиссия</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Дней без движения</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Статус</th>
                <th style={{ ...thStyle, width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d, i) => {
                const critical = d.age_days >= 180;
                const warn = d.age_days >= 60;
                const dotColor = critical ? "var(--danger)" : warn ? "var(--warn)" : "var(--success)";
                const stageColor = STAGE_COLOR[d.stage] || "var(--muted)";
                return (
                  <tr key={i} style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{d.client}</div>
                      {d.is_fired && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2 }}>уволен</div>}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--ink-2)" }}>{d.broker || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{ background: stageColor + "18", color: stageColor, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 500 }}>{d.stage}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }}>{d.commission > 0 ? `${d.commission.toLocaleString("ru-RU")} ₽` : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span style={{ color: critical ? "var(--danger)" : warn ? "var(--warn)" : "var(--muted)", fontWeight: (critical || warn) ? 600 : 400 }}>{d.age_days} дн.</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
                    </td>
                    <td style={tdStyle}>
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "var(--muted)", textDecoration: "none", fontSize: 13 }}>↗</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Support Table (Отдел сопровождения — Google Sheets) ─────────────────────
function SupportTable() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"all" | "Меркулова" | "Добрицкая">("all");
  const [month, setMonth] = React.useState<string | null>(null); // null = самый свежий месяц

  const load = (m: string | null = month) => {
    setLoading(true); setError(null);
    fetch(`${API}/api/support/deals${m ? `?month=${encodeURIComponent(m)}` : ""}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Нет соединения с сервером"); setLoading(false); });
  };
  React.useEffect(() => { load(); }, [month]);

  const RISK_COLOR: Record<string, string> = { green: "#16a34a", yellow: "#d97706", red: "#dc2626", gray: "#cbd0d6" };
  const RISK_BG:    Record<string, string> = { green: "var(--success-soft)", yellow: "#fff7ed", red: "var(--danger-soft)", gray: "#f6f6f7" };
  const RISK_LABEL: Record<string, string> = { green: "Высокая", yellow: "Средняя", red: "Низкая", gray: "—" };
  const DOC_COLOR: Record<string, string>  = { "Готово": "#16a34a", "В работе": "#d97706", "в работе": "#d97706", "Есть риск": "#dc2626" };

  const thStyle: React.CSSProperties = { padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", background: "var(--surface-2)" };
  const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 12, borderBottom: "1px solid var(--border)", verticalAlign: "middle" };

  if (loading) return <div style={{ color: "var(--muted)", padding: 60, textAlign: "center" }}>Загрузка данных из Google Sheets…</div>;
  if (error)   return <div style={{ color: "var(--danger)", padding: 60, textAlign: "center" }}>{error}<br /><button onClick={() => load()} style={{ marginTop: 12, padding: "6px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)", background: "var(--surface)", cursor: "pointer", fontSize: 13, fontFamily: "inherit", color: "var(--ink-2)" }}>Попробовать снова</button></div>;

  const s = data.summary;
  const deals = filter === "all" ? data.deals : data.deals.filter((d: any) => d.executor.trim().toLowerCase() === filter.toLowerCase());

  return (
    <div>
      {/* Заголовок */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>Отдел сопровождения</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Google Sheets · «{data.sheet_title || "Прогноз"}» · {s.total_deals} сделок</div>
        </div>
        <button onClick={() => load()} style={{ background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "6px 14px", fontSize: 12, cursor: "pointer", color: "var(--ink-2)", fontFamily: "inherit" }}>↻ Обновить</button>
      </div>

      {/* Метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Итог сделок",    value: `${fmt(s.total_amount)} ₽`,    color: "var(--ink)" },
          { label: "Зашло",          value: `${fmt(s.received_amount)} ₽`, color: "var(--success-ink)" },
          { label: "План комиссии",  value: `${fmt(s.plan_commission)} ₽`, color: "var(--brand-ink)" },
          { label: "Подтверждено",   value: `${fmt(s.confirmed)} ₽`,       color: "var(--success-ink)" },
          { label: "Красные сделки", value: `${fmt(s.red_amount)} ₽`,      color: "var(--danger)" },
          { label: "Всего сделок",   value: `${s.total_deals}`,            color: "var(--ink)", sub: `🟢 ${s.green_deals}  🟡 ${s.yellow_deals}  🔴 ${s.red_deals}` },
        ].map(c => (
          <div key={c.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "12px 14px", boxShadow: "var(--shadow-xs)" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4, fontWeight: 600 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.color, letterSpacing: "-0.02em" }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Переключатель месяца */}
      {data.months && data.months.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {data.months.map((m: string) => (
            <button key={m} onClick={() => setMonth(m)}
              style={{ padding: "5px 14px", borderRadius: "var(--r-pill)", border: "1px solid", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
                borderColor: data.month === m ? "var(--ink)" : "var(--border-strong)",
                background: data.month === m ? "var(--ink)" : "var(--surface)",
                color: data.month === m ? "var(--surface)" : "var(--ink-2)", fontWeight: data.month === m ? 600 : 400, transition: "background var(--dur) var(--ease-out)" }}>
              {m}
            </button>
          ))}
        </div>
      )}

      {/* Фильтр по сопровожденцу */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "Меркулова", "Добрицкая"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "5px 14px", borderRadius: "var(--r-pill)", border: "1px solid", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              borderColor: filter === f ? "var(--brand)" : "var(--border-strong)",
              background: filter === f ? "var(--brand)" : "var(--surface)",
              color: filter === f ? "var(--surface)" : "var(--ink-2)", fontWeight: filter === f ? 600 : 400, transition: "background var(--dur) var(--ease-out)" }}>
            {f === "all" ? "Все" : f}
          </button>
        ))}
      </div>

      {/* Таблица */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              <th style={thStyle}>Вер.</th>
              <th style={thStyle}>Сопровожденец</th>
              <th style={thStyle}>Клиент / Объект</th>
              <th style={thStyle}>Брокер</th>
              <th style={thStyle}>РГ</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Комиссия</th>
              <th style={thStyle}>Дата оплаты</th>
              <th style={thStyle}>Статус документов</th>
              <th style={thStyle}>Этап / SLA</th>
              <th style={thStyle}>Ипотека</th>
              <th style={{ ...thStyle, textAlign: "center" }}>CRM</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d: any, i: number) => (
              <tr key={i}
                style={{ background: d.risk_level === "red" ? "var(--danger-soft)" : "transparent", transition: "background var(--dur) var(--ease-out)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                onMouseLeave={e => (e.currentTarget.style.background = d.risk_level === "red" ? "var(--danger-soft)" : "transparent")}>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: RISK_COLOR[d.risk_level] || "var(--border-strong)" }} title={RISK_LABEL[d.risk_level]} />
                </td>
                <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{d.executor}</td>
                <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 220, color: "var(--ink)" }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.client_obj}>{d.client_obj}</div>
                </td>
                <td style={{ ...tdStyle, color: "var(--ink-2)", maxWidth: 160 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.broker}>{d.broker || "—"}</div>
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)", whiteSpace: "nowrap" }}>{d.rg || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: d.commission > 0 ? "var(--ink)" : "var(--faint)" }}>
                  {d.commission > 0 ? `${fmt(d.commission)} ₽` : "—"}
                </td>
                <td style={{ ...tdStyle, color: "var(--ink-2)", whiteSpace: "nowrap" }}>{d.pay_date || "—"}</td>
                <td style={tdStyle}>
                  {d.doc_status ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: DOC_COLOR[d.doc_status] || "#83878e", background: (DOC_COLOR[d.doc_status] || "#83878e") + "18", borderRadius: 5, padding: "2px 7px" }}>
                      {d.doc_status}
                    </span>
                  ) : <span style={{ color: "var(--faint)" }}>—</span>}
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)", fontSize: 11, maxWidth: 140 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.ext_stage}>{d.ext_stage || "—"}</div>
                </td>
                <td style={{ ...tdStyle, color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap" }}>{d.mortgage || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {d.crm_url ? (
                    <a href={d.crm_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: "var(--brand-ink)", textDecoration: "none", background: "var(--brand-soft)", borderRadius: 5, padding: "2px 7px" }}>
                      #{d.deal_id}
                    </a>
                  ) : <span style={{ color: "var(--faint)" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Легенда */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "var(--muted)" }}>
        {[["#16a34a", "Высокая вероятность"], ["#d97706", "Средняя / требует контроля"], ["#dc2626", "Высокий риск"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" }} />
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Team Section ────────────────────────────────────────────────────────────
function TeamSection() {
  // ── tree data ────────────────────────────────────────────────────────────────
  type N = { id:string; role:string; name:string; color:string; children:N[];
             _x:number; _y:number; _sw:number };

  const mkNode = (id:string, role:string, name:string, color:string, children:N[]=[]): N =>
    ({ id, role, name, color, children, _x:0, _y:0, _sw:0 });

  const C = { founder:"#a78bfa", ceo:"#c4b5fd", mkt:"var(--brand)", sales:"var(--success)",
               ops:"var(--warn)", hr:"#fb923c", fin:"#60a5fa", legal:"var(--danger)", dim:"var(--ink-2)" };

  const tree: N = mkNode("учредители","Учредители","Ольга & Алексей Изосин", C.founder, [
    mkNode("ceo","CEO / Учредитель","Ольга Изосина", C.ceo, [
      mkNode("mkt-dir","Директор по маркетингу","Юлия Побожьева", C.mkt, [
        mkNode("kontm","Контент-маркетолог","Диана (до сентября)", C.mkt),
        mkNode("pr","PR-менеджер","Вакансия", "var(--danger-ink)"),
        mkNode("intm","Интернет-маркетолог","Вакансия (была Юля)", "var(--danger-ink)"),
        mkNode("video","Видеооператор / Рилс","Елена", C.mkt),
        mkNode("target","Таргетологи ТГ","Виктор", C.mkt),
        mkNode("it","IT / Чат-боты","Антон", C.mkt),
        mkNode("direct","Директологи + IT","Сергей, Илья", C.mkt),
        mkNode("design","Дизайнер сайтов","Евгений", C.mkt),
        mkNode("tgpost","ТГ-посевы","Аутсорс", C.dim),
        mkNode("seo","SEO-специалист","Балыкин", C.mkt),
        mkNode("mont","Монтажёр","Елена", C.mkt),
        mkNode("smm","СММ-помощник","Антон", C.mkt),
      ]),
      mkNode("sales-dir","Директор по продажам","Анна Радченко", C.sales, [
        mkNode("rop1","РОП №1","Мария Краузе", C.sales, [
          mkNode("rg-ir","Рук. группы","Ираклий", C.sales, [
            mkNode("br-ir","Брокеры / Лидорубы","—", C.sales),
          ]),
          mkNode("rg-na","Рук. группы","Настя", C.sales),
          mkNode("rg-ru","Рук. группы","Руслан", C.sales),
          mkNode("rg-da","Рук. группы","Данил", C.sales),
        ]),
        mkNode("rop2","РОП №2","Вакансия", "var(--danger-ink)", [
          mkNode("rg2","Рук. группы","Вакансия", "var(--danger-ink)", [
            mkNode("br2","Брокеры","Вакансия", "var(--danger-ink)"),
          ]),
        ]),
        mkNode("okk","ОКК","Грачева Екатерина", C.sales, [
          mkNode("okk-t","Специалист ОКК","Татьяна", C.sales),
          mkNode("okk-y","Специалист ОКК","Юля", C.sales),
        ]),
        mkNode("houses","Отдел продаж домов","ИИ", C.sales, [
          mkNode("br-sa","Брокер","Саша", C.sales),
          mkNode("br-ar","Брокер","Артём", C.sales),
        ]),
        mkNode("newproj","Новые проекты","—", C.dim),
      ]),
      mkNode("ops-dir","Опер. директор + БА СЕО","Ксения Ильина", C.ops, [
        mkNode("supp","Отдел сопровождения","Алла, Таня", C.ops),
        mkNode("admin","Администратор офиса","Ева", C.dim),
        mkNode("hr","HR-специалист","Юля", C.hr, [
          mkNode("rec","Рекрутер","—", C.dim),
        ]),
        mkNode("fin","Финансовый директор","Алексей", C.fin, [
          mkNode("chief-acc","Главный бухгалтер","Аутсорс", C.dim),
          mkNode("acc","Бухгалтер","Антонина", C.fin),
        ]),
        mkNode("legal","Юрист","Сима", C.legal),
      ]),
      mkNode("ba","Бизнес-ассистент","Вакансия", "var(--danger-ink)"),
    ]),
  ]);

  // ── layout algorithm ─────────────────────────────────────────────────────────
  const NW = 120, NH = 68, HPAD = 12, VGAP = 80;

  function layout(node: N, depth: number, offsetX: number): number {
    node._y = depth * (NH + VGAP);
    if (!node.children.length) {
      node._sw = NW + HPAD;
      node._x = offsetX + NW / 2;
      return node._sw;
    }
    let totalW = 0;
    for (const child of node.children) totalW += layout(child, depth + 1, offsetX + totalW);
    node._sw = Math.max(totalW, NW + HPAD);
    node._x = offsetX + totalW / 2;
    return node._sw;
  }
  layout(tree, 0, 0);

  function flatten(node: N, acc: N[] = []): N[] { acc.push(node); node.children.forEach(c => flatten(c, acc)); return acc; }
  function edges(node: N, acc: [N,N][] = []): [N,N][] { node.children.forEach(c => { acc.push([node,c]); edges(c,acc); }); return acc; }

  const allNodes = flatten(tree);
  const allEdges = edges(tree);
  const totalW = tree._sw;
  const maxDepth = Math.max(...allNodes.map(n => Math.round(n._y / (NH + VGAP))));
  const totalH = (maxDepth + 1) * (NH + VGAP);

  // ── zoom/pan state ───────────────────────────────────────────────────────────
  const CTNR_H = typeof window !== "undefined" ? Math.max(500, window.innerHeight - 180) : 700;
  const [zoom, setZoom] = React.useState(0.5);
  const [pan, setPan] = React.useState({ x: 40, y: 32 });
  const dragging = React.useRef<{ startX:number; startY:number; panX:number; panY:number }|null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // auto-fit on first render
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth - 80;
    const ch = CTNR_H - 64;
    const z = Math.min(cw / totalW, ch / totalH, 1);
    const fz = Math.max(0.15, parseFloat(z.toFixed(2)));
    const px = (el.clientWidth - totalW * fz) / 2;
    setZoom(fz);
    setPan({ x: Math.max(16, px), y: 32 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doReset = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth - 80;
    const ch = CTNR_H - 64;
    const z = Math.min(cw / totalW, ch / totalH, 1);
    const fz = Math.max(0.15, parseFloat(z.toFixed(2)));
    const px = (el.clientWidth - totalW * fz) / 2;
    setZoom(fz);
    setPan({ x: Math.max(16, px), y: 32 });
  }, [totalW, totalH]);

  const onWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.1, z - e.deltaY * 0.001)));
  }, []);
  const onMouseDown = React.useCallback((e: React.MouseEvent) => {
    dragging.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);
  const onMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan({ x: dragging.current.panX + e.clientX - dragging.current.startX,
              y: dragging.current.panY + e.clientY - dragging.current.startY });
  }, []);
  const onMouseUp = React.useCallback(() => { dragging.current = null; }, []);

  const isVacancy = (name: string) => name === "Вакансия" || name === "—";

  return (
    <div style={{ margin:"0 -24px", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12, padding:"0 24px" }}>
        <div>
          <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:"var(--ink)" }}>Оргструктура</h2>
          <p style={{ margin:"3px 0 0", color:"var(--muted)", fontSize:13 }}>Oazis Estate · версия 4.0</p>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <button onClick={()=>setZoom(z=>Math.min(2,z+0.1))}
            style={{ padding:"5px 14px", background:"var(--surface)", border:"1px solid var(--border-strong)", borderRadius:6, color:"var(--ink)", cursor:"pointer", fontSize:16, fontWeight:600, boxShadow:"0 1px 3px rgba(0,0,0,.08)" }}>+</button>
          <span style={{ fontSize:12, color:"var(--muted)", minWidth:40, textAlign:"center" }}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.max(0.1,z-0.1))}
            style={{ padding:"5px 14px", background:"var(--surface)", border:"1px solid var(--border-strong)", borderRadius:6, color:"var(--ink)", cursor:"pointer", fontSize:16, fontWeight:600, boxShadow:"0 1px 3px rgba(0,0,0,.08)" }}>−</button>
          <button onClick={doReset}
            style={{ padding:"5px 14px", background:"var(--surface)", border:"1px solid var(--border-strong)", borderRadius:6, color:"var(--ink-2)", cursor:"pointer", fontSize:12, boxShadow:"0 1px 3px rgba(0,0,0,.08)" }}>Подогнать</button>
        </div>
      </div>

      {/* Canvas — full-width, light bg */}
      <div ref={containerRef}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        style={{ position:"relative", height:CTNR_H, background:"#f5f7fa",
          borderTop:"1px solid #e8eaed", borderBottom:"1px solid #e8eaed",
          overflow:"hidden", cursor:"grab", userSelect:"none" }}>

        <div style={{ position:"absolute", left:pan.x, top:pan.y,
          transform:`scale(${zoom})`, transformOrigin:"0 0", width:totalW, height:totalH }}>

          {/* SVG edges */}
          <svg style={{ position:"absolute", top:0, left:0, overflow:"visible", pointerEvents:"none" }}
            width={totalW} height={totalH}>
            {allEdges.map(([p,c], i) => {
              const px2 = p._x, py2 = p._y + NH;
              const cx2 = c._x, cy2 = c._y;
              const my = (py2 + cy2) / 2;
              return (
                <path key={i}
                  d={`M ${px2} ${py2} C ${px2} ${my}, ${cx2} ${my}, ${cx2} ${cy2}`}
                  fill="none" stroke="#c8d0da" strokeWidth={1.5} />
              );
            })}
          </svg>

          {/* Nodes */}
          {allNodes.map(node => {
            const vac = isVacancy(node.name);
            const isFounder = node.id === "учредители";
            const isCeo = node.id === "ceo";
            const accent = isFounder ? C.founder : isCeo ? C.ceo : node.color;
            const nodeBg = isFounder || isCeo ? "#faf8ff" : vac ? "#fff5f5" : "#ffffff";
            const borderClr = vac ? "#fca5a5" : "#e2e8f0";
            return (
              <div key={node.id} style={{
                position:"absolute",
                left: node._x - NW/2,
                top: node._y,
                width: NW,
                minHeight: NH,
                background: nodeBg,
                border: `1px solid ${borderClr}`,
                borderTop: `3px solid ${accent}`,
                borderRadius: 8,
                padding: "8px 10px",
                boxSizing: "border-box",
                display:"flex", flexDirection:"column", justifyContent:"center",
                boxShadow: "0 2px 6px rgba(0,0,0,.07)",
              }}>
                <div style={{ fontSize:9, color:"var(--muted)", lineHeight:1.2, marginBottom:2 }}>
                  {node.role}
                </div>
                <div style={{ fontSize:11, fontWeight:700, lineHeight:1.3,
                  color: vac ? "var(--danger)" : isFounder || isCeo ? "#7c3aed" : "#1e293b" }}>
                  {vac ? "● Вакансия" : node.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ fontSize:11, color:"var(--muted)", marginTop:6, textAlign:"center" }}>
        Колёсико — масштаб · Зажать и потянуть — перемещение
      </p>
    </div>
  );
}

// ── Broker Costs Section ─────────────────────────────────────────────────────
function BrokerCostsSection() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetch(`${API}/api/sales/broker-costs`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  if (loading) return <div style={{ color: "var(--muted)", padding: 40, textAlign: "center" }}>Загрузка…</div>;
  if (!data) return <div style={{ color: "var(--danger)", padding: 40, textAlign: "center" }}>Ошибка загрузки</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Расходы брокеров</h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{data.period}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Выплачено брокерам", value: `${fmt(data.total_paid)} ₽`, sub: "фактически" },
          { label: "Расходы (качество+тех)", value: `${fmt(data.total_cost)} ₽`, sub: "доп. затраты" },
          { label: "Комиссионный доход", value: `${fmt(data.total_commission)} ₽`, sub: "агентские" },
          { label: "ROI", value: `${data.roi > 0 ? "+" : ""}${data.roi}%`, sub: "рентабельность", accent: data.roi > 0 },
        ].map(c => (
          <div key={c.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (c as any).accent ? "var(--success)" : "var(--ink)", letterSpacing: "-0.5px" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["#", "Брокер", "Сделки", "Комиссия", "Выплачено", "Расходы", "% от KV", "Прогноз"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, color: "var(--ink-2)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.brokers.map((b: any, i: number) => (
              <tr key={b.name} style={{ borderBottom: i < data.brokers.length - 1 ? "1px solid var(--border)" : "none" }}>
                <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{b.rank}</td>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{b.name}</td>
                <td style={{ padding: "8px 12px" }}>{b.deals}</td>
                <td style={{ padding: "8px 12px" }}>{b.commission > 0 ? `${fmt(b.commission)} ₽` : "—"}</td>
                <td style={{ padding: "8px 12px" }}>{b.paid_out > 0 ? `${fmt(b.paid_out)} ₽` : "—"}</td>
                <td style={{ padding: "8px 12px", color: "var(--danger)" }}>{b.cost_total > 0 ? `${fmt(b.cost_total)} ₽` : "—"}</td>
                <td style={{ padding: "8px 12px" }}>{b.broker_pct > 0 ? `${b.broker_pct}%` : "—"}</td>
                <td style={{ padding: "8px 12px", color: "var(--brand)" }}>{b.forecast_eff > 0 ? `${fmt(b.forecast_eff)} ₽` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reporting Section ────────────────────────────────────────────────────────
function ReportingSection() {
  return <EfficiencySection />;
}

// ── Эффективность по отделам ────────────────────────────────────────────────
const MONTHS_RU_EFF = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function MethodologyCard() {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Как считается эффективность"
        style={{
          width: 26, height: 26, borderRadius: "50%", border: "1.5px solid #d0d0d0",
          background: open ? "var(--border)" : "var(--surface)", cursor: "pointer",
          fontSize: 13, color: "var(--muted)", fontWeight: 700, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >?</button>

      {open && (
        <div style={{
          position: "absolute", top: 34, right: 0, width: 380, zIndex: 50,
          background: "var(--surface)", border: "1px solid #e8e8e8", borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.10)", padding: "20px 22px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Как считается эффективность</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--muted)", padding: 0 }}>✕</button>
          </div>

          <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.7 }}>
            <p style={{ margin: "0 0 10px" }}>
              <b>Источник данных.</b> Каждый РНП — это Google Таблица с вкладками по месяцам. В самом верху каждой вкладки есть блок <b>«Ключевые метрики»</b> — 4–5 главных показателей отдела на месяц.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <b>Что берётся.</b> Из этого блока берутся столбцы: <b>Метрика / План / Факт / %</b>. Процент уже посчитан в самой таблице авторами РНП (Факт ÷ План × 100). Мы его не пересчитываем — только отображаем.
            </p>
            <p style={{ margin: "0 0 10px" }}>
              <b>Итоговый балл отдела</b> = среднее арифметическое всех % из блока «Ключевые метрики». Показатели с нулевым % (данных ещё нет) в среднее не включаются.
            </p>
            <p style={{ margin: "0 0 14px" }}>
              <b>Пример — ОКК, июнь:</b> скорость взятия лидов 92% + первый звонок 96% + чек-лист 98% + проверено лидов 101% + проверено квалов 94% = <b>среднее 96%</b>.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { color: "var(--success)", bg: "var(--success-soft)", border: "var(--success-border)", label: "≥ 85% — норма" },
                { color: "var(--warn)", bg: "var(--warn-soft)", border: "var(--warn-border)", label: "60–84% — под контролем" },
                { color: "var(--danger)", bg: "var(--danger-soft)", border: "var(--danger-border)", label: "< 60% — требует внимания" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>●</div>
                  <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 85) return "var(--success)";
  if (score >= 60) return "var(--warn)";
  return "var(--danger)";
}
function scoreBg(score: number): string {
  if (score >= 85) return "var(--success-soft)";
  if (score >= 60) return "var(--warn-soft)";
  return "var(--danger-soft)";
}
function scoreBorder(score: number): string {
  if (score >= 85) return "var(--success-border)";
  if (score >= 60) return "var(--warn-border)";
  return "var(--danger-border)";
}
function fmtKpiVal(val: number, isMoney: boolean): string {
  if (isMoney) return fmt(val) + " ₽";
  if (val >= 1000) return fmt(val);
  const s = val.toFixed(val % 1 === 0 ? 0 : 1);
  return s.includes(".") ? s : s;
}

function DeptCard({ dept }: { dept: any }) {
  const [open, setOpen] = React.useState(false);
  const sc = dept.score;
  const color = scoreColor(sc);
  const bg = scoreBg(sc);
  const border = scoreBorder(sc);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", transition: "box-shadow 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.07)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
      {/* Шапка карточки */}
      <div style={{ padding: "18px 20px 14px", borderBottom: open ? "1px solid var(--border)" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{dept.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{dept.name}</span>
          </div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: bg, border: `1px solid ${border}`,
            borderRadius: 20, padding: "4px 12px",
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.5px" }}>{sc > 0 ? sc.toFixed(0) : "—"}</span>
            <span style={{ fontSize: 12, color, fontWeight: 600 }}>%</span>
          </div>
        </div>

        {/* Прогресс-бары ключевых KPI */}
        {dept.error ? (
          <div style={{ fontSize: 12, color: "var(--danger)" }}>Ошибка: {dept.error}</div>
        ) : dept.kpis.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--muted)" }}>Нет данных</div>
        ) : (
          <div>
            {(open ? dept.kpis : dept.kpis.slice(0, 3)).map((kpi: any, i: number) => {
              const barW = Math.min(kpi.pct, 100);
              const c = scoreColor(kpi.pct);
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-2)", marginBottom: 4 }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{kpi.metric}</span>
                    <span style={{ flexShrink: 0, display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ color: "var(--muted)" }}>{fmtKpiVal(kpi.fact, kpi.is_money)}</span>
                      <span style={{ color: "var(--muted)" }}>/</span>
                      <span style={{ color: "var(--muted)" }}>{fmtKpiVal(kpi.plan, kpi.is_money)}</span>
                      <span style={{ fontWeight: 700, color: c, minWidth: 36, textAlign: "right" }}>{kpi.pct > 0 ? kpi.pct.toFixed(0) + "%" : "—"}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barW}%`, background: c, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                </div>
              );
            })}
            {dept.kpis.length > 3 && (
              <button onClick={() => setOpen(!open)} style={{
                marginTop: 4, fontSize: 11, color: "var(--brand)", background: "none", border: "none",
                cursor: "pointer", padding: 0, fontFamily: "inherit", fontWeight: 500,
              }}>
                {open ? "Свернуть" : `Ещё ${dept.kpis.length - 3} показателя`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EfficiencySection() {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [month, setMonth] = React.useState(MONTHS_RU_EFF[new Date().getMonth()]);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/efficiency?month=${encodeURIComponent(month)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Ошибка загрузки"); setLoading(false); });
  }, [month]);

  return (
    <div>
      {/* Заголовок */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Эффективность по отделам</h2>
            <MethodologyCard />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>На основании РНП · данные актуальны на сегодня</p>
        </div>
        {/* Выбор месяца */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {monthsThrough(0).map(m => (
            <button key={m} onClick={() => setMonth(m)} style={{
              padding: "4px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              background: month === m ? "var(--ink)" : "var(--surface)",
              color: month === m ? "var(--surface)" : "var(--ink-2)",
              border: `1px solid ${month === m ? "var(--ink)" : "var(--border-strong)"}`,
              fontWeight: month === m ? 600 : 400,
            }}>{m}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Загружаю данные из РНП…</div>
      )}
      {error && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--danger)", fontSize: 13 }}>{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Сводная строка */}
          {(() => {
            const depts = data.departments.filter((d: any) => d.score > 0);
            const avg = depts.length > 0 ? Math.round(depts.reduce((s: number, d: any) => s + d.score, 0) / depts.length) : 0;
            const color = scoreColor(avg);
            const best = [...data.departments].sort((a: any, b: any) => b.score - a.score)[0];
            const worst = [...data.departments].filter((d: any) => d.score > 0).sort((a: any, b: any) => a.score - b.score)[0];
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                <div style={{ background: scoreBg(avg), border: `1px solid ${scoreBorder(avg)}`, borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Среднее по компании</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-1px" }}>{avg}%</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{data.month}</div>
                </div>
                <div style={{ background: "var(--success-soft)", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Лидер</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>{best?.icon} {best?.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{best?.score?.toFixed(0)}% выполнения</div>
                </div>
                <div style={{ background: "var(--danger-soft)", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Требует внимания</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>{worst?.icon} {worst?.name}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{worst?.score?.toFixed(0)}% выполнения</div>
                </div>
              </div>
            );
          })()}

          {/* Сетка карточек отделов */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[...data.departments]
              .sort((a: any, b: any) => b.score - a.score)
              .map((dept: any) => (
                <DeptCard key={dept.key} dept={dept} />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Эффективность РНП (по месяцу + по году) ──────────────────────────────────
function RnpEfficiencySection() {
  const [view, setView] = React.useState<"month" | "year">("month");
  const [month, setMonth] = React.useState(MONTHS_RU_EFF[new Date().getMonth()]);
  const [monthData, setMonthData] = React.useState<any>(null);
  const [yearData, setYearData] = React.useState<any>(null);
  const [loadingMonth, setLoadingMonth] = React.useState(false);
  const [loadingYear, setLoadingYear] = React.useState(false);

  React.useEffect(() => {
    if (view !== "month") return;
    setLoadingMonth(true);
    fetch(`${API}/api/efficiency?month=${encodeURIComponent(month)}`)
      .then(r => r.json())
      .then(d => { setMonthData(d); setLoadingMonth(false); })
      .catch(() => setLoadingMonth(false));
  }, [view, month]);

  React.useEffect(() => {
    if (view !== "year" || yearData) return;
    setLoadingYear(true);
    fetch(`${API}/api/efficiency/year`)
      .then(r => r.json())
      .then(d => { setYearData(d); setLoadingYear(false); })
      .catch(() => setLoadingYear(false));
  }, [view]);

  return (
    <div>
      {/* Заголовок + переключатель */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Эффективность компании</h2>
            <MethodologyCard />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>Актуальные данные из всех РНП-таблиц</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--border)", borderRadius: 10, padding: 4 }}>
          {(["month", "year"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              background: view === v ? "var(--surface)" : "transparent",
              color: view === v ? "var(--ink)" : "var(--muted)",
              border: "none",
              fontWeight: view === v ? 600 : 400,
              boxShadow: view === v ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.15s",
            }}>
              {v === "month" ? "По месяцу" : "По году"}
            </button>
          ))}
        </div>
      </div>

      {/* ── ВИД: ПО МЕСЯЦУ ── */}
      {view === "month" && (
        <>
          {/* Выбор месяца */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
            {monthsThrough(0).map(m => (
              <button key={m} onClick={() => setMonth(m)} style={{
                padding: "4px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                background: month === m ? "var(--ink)" : "var(--surface)",
                color: month === m ? "var(--surface)" : "var(--ink-2)",
                border: `1px solid ${month === m ? "var(--ink)" : "var(--border-strong)"}`,
                fontWeight: month === m ? 600 : 400,
              }}>{m}</button>
            ))}
          </div>
          {loadingMonth && (
            <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Загружаю данные…</div>
          )}
          {monthData && !loadingMonth && (
            <>
              {/* Сводные метрики */}
              {(() => {
                const depts = monthData.departments.filter((d: any) => d.score > 0);
                const avg = depts.length > 0 ? Math.round(depts.reduce((s: number, d: any) => s + d.score, 0) / depts.length) : 0;
                const best = [...monthData.departments].sort((a: any, b: any) => b.score - a.score)[0];
                const worst = [...monthData.departments].filter((d: any) => d.score > 0).sort((a: any, b: any) => a.score - b.score)[0];
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                    <div style={{ background: scoreBg(avg), border: `1px solid ${scoreBorder(avg)}`, borderRadius: 12, padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Среднее по компании</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(avg), letterSpacing: "-1px" }}>{avg}%</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{monthData.month}</div>
                    </div>
                    <div style={{ background: "var(--success-soft)", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Лидер</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>{best?.icon} {best?.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{best?.score?.toFixed(0)}% выполнения</div>
                    </div>
                    <div style={{ background: "var(--danger-soft)", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Требует внимания</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>{worst?.icon} {worst?.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{worst?.score?.toFixed(0)}% выполнения</div>
                    </div>
                  </div>
                );
              })()}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[...monthData.departments]
                  .sort((a: any, b: any) => b.score - a.score)
                  .map((dept: any) => <DeptCard key={dept.key} dept={dept} />)}
              </div>
            </>
          )}
        </>
      )}

      {/* ── ВИД: ПО ГОДУ ── */}
      {view === "year" && (
        <>
          {loadingYear && (
            <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Загружаю данные за год… это может занять 15–20 секунд</div>
          )}
          {yearData && !loadingYear && (
            <>
              {/* Годовые итоги по отделам */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
                {[...yearData.dept_yearly].sort((a: any, b: any) => b.avg_score - a.avg_score).map((d: any) => (
                  <div key={d.key} style={{
                    background: scoreBg(d.avg_score), border: `1px solid ${scoreBorder(d.avg_score)}`,
                    borderRadius: 12, padding: "16px 18px",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginBottom: 6 }}>{d.icon} {d.name}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(d.avg_score), letterSpacing: "-1px" }}>
                      {d.avg_score > 0 ? d.avg_score.toFixed(0) : "—"}%
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>ср. за {yearData.year}</div>
                  </div>
                ))}
              </div>

              {/* Тепловая карта: строки = месяцы, колонки = отделы */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Динамика по месяцам</span>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--success)", display: "inline-block" }} />≥85%</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--warn)", display: "inline-block" }} />60–84%</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--danger)", display: "inline-block" }} />&lt;60%</span>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)" }}>
                        <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid var(--border)", minWidth: 100 }}>Месяц</th>
                        {yearData.months[0]?.departments.map((d: any) => (
                          <th key={d.key} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "center", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                            {d.icon} {d.name}
                          </th>
                        ))}
                        <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "center", borderBottom: "1px solid var(--border)" }}>Среднее</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearData.months.map((row: any, i: number) => (
                        <tr key={row.month} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface)" : "var(--surface-2)" }}>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{row.month}</td>
                          {row.departments.map((d: any) => (
                            <td key={d.key} style={{ padding: "10px 16px", textAlign: "center" }}>
                              {d.score > 0 ? (
                                <span style={{
                                  display: "inline-block", minWidth: 52, padding: "4px 10px",
                                  borderRadius: 20, fontSize: 13, fontWeight: 700,
                                  background: scoreBg(d.score),
                                  color: scoreColor(d.score),
                                  border: `1px solid ${scoreBorder(d.score)}`,
                                }}>{d.score.toFixed(0)}%</span>
                              ) : (
                                <span style={{ color: "#ddd", fontSize: 12 }}>—</span>
                              )}
                            </td>
                          ))}
                          <td style={{ padding: "10px 16px", textAlign: "center" }}>
                            {row.avg_score > 0 ? (
                              <span style={{
                                display: "inline-block", minWidth: 52, padding: "4px 10px",
                                borderRadius: 20, fontSize: 13, fontWeight: 800,
                                background: scoreBg(row.avg_score),
                                color: scoreColor(row.avg_score),
                                border: `1px solid ${scoreBorder(row.avg_score)}`,
                              }}>{row.avg_score.toFixed(0)}%</span>
                            ) : (
                              <span style={{ color: "#ddd", fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Market Section ──────────────────────────────────────────────────────────
function MarketSection() {
  const [tab, setTab] = React.useState<"overview"|"traffic"|"tech"|"seo"|"social">("overview");
  const [seoData, setSeoData] = React.useState<any[]>([]);
  const [socData, setSocData] = React.useState<any[]>([]);
  const [texts, setTexts] = React.useState<{traffic:string;tech:string;seo:string}>({traffic:"",tech:"",seo:""});
  const [openIdx, setOpenIdx] = React.useState<number|null>(null);

  React.useEffect(() => {
    import("./market-data").then(m => {
      setSeoData([...m.SEO_COMPANIES] as any[]);
      setSocData([...m.SOC_COMPANIES] as any[]);
      setTexts({traffic: m.TRAFFIC_TEXT, tech: m.TECH_TEXT, seo: m.SEO_TEXT});
    });
  }, []);

  const tabs = [
    {key:"overview", label:"Обзор трафика"},
    {key:"traffic",  label:"Digital-маркетинг"},
    {key:"tech",     label:"Технологии"},
    {key:"seo",      label:"SEO-анализ"},
    {key:"social",   label:"Соцсети"},
  ] as const;

  const fmtNum = (v:any) => {
    if(v===null||v===undefined||v==="None"||v==="") return "—";
    const n = parseFloat(String(v));
    if(isNaN(n)) return "—";
    if(n>=1000000) return (n/1000000).toFixed(1)+"М";
    if(n>=1000) return Math.round(n).toLocaleString("ru-RU");
    return String(Math.round(n));
  };

  const textParagraphs = (t:string) =>
    t.split(/\n{2,}/).map((p,i)=>(
      <p key={i} style={{margin:"0 0 12px",lineHeight:1.65,whiteSpace:"pre-wrap",fontSize:13}}>{p.trim()}</p>
    ));

  // Split SEO text into per-company sections using "N. Name —" pattern
  const seoSections = React.useMemo(()=>{
    if(!texts.seo) return [];
    const raw = texts.seo;
    const COMPANIES = [
      "1. Vincent Realty","2. АСКА","3. Atlas Realty","4. Integrity Estate",
      "5. Golden Brown","6. Rivera Sochi","7. Rost Sochi","8. Sochi Group",
      "9. Estadel","10. EliteSochi","11. GRC","12. Onyx Realty",
      "13. Kalinka Realty","14. Этажи Сочи","15. ProStore","16. Rich Property",
      "17. Whitewill","18. KEEP Moscow","19. Pleada","20. PropNex",
    ];
    const escaped = COMPANIES.map((k:string)=>k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
    const splitRe = new RegExp(`(?=${escaped.join("|")})`);
    const parts = raw.split(splitRe);
    const intro = parts[0]?.trim() || "";
    const companies = parts.slice(1).map((s:string)=>{
      const t = s.trim();
      const kw = COMPANIES.find((k:string)=>t.startsWith(k))||"";
      const title = kw.replace(/^\d+\.\s*/,"").trim();
      const body = t.slice(kw.length).trim();
      return {header: title, body, idx: COMPANIES.indexOf(kw)};
    }).filter((s:{header:string})=>s.header);
    return [{header:"__intro__", body:intro, idx:-1}, ...companies];
  },[texts.seo]);

  const BG     = "var(--surface-2)";
  const CARD   = "#ffffff";
  const BORDER = "var(--border)";
  const TEXT   = "var(--ink)";
  const MUTED  = "var(--muted)";
  const ACCENT = "#7aa4d4";
  const UP     = "var(--success)";
  const DOWN   = "var(--danger)";

  return (
    <div style={{padding:"0 0 40px", background: BG, minHeight:"100%"}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:700,color:TEXT}}>Анализ рынка</h2>
        <p style={{margin:"4px 0 0",color:MUTED,fontSize:13}}>Конкурентная аналитика · SEO · Трафик · Технологии · Соцсети</p>
      </div>

      {/* Tab nav */}
      <div style={{display:"flex",gap:4,marginBottom:24,borderBottom:`2px solid ${BORDER}`,paddingBottom:0}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            style={{padding:"8px 16px",fontSize:13,fontWeight:tab===t.key?600:400,
              background:"none",border:"none",cursor:"pointer",
              color:tab===t.key?ACCENT:MUTED,
              borderBottom:tab===t.key?`2px solid ${ACCENT}`:"2px solid transparent",
              marginBottom:-2, transition:"color 0.15s", fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW — трафик таблица */}
      {tab==="overview" && (
        <div>
          <div style={{marginBottom:12,color:MUTED,fontSize:12}}>
            Данные SimilarWeb · PR-CY · Keys.so · фев–апр 2026
          </div>
          <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${BORDER}`}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"var(--surface-2)",color:MUTED,textAlign:"left"}}>
                  {["Компания","Сайт","Визитов (3 мес)","Динамика","Mobile %","ИКС","Скорость D/M","Top-10","Аналитика","Стек"].map(h=>(
                    <th key={h} style={{padding:"10px 12px",borderBottom:`1px solid ${BORDER}`,whiteSpace:"nowrap",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.4px"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seoData.map((c,i)=>{
                  const dyn = parseFloat(String(c.dynamics||"0").replace("%",""));
                  const dynColor = dyn>0? UP : dyn<0? DOWN : MUTED;
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${BORDER}`,background: i%2===0? CARD :"var(--surface-2)"}}>
                      <td style={{padding:"8px 12px",color:TEXT,fontWeight:600,whiteSpace:"nowrap"}}>{c.name}</td>
                      <td style={{padding:"8px 12px"}}>
                        <a href={`https://${c.site}`} target="_blank" rel="noreferrer"
                          style={{color:ACCENT,textDecoration:"none",fontSize:12}}>{c.site}</a>
                      </td>
                      <td style={{padding:"8px 12px",color:TEXT,textAlign:"right",fontWeight:500}}>{fmtNum(c.visits_3mo)}</td>
                      <td style={{padding:"8px 12px",color:dynColor,textAlign:"right",fontWeight:600}}>{c.dynamics||"—"}</td>
                      <td style={{padding:"8px 12px",color:TEXT,textAlign:"right"}}>{c.mobile_pct!=null&&c.mobile_pct!=""?parseFloat(c.mobile_pct).toFixed(0)+"%":"—"}</td>
                      <td style={{padding:"8px 12px",color:TEXT,textAlign:"right"}}>{fmtNum(c.iks)}</td>
                      <td style={{padding:"8px 12px",color:TEXT,whiteSpace:"nowrap"}}>{c.desktop_speed||"—"}/{c.mobile_speed||"—"}</td>
                      <td style={{padding:"8px 12px",color:TEXT,textAlign:"right"}}>{fmtNum(c.top10)}</td>
                      <td style={{padding:"8px 12px",color:MUTED,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.analytics||"—"}</td>
                      <td style={{padding:"8px 12px",color:MUTED,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.framework||c.cms||"—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TRAFFIC — карточки по компаниям */}
      {tab==="traffic" && (
        <div style={{maxWidth:860}}>
          {(() => {
            const raw = texts.traffic;
            if (!raw) return <div style={{color:MUTED}}>Загрузка…</div>;
            const CHANNELS = "Organic|Direct|Display|Referrals|Email|Search Paid|Social Organic|Social Paid|Gen AI|Paid";
            const splitRe = new RegExp(`(?=(?:[A-ZА-ЯЁ][a-zA-Zа-яА-ЯЁ\\s]{1,30}?)\\s+(?:${CHANNELS}): \\d)`);
            const blocks = raw.split(splitRe).map((s:string) => s.trim()).filter((s:string) => s.length > 20);
            const intro = blocks[0] && !blocks[0].match(/\d+[,.]?\d*%/) ? blocks.shift() : null;
            return (
              <>
                {intro && (
                  <div style={{marginBottom:20,padding:"12px 16px",background:"var(--surface-2)",borderRadius:10,border:`1px solid ${BORDER}`,fontSize:13,color:"var(--ink)",lineHeight:1.65}}>
                    {(intro as string).replace(/^Digital-marketing\s*/i,"").replace(/^Что структура трафика говорит о каждом бизнесе, гипотезы \(Цифры верифицированы\)\s*/,"")}
                  </div>
                )}
                {(blocks as string[]).map((block:string, i:number) => {
                  const statsRe = new RegExp(`^(.+?)\\s+((?:(?:${CHANNELS}): [\\d,.]+%(?:\\s*·\\s*)?)+)`);
                  const m = block.match(statsRe);
                  if (!m) return <div key={i} style={{marginBottom:12,fontSize:13,color:"var(--ink)",lineHeight:1.65}}>{block}</div>;
                  const companyName = m[1].trim();
                  const statsStr = m[2].trim();
                  const analysis = block.slice(m[0].length).trim();
                  const statItems = statsStr.split(/\s*·\s*/).map((s:string) => {
                    const [label, val] = s.split(/:\s*/);
                    return { label: label?.trim(), val: val?.trim() };
                  }).filter((s:{label?:string,val?:string}) => s.label && s.val);
                  return (
                    <div key={i} style={{marginBottom:10,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden",background:CARD}}>
                      <div style={{background:"var(--surface-2)",padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:4,height:28,borderRadius:2,background:"var(--ink-2)",flexShrink:0}}/>
                        <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{companyName}</div>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"12px 16px",borderBottom:`1px solid ${BORDER}`}}>
                        {statItems.map((s:{label?:string,val?:string},j:number) => {
                          const v = parseFloat((s.val||"").replace(",","."));
                          const isHigh = ["Organic","Direct"].includes(s.label||"") && v > 30;
                          return (
                            <div key={j} style={{background:isHigh?"var(--brand-soft)":"var(--surface-2)",border:`1px solid ${isHigh?"#c5d8f0":BORDER}`,borderRadius:8,padding:"4px 10px",fontSize:12}}>
                              <span style={{color:MUTED,marginRight:4}}>{s.label}:</span>
                              <span style={{fontWeight:700,color:isHigh?ACCENT:TEXT}}>{s.val}</span>
                            </div>
                          );
                        })}
                      </div>
                      {analysis && <div style={{padding:"12px 16px",fontSize:13,color:"var(--ink)",lineHeight:1.72}}>{analysis}</div>}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {/* TECH — карточки по инструментам */}
      {tab==="tech" && (
        <div style={{maxWidth:860}}>
          {(() => {
            const raw = texts.tech;
            if (!raw) return <div style={{color:MUTED}}>Загрузка…</div>;
            const TECH_KEYWORDS = [
              "Сквозная аналитика","Пиксели ретаргетинга","Facebook / Instagram Pixel",
              "VK Pixel","TikTok Pixel","Microsoft Clarity","Getsitecontrol",
              "Google Tag Manager","Tilda и органический","Технологический стек как косвенный сигнал",
              "Telegram-боты","WhatsApp и атрибуция","Инфраструктура и CDN",
              "Международный бенчмарк","Итоговая таблица",
            ];
            const escaped = TECH_KEYWORDS.map((k:string) => k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
            const splitRe = new RegExp(`(?=${escaped.join("|")})`);
            const allBlocks = raw.split(splitRe).map((s:string) => s.trim()).filter((s:string) => s.length > 10);
            const firstIsIntro = !TECH_KEYWORDS.some((k:string) => allBlocks[0]?.startsWith(k));
            const intro = firstIsIntro ? allBlocks.shift() : null;
            const ICONS: Record<string,string> = {
              "Сквозная аналитика":"📊","Пиксели ретаргетинга":"🎯","Facebook / Instagram Pixel":"📘",
              "VK Pixel":"🔵","TikTok Pixel":"🎵","Microsoft Clarity":"🔍","Getsitecontrol":"⚡",
              "Google Tag Manager":"🏷","Tilda и органический":"🌿","Технологический стек как косвенный сигнал":"⚙️",
              "Telegram-боты":"🤖","WhatsApp и атрибуция":"💬","Инфраструктура и CDN":"🛡",
              "Международный бенчмарк":"🌐","Итоговая таблица":"📋",
            };
            return (
              <>
                {intro && (
                  <div style={{marginBottom:16,padding:"12px 16px",background:"var(--surface-2)",borderRadius:10,border:`1px solid ${BORDER}`,fontSize:13,color:"var(--ink)",lineHeight:1.65}}>
                    {(intro as string).replace(/^Технологии на сайтах\s*/,"")}
                  </div>
                )}
                {(allBlocks as string[]).map((block:string, i:number) => {
                  const kw = TECH_KEYWORDS.find((k:string) => block.startsWith(k)) || "";
                  const body = block.slice(kw.length).trim();
                  const icon = ICONS[kw] || "•";
                  return (
                    <div key={i} style={{marginBottom:8,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden",background:CARD}}>
                      <div style={{background:"var(--surface-2)",padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
                        <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{kw}</div>
                      </div>
                      <div style={{padding:"14px 18px",fontSize:13,color:"var(--ink)",lineHeight:1.75,whiteSpace:"pre-wrap"}}>
                        {body}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      )}

      {/* SEO — аккордеоны по компаниям */}
      {tab==="seo" && (
        <div style={{maxWidth:860}}>
          {seoSections.length===0 && <div style={{color:MUTED}}>Загрузка…</div>}
          {seoSections.map((s,i)=>{
            if(s.header==="__intro__") return (
              <div key={i} style={{marginBottom:16}}>
                {/* Методология */}
                <div style={{marginBottom:12,padding:"12px 16px",background:"var(--surface-2)",borderRadius:10,border:`1px solid ${BORDER}`,fontSize:13,color:"var(--ink)",lineHeight:1.65}}>
                  {s.body.replace(/^Гипотезы по SEO\s*/,"").split(/(?=Сводная таблица)/)[0].trim()}
                </div>
                {/* Легенда групп */}
                <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                  {[["🔴","Прямые конкуренты Сочи"],["🟡","Косвенные конкуренты"],["⚪","Ориентиры / непрямые"]].map(([dot,label])=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:6,background:CARD,border:`1px solid ${BORDER}`,borderRadius:8,padding:"5px 12px",fontSize:12,color:TEXT}}>
                      <span>{dot}</span><span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
            const competitionDot = s.body.match(/🔴|🟡|⚪/)?.[0] || "";
            const domainMatch = s.body.match(/—\s*([\w.-]+\.(?:ru|com|pro|estate|moscow))/);
            const domain = domainMatch?.[1] || "";
            return (
              <div key={i} style={{marginBottom:6,border:`1px solid ${BORDER}`,borderRadius:10,overflow:"hidden"}}>
                <button onClick={()=>setOpenIdx(openIdx===i?null:i)}
                  style={{width:"100%",textAlign:"left",padding:"12px 16px",
                    background:openIdx===i?"var(--surface-2)":CARD,
                    border:"none",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",
                    fontFamily:"inherit",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                    <span style={{fontSize:16,flexShrink:0}}>{competitionDot||"•"}</span>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:TEXT}}>{s.header}</div>
                      {domain && <div style={{fontSize:11,color:MUTED,marginTop:1}}>{domain}</div>}
                    </div>
                  </div>
                  <span style={{color:MUTED,fontSize:13,flexShrink:0}}>{openIdx===i?"▲":"▼"}</span>
                </button>
                {openIdx===i && (
                  <div style={{padding:"14px 18px",background:"var(--surface-2)",fontSize:13,lineHeight:1.75,
                    color:"var(--ink)",maxHeight:600,overflowY:"auto",borderTop:`1px solid ${BORDER}`}}>
                    {s.body.replace(/^—\s*[\w.-]+\.(?:ru|com|pro|estate|moscow)\s*/,"").split(/(?=[A-ZА-ЯЁ][a-zа-яё]+:)/g).map((chunk:string,j:number)=>{
                      const isSubheader = chunk.length < 120 && chunk.endsWith(":");
                      return isSubheader
                        ? <div key={j} style={{fontWeight:700,color:TEXT,marginTop:10,marginBottom:2}}>{chunk}</div>
                        : <p key={j} style={{margin:"0 0 8px",lineHeight:1.75}}>{chunk}</p>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SOCIAL — таблица */}
      {tab==="social" && (
        <div style={{overflowX:"auto",borderRadius:12,border:`1px solid ${BORDER}`}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:"var(--surface-2)",textAlign:"left"}}>
                {["Компания","TG канал","TG контакт","ВКонтакте","YouTube","Instagram","Rutube","Дзен","ОК","WhatsApp","Facebook","TikTok","LinkedIn"].map(h=>(
                  <th key={h} style={{padding:"10px 12px",borderBottom:`1px solid ${BORDER}`,whiteSpace:"nowrap",color:MUTED,fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:"0.4px"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {socData.map((c,i)=>{
                const link = (url:string) => url&&url!=="None"
                  ? <a href={url.startsWith("http")?url:`https://${url}`} target="_blank" rel="noreferrer"
                      style={{color:UP,textDecoration:"none",fontWeight:700}}>✓</a>
                  : <span style={{color:BORDER}}>—</span>;
                return (
                  <tr key={i} style={{borderBottom:`1px solid ${BORDER}`,background:i%2===0?CARD:"var(--surface-2)"}}>
                    <td style={{padding:"8px 12px",color:TEXT,fontWeight:600,whiteSpace:"nowrap"}}>{c.name}</td>
                    {[c.telegram_channel,c.telegram_contact,c.vk,c.youtube,c.instagram,c.rutube,c.dzen,c.ok,c.whatsapp,c.facebook,c.tiktok,c.linkedin].map((url,j)=>(
                      <td key={j} style={{padding:"8px 12px",textAlign:"center"}}>{link(url)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Legal Section ─────────────────────────────────────────────────────────────
function LegalSection() {
  const [openCase, setOpenCase] = React.useState(true);

  const BG   = "var(--surface-2)";
  const CARD = "#ffffff";
  const BORDER = "var(--border)";
  const TEXT  = "var(--ink)";
  const MUTED = "var(--muted)";
  const HIGH  = "var(--danger)";
  const MED   = "#d97706";
  const LOW   = "var(--success)";

  const risks = [
    {
      label: "Дата ДС к АД не проставлена",
      desc: "В Дополнительном соглашении № 1 к АД № 2-4258 дата подписания не указана. Риск признания соглашения незаключённым, невозможность установить момент вступления в силу условия о конфиденциальности и новой ставке вознаграждения.",
      severity: "high",
    },
    {
      label: "Расхождение адреса объекта",
      desc: "В АД указан адрес ул. Ленина, д. 219Л; в Отчёте-Акте — д. 219а. Несоответствие адреса может поставить под сомнение идентификацию объекта и действительность расчётов по конкретной сделке.",
      severity: "high",
    },
    {
      label: "ДКП будущей недвижимости в обход 214-ФЗ",
      desc: "Основная сделка с покупателем Бражниковым оформлена как ДКП будущей недвижимости. Схема не даёт гарантий 214-ФЗ: нет регистрации договора, нет эскроу, нет залога. При банкротстве продавца требования удовлетворяются в последнюю очередь без выплат из фонда развития территорий.",
      severity: "high",
    },
    {
      label: "Вознаграждение 20% — выше рынка",
      desc: "ДС № 1 к АД расширяет диапазон вознаграждения до 20%. Фактически зафиксировано ~20% (6 445 136 ₽ от ~32 млн). При возникновении спора другая сторона может оспорить размер как несоразмерный или злоупотребление правом.",
      severity: "medium",
    },
    {
      label: "Конфиденциальность 5 лет",
      desc: "Новый п. 5.6 АД устанавливает конфиденциальность в течение срока договора + 5 лет после расторжения. Oazis несёт реальный риск ответственности за разглашение данных о клиентах, условиях и финансах.",
      severity: "medium",
    },
    {
      label: "Остаток вознаграждения не поступил",
      desc: "2 899 341 ₽ должны быть оплачены в течение 8 банковских дней с даты утверждения Отчёта-Акта. Срок и факт утверждения Отчёта принципалом документально не зафиксированы — дата утверждения не указана.",
      severity: "medium",
    },
    {
      label: "Риск двойной продажи объекта",
      desc: "ДКП будущей недвижимости не подлежит госрегистрации. Принципал вправе продать тот же объект другому лицу. Oazis как агент может быть привлечён к претензиям покупателя.",
      severity: "medium",
    },
  ] as const;

  const sColor = (s: string) => s === "high" ? HIGH : s === "medium" ? MED : LOW;

  return (
    <div style={{ padding: "0 0 40px", background: BG, minHeight: "100%" }}>

      {/* Заголовок */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT }}>Юридические риски</h2>
        <p style={{ margin: "4px 0 0", color: MUTED, fontSize: 13 }}>Систематизация по объектам</p>
      </div>

      {/* Объект: Волна Резидентс */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 4, height: 36, borderRadius: 2, background: "var(--ink-2)" }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>Волна Резидентс</div>
            <div style={{ fontSize: 12, color: MUTED }}>Volna Residens · ул. Ленина 219Л, Адлер, Сочи</div>
          </div>
        </div>

        {/* Карточка кейса */}
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", background: CARD }}>

          {/* Шапка кейса */}
          <button onClick={() => setOpenCase(o => !o)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", background: "var(--surface-2)", border: "none", cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18 }}>⚖️</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>АД № 2-4258 — Бражников Г.В.</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>февраль – март 2026 · ИП Греков (Принципал) → ИП Изосин (Агент)</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "var(--warn-ink)", fontWeight: 600 }}>
                Остаток не получен
              </span>
              <span style={{ color: MUTED, fontSize: 14 }}>{openCase ? "▲" : "▼"}</span>
            </div>
          </button>

          {openCase && (
            <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Суть */}
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.7, background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px" }}>
                ИП Изосин (Агент) заключил АД № 2-4258 от 25.02.2026 с ИП Греков В.Е. (Принципал), действующим как посредник в интересах застройщика ООО «СЗ Файв Старс». Объект — нежилое помещение по адресу ул. Ленина 219Л, Адлерский р-н, Сочи. Покупатель — Бражников Г.В. Основная сделка с покупателем оформлена как ДКП будущей недвижимости — схема в обход 214-ФЗ. ДС № 1 к АД расширило ставку вознаграждения до 20% и добавило обязательство конфиденциальности на 5 лет.
              </div>

              {/* Финансы */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
                {[
                  { label: "Стоимость объекта",      value: "~32 234 500 ₽", color: TEXT },
                  { label: "Вознаграждение агента",   value: "6 445 136 ₽",  sub: "≈20% + НДС 7%", color: TEXT },
                  { label: "Выплачено 02.03.2026",    value: "3 545 795 ₽",  color: LOW },
                  { label: "Остаток к получению",     value: "2 899 341 ₽",  color: MED },
                ].map(c => (
                  <div key={c.label} style={{ background: "var(--surface-2)", borderRadius: 8, padding: "12px 14px", border: `1px solid ${BORDER}` }}>
                    <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{c.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c.color }}>{c.value}</div>
                    {(c as any).sub && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{(c as any).sub}</div>}
                  </div>
                ))}
              </div>

              {/* Риски */}
              <div>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
                  Зафиксированные риски ({risks.filter(r => r.severity === "high").length} критичных)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {risks.map(r => (
                    <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--surface-2)", borderRadius: 8, padding: "10px 14px", border: `1px solid ${BORDER}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: sColor(r.severity), flexShrink: 0, marginTop: 5 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{r.label}</div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.55 }}>{r.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Что сделано */}
              <div>
                <div style={{ fontSize: 11, color: MUTED, marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Статус</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[
                    { text: "АД № 2-4258 и ДС № 1 к нему подписаны ЭП обеими сторонами", done: true },
                    { text: "Отчёт-Акт от 27.02.2026 подписан ЭП (Изосин — 27.02, Греков — 28.02)", done: true },
                    { text: "Первая часть вознаграждения 3 545 795 ₽ получена 02.03.2026", done: true },
                    { text: "Остаток 2 899 341 ₽ — дата утверждения Отчёта Принципалом не зафиксирована, срок выплаты не определён", done: false },
                    { text: "Дата в ДС к АД не проставлена — требует исправления", done: false },
                  ].map(s => (
                    <div key={s.text} style={{ fontSize: 13, color: s.done ? "var(--ink)" : MED, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: s.done ? LOW : MED, flexShrink: 0 }}>{s.done ? "✓" : "!"}</span>
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Вывод */}
              <div style={{ background: "var(--brand-soft)", borderRadius: 8, padding: "12px 14px", borderLeft: "3px solid #7aa4d4" }}>
                <div style={{ fontSize: 12, color: "var(--ink-2)", fontWeight: 600, marginBottom: 6 }}>Вывод и рекомендации</div>
                <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.65 }}>
                  Зафиксировать дату утверждения Отчёта-Акта у Принципала и запустить отсчёт 8 банковских дней для остатка. Простановить дату в ДС № 1 к АД. В будущих сделках по схеме ДКП будущей недвижимости — не допускать несовпадения адреса в АД и Отчёте-Акте, фиксировать дистанцию Oazis от основной сделки с покупателем.
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Легенда рисков */}
      <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
        {[["var(--danger)", "Критичный риск"], ["#d97706", "Средний риск"], ["var(--success)", "Выполнено"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: 12, color: MUTED }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Юр. процессы — бэклог юридических вопросов на разбор ────────────────────────
type LegalQuestion = {
  id: number;
  title: string;
  category: string;
  status: string;
  notes: string | null;
  created_at: string | null;
  done_at: string | null;
};

const LP_CATEGORIES: { key: string; label: string }[] = [
  { key: "clients",       label: "Клиенты / сделки" },
  { key: "personal_data", label: "Кадры" },
  { key: "hr",            label: "HR" },
  { key: "product",       label: "Продукт" },
  { key: "agency",          label: "Агентские" },
  { key: "agency_contract", label: "Агентские договора" },
  { key: "other",           label: "Прочее" },
];

const LP_STATUSES: { key: string; label: string }[] = [
  { key: "new",         label: "Новый" },
  { key: "in_progress", label: "В работе" },
  { key: "to_lawyer",   label: "К юристу" },
  { key: "done",        label: "Закрыт" },
];

function LegalProcessesSection() {
  const BG   = "var(--surface-2)";
  const CARD = "#ffffff";
  const BORDER = "var(--border)";
  const TEXT  = "var(--ink)";
  const MUTED = "var(--muted)";
  const ACCENT = "var(--ink-2)";

  const [items, setItems] = React.useState<LegalQuestion[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<string>("all");
  const [adding, setAdding] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newCategory, setNewCategory] = React.useState("other");
  const [newNotes, setNewNotes] = React.useState("");
  const [openNotes, setOpenNotes] = React.useState<Record<number, boolean>>({});

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/legal/questions`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const catLabel = (k: string) => LP_CATEGORIES.find(c => c.key === k)?.label || k;

  const createQuestion = async () => {
    if (!newTitle.trim()) return;
    await fetch(`${API}/api/legal/questions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), category: newCategory, notes: newNotes.trim() || null }),
    });
    setNewTitle(""); setNewCategory("other"); setNewNotes(""); setAdding(false);
    load();
  };

  const patchQuestion = async (id: number, patch: Partial<LegalQuestion>) => {
    setItems(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x));
    await fetch(`${API}/api/legal/questions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  };

  const deleteQuestion = async (id: number) => {
    setItems(prev => prev.filter(x => x.id !== id));
    await fetch(`${API}/api/legal/questions/${id}`, { method: "DELETE" });
  };

  const filtered = (filter === "all" ? items : items.filter(x => x.category === filter))
    .slice()
    .sort((a, b) => {
      // Закрытые — в конец
      const ad = a.status === "done" ? 1 : 0;
      const bd = b.status === "done" ? 1 : 0;
      if (ad !== bd) return ad - bd;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer",
    border: `1px solid ${active ? ACCENT : BORDER}`,
    background: active ? ACCENT : CARD,
    color: active ? "var(--surface)" : TEXT, whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: "0 0 40px", background: BG, minHeight: "100%" }}>
      {/* Заголовок */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: TEXT }}>Юр. процессы</h2>
          <p style={{ margin: "4px 0 0", color: MUTED, fontSize: 13 }}>Вопросы на разбор — статус, категория, заметки</p>
        </div>
        <button onClick={() => setAdding(a => !a)} style={{
          padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          background: ACCENT, color: "var(--surface)", fontSize: 13, fontWeight: 600,
        }}>+ Вопрос</button>
      </div>

      {/* Форма добавления */}
      {adding && (
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, background: CARD, padding: 16, marginBottom: 20 }}>
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Формулировка вопроса…" autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 14, color: TEXT, marginBottom: 10, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, color: TEXT, background: CARD }}>
              {LP_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <textarea
            value={newNotes} onChange={e => setNewNotes(e.target.value)}
            placeholder="Заметки (необязательно)…" rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, color: TEXT, marginBottom: 12, boxSizing: "border-box", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={createQuestion} disabled={!newTitle.trim()} style={{
              padding: "9px 16px", borderRadius: 8, border: "none", cursor: newTitle.trim() ? "pointer" : "default",
              background: newTitle.trim() ? ACCENT : "#ddd", color: "var(--surface)", fontSize: 13, fontWeight: 600,
            }}>Добавить</button>
            <button onClick={() => { setAdding(false); setNewTitle(""); setNewNotes(""); }} style={{
              padding: "9px 16px", borderRadius: 8, border: `1px solid ${BORDER}`, cursor: "pointer",
              background: CARD, color: MUTED, fontSize: 13,
            }}>Отмена</button>
          </div>
        </div>
      )}

      {/* Фильтры по категории */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <span onClick={() => setFilter("all")} style={chipStyle(filter === "all")}>Все</span>
        {LP_CATEGORIES.map(c => (
          <span key={c.key} onClick={() => setFilter(c.key)} style={chipStyle(filter === c.key)}>{c.label}</span>
        ))}
      </div>

      {/* Список */}
      {loading ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Загрузка…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 13 }}>Пока нет вопросов. Нажмите «+ Вопрос», чтобы добавить.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(q => {
            const done = q.status === "done";
            const notesOpen = openNotes[q.id];
            return (
              <div key={q.id} style={{
                border: `1px solid ${BORDER}`, borderRadius: 12, background: CARD,
                padding: 16, opacity: done ? 0.6 : 1,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, textDecoration: done ? "line-through" : "none" }}>{q.title}</div>
                    <div style={{ marginTop: 6, display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 11, background: "#f3e9e3", color: MUTED }}>{catLabel(q.category)}</div>
                  </div>
                  <button onClick={() => deleteQuestion(q.id)} title="Удалить" style={{
                    border: "none", background: "transparent", cursor: "pointer", color: MUTED, fontSize: 16, lineHeight: 1,
                  }}>×</button>
                </div>

                {/* Статус */}
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  {LP_STATUSES.map(s => {
                    const active = q.status === s.key;
                    return (
                      <button key={s.key} onClick={() => patchQuestion(q.id, { status: s.key })} style={{
                        padding: "5px 12px", borderRadius: 16, fontSize: 12, cursor: "pointer",
                        border: `1px solid ${active ? ACCENT : BORDER}`,
                        background: active ? ACCENT : CARD, color: active ? "var(--surface)" : MUTED,
                      }}>{s.label}</button>
                    );
                  })}
                </div>

                {/* Заметки */}
                <div style={{ marginTop: 12 }}>
                  <button onClick={() => setOpenNotes(o => ({ ...o, [q.id]: !o[q.id] }))} style={{
                    border: "none", background: "transparent", cursor: "pointer", color: ACCENT, fontSize: 12, padding: 0,
                  }}>{notesOpen ? "▾ Заметки" : "▸ Заметки"}{q.notes && !notesOpen ? " •" : ""}</button>
                  {notesOpen && (
                    <textarea
                      defaultValue={q.notes || ""}
                      onBlur={e => { if (e.target.value !== (q.notes || "")) patchQuestion(q.id, { notes: e.target.value }); }}
                      placeholder="Детали, ход разбора, итоговый вывод…" rows={3}
                      style={{ width: "100%", marginTop: 8, padding: "10px 12px", borderRadius: 8, border: `1px solid ${BORDER}`, fontSize: 13, color: TEXT, boxSizing: "border-box", resize: "vertical" }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── HR раздел ─────────────────────────────────────────────────────────────────
const TONE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  good: { bg: "var(--success-soft)", border: "var(--success-border)", color: "var(--success-ink)", dot: "var(--success)" },
  warn: { bg: "var(--warn-soft)", border: "var(--warn-border)", color: "var(--warn-ink)", dot: "var(--warn)" },
  bad:  { bg: "var(--danger-soft)", border: "var(--danger-border)", color: "#dc2626", dot: "var(--danger)" },
};
const fmtRub = (n: number) => `${Math.round(n).toLocaleString("ru-RU")} ₽`;

function HRDashboard() {
  const [view, setView] = React.useState<string>("analytics");
  const [books, setBooks] = React.useState<any[]>([]);
  React.useEffect(() => {
    fetch(`${API}/api/hr/books`).then(r => r.json()).then(d => setBooks(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  const tabs = [{ key: "analytics", label: "Аналитика" }, ...books.map(b => ({ key: b.key, label: b.title }))];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>HR · Подбор и команда</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>Данные из Google Sheets · обновление каждые 3 мин</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setView(t.key)} style={{
              fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              background: view === t.key ? "var(--ink)" : "none", color: view === t.key ? "var(--surface)" : "var(--muted)",
              border: view === t.key ? "none" : "1px solid var(--border-strong)",
            }}>{t.label}</button>
          ))}
        </div>
      </div>
      {view === "analytics" && <HRAnalyticsView />}
      {books.map(b => view === b.key && <HRBookView key={b.key} bookKey={b.key} />)}
    </div>
  );
}

function HRLoading({ text }: { text: string }) {
  return <div style={{ padding: 60, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>{text}</div>;
}

function HRAnalyticsView() {
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(`${API}/api/hr/analytics`).then(r => r.json()).then(setData).catch(() => {});
  }, []);
  if (!data) return <HRLoading text="Считаю аналитику подбора…" />;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {data.metrics.map((m: any, i: number) => (
          <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.5px" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>
      {/* Дашборд — визуальные метрики подбора */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Дашборд подбора</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        {data.findings.filter((f: any) => f.chart).map((f: any, i: number) => {
          const t = TONE[f.tone] || TONE.warn;
          const basis = f.chart.type === "headcount" ? "1 1 300px"
            : f.chart.type === "funnel" ? "1 1 250px" : "1 1 190px";
          return (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", flex: basis, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, color: t.color, textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>{f.title}</div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <HRFindingChart chart={f.chart} tone={t} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Выводы по подбору</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16 }}>
        Сформированы строго по цифрам из таблиц · {data.month} {data.year}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.findings.map((f: any, i: number) => {
          const t = TONE[f.tone] || TONE.warn;
          return (
            <div key={i} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 20px", display: "flex", gap: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: t.dot, marginTop: 6, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.color, marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>{f.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HR · мини-графики для карточек-выводов ─────────────────────────────────

function HRFindingChart({ chart, tone }: { chart: any; tone: { color: string; dot: string; border: string; bg: string } }) {
  if (!chart) return null;
  if (chart.type === "headcount") return <MiniHeadcount chart={chart} tone={tone} />;
  if (chart.type === "gauge") return <MiniGauge chart={chart} />;
  if (chart.type === "donut") return <MiniDonut chart={chart} tone={tone} />;
  if (chart.type === "funnel") return <MiniFunnel chart={chart} tone={tone} />;
  if (chart.type === "progress") return <MiniProgress chart={chart} tone={tone} />;
  return null;
}

// цвет по порогам (для текучести): низкая — хорошо, высокая — плохо
function gaugeColor(v: number, warn: number, bad: number) {
  if (v >= bad) return "var(--danger)";
  if (v >= warn) return "var(--warn)";
  return "var(--success)";
}
function polarPt(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

// Динамика штата: линия численности + столбики принято/уволено
function MiniHeadcount({ chart, tone }: { chart: any; tone: { dot: string } }) {
  const W = 232, H = 96, padX = 10, padTop = 16, lineH = 42, barBand = 22, baseY = padTop + lineH;
  const months: string[] = chart.months || [];
  const staff: number[] = chart.staff || [];
  const hired: number[] = chart.hired || [];
  const fired: number[] = chart.fired || [];
  const n = Math.max(months.length, 1);
  const step = (W - padX * 2) / Math.max(n - 1, 1);
  const colW = (W - padX * 2) / n;
  const sMax = Math.max(...staff, 1);
  const bMax = Math.max(...hired, ...fired, 1);
  const sx = (i: number) => padX + step * i;
  const sy = (v: number) => padTop + (1 - v / sMax) * lineH;
  const pts = staff.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ maxWidth: "100%", display: "block" }}>
      <line x1={padX} y1={baseY} x2={W - padX} y2={baseY} stroke="#e5e7eb" strokeWidth={1} />
      {/* столбики принято (вверх) / уволено (вниз) в нижней полосе */}
      {months.map((_, i) => {
        const cx = padX + colW * (i + 0.5);
        const hbw = Math.min(6, colW * 0.28);
        const hh = (hired[i] || 0) / bMax * (barBand - 2);
        const fh = (fired[i] || 0) / bMax * (barBand - 2);
        return (
          <g key={i}>
            <rect x={cx - hbw - 1} y={baseY - hh} width={hbw} height={Math.max(hh, hired[i] ? 1.5 : 0)} rx={1.5} style={{ fill: "var(--success)" }} />
            <rect x={cx + 1} y={baseY} width={hbw} height={Math.max(fh, fired[i] ? 1.5 : 0)} rx={1.5} style={{ fill: "var(--danger)" }} />
          </g>
        );
      })}
      <polyline points={pts} fill="none" stroke={tone.dot} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {staff.map((v, i) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(v)} r={2.6} fill={tone.dot} />
          {(i === 0 || i === staff.length - 1) && (
            <text x={sx(i)} y={sy(v) - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill="#374151">{v}</text>
          )}
        </g>
      ))}
      {months.map((m, i) => (
        <text key={i} x={padX + colW * (i + 0.5)} y={H - 4} textAnchor="middle" fontSize={8.5} fill="#9ca3af">{m}</text>
      ))}
    </svg>
  );
}

// Текучесть: полукруговой гейдж
function MiniGauge({ chart }: { chart: any }) {
  const W = 150, H = 96, cx = W / 2, cy = 74, r = 56, sw = 11;
  const max = chart.max || 100;
  const val = Math.max(0, Math.min(chart.value || 0, max));
  const frac = val / max;
  const col = gaugeColor(chart.value || 0, chart.warn ?? 30, chart.bad ?? 50);
  const [bx0, by0] = polarPt(cx, cy, r, 180);
  const [bx1, by1] = polarPt(cx, cy, r, 0);
  const [vx, vy] = polarPt(cx, cy, r, 180 - frac * 180);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ maxWidth: "100%", display: "block" }}>
      <path d={`M ${bx0} ${by0} A ${r} ${r} 0 0 1 ${bx1} ${by1}`} fill="none" stroke="#eceef1" strokeWidth={sw} strokeLinecap="round" />
      <path d={`M ${bx0} ${by0} A ${r} ${r} 0 0 1 ${vx} ${vy}`} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontWeight={800} fill="#111111">{chart.value}{chart.unit || ""}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize={9} fill="#9ca3af">{chart.caption || ""}</text>
    </svg>
  );
}

// Источники найма: кольцевая диаграмма
function MiniDonut({ chart, tone }: { chart: any; tone: { dot: string } }) {
  const segs: { label: string; value: number }[] = chart.segments || [];
  const total = segs.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const R = 34, sw = 13, C = 2 * Math.PI * R;
  const colors = [tone.dot, "#c7cdd6"];
  let acc = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg viewBox="0 0 84 84" width={84} style={{ display: "block" }}>
        <g transform="rotate(-90 42 42)">
          <circle cx={42} cy={42} r={R} fill="none" stroke="#eceef1" strokeWidth={sw} />
          {segs.map((s, i) => {
            const frac = (s.value || 0) / total;
            const dash = frac * C;
            const el = (
              <circle key={i} cx={42} cy={42} r={R} fill="none" stroke={colors[i % colors.length]}
                strokeWidth={sw} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C} />
            );
            acc += frac;
            return el;
          })}
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#4b5563", whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[i % colors.length] }} />
            {s.label} · {Math.round((s.value || 0) / total * 100)}%
          </div>
        ))}
      </div>
    </div>
  );
}

// Воронка найма: горизонтальные полосы
function MiniFunnel({ chart, tone }: { chart: any; tone: { dot: string } }) {
  const stages: { label: string; value: number }[] = chart.stages || [];
  const max = Math.max(...stages.map(s => s.value || 0), 1);
  const rowH = 17, barMax = 118, labelW = 78;
  const W = labelW + barMax + 34, H = stages.length * rowH + 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} style={{ maxWidth: "100%", display: "block" }}>
      {stages.map((s, i) => {
        const w = Math.max(((s.value || 0) / max) * barMax, s.value ? 3 : 0);
        const y = i * rowH + 3;
        return (
          <g key={i}>
            <text x={0} y={y + 10} fontSize={9.5} fill="#6b7280">{s.label}</text>
            <rect x={labelW} y={y} width={barMax} height={12} rx={3} fill="#eef0f3" />
            <rect x={labelW} y={y} width={w} height={12} rx={3} fill={tone.dot} opacity={0.85 - i * 0.11} />
            <text x={labelW + barMax + 4} y={y + 10} fontSize={9.5} fontWeight={700} fill="#374151">{s.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

// KPI: круговой прогресс
function MiniProgress({ chart, tone }: { chart: any; tone: { dot: string } }) {
  const max = chart.max || 100;
  const val = Math.max(0, Math.min(chart.value || 0, max));
  const frac = val / max;
  const R = 38, sw = 12, C = 2 * Math.PI * R;
  const col = frac >= 0.9 ? "var(--success)" : frac >= 0.6 ? tone.dot : "var(--warn)";
  return (
    <svg viewBox="0 0 92 92" width={92} style={{ display: "block", maxWidth: "100%" }}>
      <g transform="rotate(-90 46 46)">
        <circle cx={46} cy={46} r={R} fill="none" stroke="#eceef1" strokeWidth={sw} />
        <circle cx={46} cy={46} r={R} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={`${frac * C} ${C}`} />
      </g>
      <text x={46} y={44} textAnchor="middle" fontSize={19} fontWeight={800} fill="#111111">{chart.value}{chart.unit || ""}</text>
      <text x={46} y={58} textAnchor="middle" fontSize={8.5} fill="#9ca3af">{chart.caption || ""}</text>
    </svg>
  );
}

// ── HRDashboard: умные вьюхи для каждой книги ──────────────────────────────

function HRBookView({ bookKey }: { bookKey: string }) {
  if (bookKey === "t1") return <HRHeadcountView />;
  if (bookKey === "t2") return <HRRnpView />;
  if (bookKey === "t3") return <HRSalaryView />;
  return null;
}

// ─── T1: Сводка по штату ────────────────────────────────────────────────────
function HRHeadcountView() {
  const [year, setYear] = React.useState("2026");
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    setData(null);
    fetch(`${API}/api/hr/headcount?year=${year}`).then(r => r.json()).then(setData).catch(() => {});
  }, [year]);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["2025", "2026"].map(y => (
          <button key={y} onClick={() => setYear(y)} style={{
            fontSize: 12, fontWeight: 500, padding: "5px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            background: year === y ? "var(--brand)" : "none", color: year === y ? "var(--surface)" : "var(--muted)",
            border: year === y ? "none" : "1px solid var(--border-strong)",
          }}>{y}</button>
        ))}
      </div>
      {!data ? <HRLoading text="Загружаю сводку по штату…" /> : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "В штате", value: data.current.staff, sub: `${data.current.brokers} брокеров · ${data.current.others} обеспечение` },
              { label: "Принято YTD", value: data.ytd.hired, sub: `с начала ${year}` },
              { label: "Уволено YTD", value: data.ytd.fired, sub: `с начала ${year}` },
              { label: "Чистое изменение", value: `${data.ytd.net >= 0 ? "+" : ""}${data.ytd.net}`, sub: data.current.month, warn: data.ytd.net < 0 },
            ].map((m: any, i: number) => (
              <div key={i} style={{ background: m.warn ? "var(--danger-soft)" : "var(--surface)", border: `1px solid ${m.warn ? "var(--danger-border)" : "var(--border)"}`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.warn ? "#dc2626" : "var(--ink)", letterSpacing: "-0.5px" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead style={{ background: "var(--surface-2)" }}>
                <tr>
                  <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid var(--border)", position: "sticky", left: 0, background: "var(--surface-2)", minWidth: 200 }}>Показатель</th>
                  {data.months.map((m: string) => (
                    <th key={m} style={{ padding: "10px 10px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textAlign: "center", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{m.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any, i: number) => {
                  const isSub = r.kind === "sub";
                  const isTotal = r.kind === "total";
                  return (
                    <tr key={i} style={{ background: isTotal ? "var(--brand-soft)" : "transparent" }}>
                      <td style={{
                        padding: isSub ? "7px 16px 7px 32px" : "9px 16px",
                        fontSize: 13, fontWeight: isTotal ? 700 : isSub ? 400 : 600,
                        color: isTotal ? "var(--brand)" : isSub ? "var(--muted)" : "var(--ink)",
                        borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                        position: "sticky", left: 0, background: isTotal ? "var(--brand-soft)" : isSub ? "#fdfdfd" : "var(--surface)",
                      }}>{r.label}</td>
                      {r.values.map((v: number, j: number) => (
                        <td key={j} style={{
                          padding: "8px 10px", fontSize: 13, textAlign: "center", borderBottom: "1px solid var(--border)",
                          color: v === 0 ? "#ddd" : isTotal ? "var(--brand)" : isSub ? "var(--muted)" : "var(--ink)",
                          fontWeight: isTotal ? 700 : 400,
                        }}>{v === 0 ? "·" : v}</td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── T2: РНП — воронка найма + источники ────────────────────────────────────
function HRRnpView() {
  const MONTHS = monthsThrough(0);
  const [month, setMonth] = React.useState(currentMonthRu());
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    setData(null);
    fetch(`${API}/api/hr/rnp?month=${encodeURIComponent(month)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [month]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {MONTHS.map(m => (
          <button key={m} onClick={() => setMonth(m)} style={{
            fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            background: month === m ? "var(--brand)" : "none", color: month === m ? "var(--surface)" : "var(--muted)",
            border: month === m ? "none" : "1px solid var(--border-strong)",
          }}>{m}</button>
        ))}
      </div>
      {!data ? <HRLoading text="Загружаю РНП…" /> : data.empty ? (
        <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Нет данных за {data.month} — вкладка ещё не заведена в таблице</div>
      ) : (
        <>
          {/* Воронка — карточки */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 24 }}>
            {data.funnel.map((f: any, i: number) => {
              const ok = (f.pct ?? 0) >= 90;
              const over = (f.pct ?? 0) >= 110;
              const bg = over ? "var(--success-soft)" : ok ? "var(--surface)" : "var(--warn-soft)";
              const border = over ? "var(--success-border)" : ok ? "var(--border)" : "var(--warn-border)";
              const pctColor = over ? "var(--success-ink)" : ok ? "var(--brand)" : "var(--warn-ink)";
              const short = f.label.replace("Общее кол-во ", "").replace("кол-во ", "");
              return (
                <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>{short}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{f.fact ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>план {f.plan ?? "—"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: pctColor }}>{f.pct != null ? `${f.pct}%` : "—"}</div>
                </div>
              );
            })}
          </div>

          {/* По неделям */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 24, overflowX: "auto" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600 }}>Разбивка по неделям</div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead style={{ background: "var(--surface-2)" }}>
                <tr>
                  <th style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>Метрика</th>
                  {[1,2,3,4,5,6].map(w => (
                    <th key={w} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textAlign: "center", borderBottom: "1px solid var(--border)" }}>Неделя {w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((f: any, i: number) => {
                  const short = f.label.replace("Общее кол-во ", "").replace("кол-во ", "");
                  return (
                    <tr key={i}>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: "var(--ink)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{short}</td>
                      {f.weeks.map((w: any, j: number) => {
                        const hasData = w.fact != null || w.plan != null;
                        const ok2 = (w.pct ?? 0) >= 90;
                        return (
                          <td key={j} style={{ padding: "8px 10px", fontSize: 12, textAlign: "center", borderBottom: "1px solid var(--border)" }}>
                            {hasData && (w.fact != null || w.plan != null) ? (
                              <span>
                                <b style={{ color: ok2 ? "var(--success-ink)" : "var(--warn-ink)" }}>{w.fact ?? "—"}</b>
                                <span style={{ color: "var(--faint)" }}>/{w.plan ?? "—"}</span>
                              </span>
                            ) : <span style={{ color: "#ddd" }}>·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Источники — блоки */}
          {data.sections.length > 0 && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Источники найма</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                {data.sections.map((sec: any, si: number) => (
                  <div key={si} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", background: "var(--brand-soft)", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>{sec.title}</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {sec.rows.map((row: any, ri: number) => {
                          const isConv = row.label.toLowerCase().includes("конверсия");
                          const ok3 = (row.pct ?? 0) >= 90;
                          const pctColor2 = (row.pct ?? 0) >= 110 ? "var(--success-ink)" : ok3 ? "var(--brand)" : "var(--warn-ink)";
                          return (
                            <tr key={ri} style={{ borderBottom: ri < sec.rows.length - 1 ? "1px solid var(--border)" : "none" }}>
                              <td style={{ padding: "8px 14px", fontSize: 12, color: isConv ? "var(--muted)" : "var(--ink)", fontStyle: isConv ? "italic" : "normal" }}>{row.label}</td>
                              <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", color: "var(--muted)" }}>{row.plan != null ? row.plan : "—"}</td>
                              <td style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontWeight: 600, color: "var(--ink)" }}>{row.fact != null ? row.fact : "—"}</td>
                              <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", fontWeight: 600, color: row.pct != null ? pctColor2 : "var(--muted)", minWidth: 48 }}>{row.pct != null ? `${row.pct}%` : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── T3: ЗП и KPI HR-менеджера ──────────────────────────────────────────────
function HRSalaryView() {
  const T3_MONTHS = monthsThrough(2); // таблица ведётся с марта
  const [month, setMonth] = React.useState(T3_MONTHS[T3_MONTHS.length - 1]);
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    setData(null);
    fetch(`${API}/api/hr/salary?month=${encodeURIComponent(month)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [month]);

  const fmtRub2 = (v: number) => `${Math.round(v).toLocaleString("ru-RU")} ₽`;
  const pctColor = (v: number) => v >= 100 ? "var(--success-ink)" : v >= 80 ? "var(--warn-ink)" : "#dc2626";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {T3_MONTHS.map(m => (
          <button key={m} onClick={() => setMonth(m)} style={{
            fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            background: month === m ? "var(--brand)" : "none", color: month === m ? "var(--surface)" : "var(--muted)",
            border: month === m ? "none" : "1px solid var(--border-strong)",
          }}>{m}</button>
        ))}
      </div>
      {!data ? <HRLoading text="Загружаю данные по зарплате…" /> : (data.empty || data.error) ? (
        <div style={{ color: "var(--muted)", textAlign: "center", padding: 40 }}>Нет данных за {data.month || month} — вкладка ещё не заведена в таблице</div>
      ) : (
        <>
          {/* Карточки зарплаты */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
            {[
              { label: "Оклад", value: fmtRub2(data.salary.oklad), sub: "фиксированная часть" },
              { label: "Премия (план)", value: fmtRub2(data.salary.premia), sub: "при 100% KPI" },
              { label: "Премия (факт)", value: fmtRub2(data.totals.fact_premii), sub: `выполнение ${data.overall_pct}%` },
              { label: "Итого к выплате", value: fmtRub2(data.salary.oklad + data.totals.fact_premii), sub: data.salary.ratio || "оклад + факт премии", accent: true, ok: data.overall_pct >= 100 },
            ].map((m: any, i: number) => (
              <div key={i} style={{
                background: m.accent ? (m.ok ? "var(--success-soft)" : "var(--warn-soft)") : "var(--surface)",
                border: `1px solid ${m.accent ? (m.ok ? "var(--success-border)" : "var(--warn-border)") : "var(--border)"}`,
                borderRadius: 10, padding: "16px 20px"
              }}>
                <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.accent ? pctColor(data.overall_pct) : "var(--ink)", letterSpacing: "-0.5px" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {data.plan_text && (
            <div style={{ background: "var(--brand-soft)", border: "1px solid #e0e0f0", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "var(--brand)", fontWeight: 500 }}>{data.plan_text}</div>
          )}

          {/* Таблица KPI */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", fontSize: 13, fontWeight: 600 }}>KPI на {month.toLowerCase()}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "var(--surface-2)" }}>
                <tr>
                  {["Показатель", "Вес", "ФОТ", "План", "Факт", "%", "Выплата"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", textAlign: i === 0 ? "left" : "right", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.kpi.map((k: any, i: number) => {
                  const pc = pctColor(k.pct);
                  const isLast = i === data.kpi.length - 1;
                  return (
                    <tr key={i}>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--ink)", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>{k.name}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--muted)", textAlign: "right", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>{k.weight}%</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--muted)", textAlign: "right", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>{fmtRub2(k.fot)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "var(--ink-2)", textAlign: "right", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>{k.plan}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: "var(--ink)", textAlign: "right", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>{k.fact}</td>
                      <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 700, color: pc, textAlign: "right", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>{k.pct}%</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "var(--ink)", textAlign: "right", borderBottom: isLast ? "none" : "1px solid var(--border)" }}>{fmtRub2(k.fact_premii)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: "var(--brand-soft)" }}>
                <tr>
                  <td colSpan={6} style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>Итого премия факт</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 700, color: "var(--brand)", textAlign: "right" }}>{fmtRub2(data.totals.fact_premii)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* SMART-задачи */}
          {data.smart_tasks.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>SMART-задачи · {month}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.smart_tasks.map((t: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, alignItems: "flex-start" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--brand)", color: "var(--surface)", fontSize: 11, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                    <span>{t.replace(/^\d+\.\s*/, "")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
// ── Placeholder Section ──────────────────────────────────────────────────────
function PlaceholderSection({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 60px)", minHeight: 500, overflow: "hidden" }}>
      <img
        src="/bunnies.png"
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "130%",
          height: "130%",
          objectFit: "contain",
          objectPosition: "center",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--muted)", fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em" }}>
          {label}
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, color: "#9e7a74", fontFamily: "system-ui, sans-serif" }}>
          {subtitle ?? "Скоро придут 🐰"}
        </div>
      </div>
    </div>
  );
}

// ── Finance Placeholder ───────────────────────────────────────────────────────
function FinancePlaceholder() {
  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 60px)", minHeight: 500, overflow: "hidden" }}>
      <img
        src="/bunnies.png"
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "130%",
          height: "130%",
          objectFit: "contain",
          objectPosition: "center",
          opacity: 0.22,
          pointerEvents: "none",
        }}
      />
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--muted)", fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em" }}>
          Финансы
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, color: "#9e7a74", fontFamily: "system-ui, sans-serif" }}>
          Финансы скоро придут 🐰
        </div>
      </div>
    </div>
  );
}

// ── Finance Section (ДДС) ────────────────────────────────────────────────────
function FinanceSection() {
  const MUTED = "var(--muted)";
  const ACCENT = "#1A6B52";
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [pay, setPay] = React.useState<any>(null);
  const curMonthIdx = new Date().getMonth(); // 0..11
  React.useEffect(() => {
    fetch(`${API}/api/finance/dds`).then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
    fetch(`${API}/api/finance/payment-calendar`).then(r => r.json()).then(setPay).catch(() => setPay({ empty: true }));
  }, []);
  if (loading) return <div style={{ padding: 24, color: MUTED }}>Загрузка…</div>;
  if (!data || data.empty) return <div style={{ padding: 24, color: MUTED }}>Нет данных ДДС</div>;
  const money = (n: number) => (n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  const cell = (n: number, i: number) => (
    <td key={i} style={{ textAlign: "right", padding: "4px 8px",
      color: n < 0 ? "var(--danger-ink)" : "var(--ink)", whiteSpace: "nowrap",
      background: i === curMonthIdx ? "#f3f8f6" : "none" }}>{n ? money(n) : "—"}</td>
  );
  const headMonth = (m: string, i: number) => (
    <th key={i} style={{ textAlign: "right", padding: "4px 8px", fontWeight: i === curMonthIdx ? 700 : 500,
      color: i === curMonthIdx ? ACCENT : MUTED }}>{m.slice(0, 3)}</th>
  );
  const totalByMonth = data.months.map((_: string, i: number) =>
    data.accounts.reduce((s: number, a: any) => s + (a.values[i] || 0), 0));
  const maxTotal = Math.max(1, ...totalByMonth);
  return (
    <div style={{ padding: 24, overflowX: "auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Финансы — ДДС</h2>

      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>Динамика остатков</h3>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 120, margin: "8px 0 24px", maxWidth: 900 }}>
        {totalByMonth.map((v: number, i: number) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div title={money(v)} style={{ height: Math.max(2, (v / maxTotal) * 100),
              background: i === curMonthIdx ? ACCENT : "var(--success-border)", borderRadius: 3 }} />
            <div style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{data.months[i].slice(0, 3)}</div>
          </div>
        ))}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
        <thead>
          <tr><th style={{ textAlign: "left", padding: "4px 8px" }}></th>
            {data.months.map(headMonth)}</tr>
        </thead>
        <tbody>
          <tr style={{ fontWeight: 700, background: "#f6f6f6" }}>
            <td style={{ padding: "4px 8px" }}>Денег на начало</td>
            {data.cashStart.map((n: number, i: number) => cell(n, i))}</tr>
          {data.accounts.map((a: any) => (
            <tr key={a.name}><td style={{ padding: "4px 8px" }}>{a.name}</td>
              {a.values.map((n: number, i: number) => cell(n, i))}</tr>
          ))}
          {data.activities.map((act: any) => (
            <React.Fragment key={act.name}>
              <tr style={{ fontWeight: 700, background: "var(--surface-2)" }}>
                <td style={{ padding: "6px 8px" }}>{act.name}</td>
                {act.net.map((n: number, i: number) => cell(n, i))}</tr>
              {act.items.map((it: any) => (
                <tr key={it.label}><td style={{ padding: "4px 8px 4px 20px", color: MUTED }}>{it.label}</td>
                  {it.values.map((n: number, i: number) => cell(n, i))}</tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>

      <h3 style={{ fontSize: 15, fontWeight: 700, margin: "24px 0 8px" }}>Платёжный календарь</h3>
      {(!pay || pay.empty) ? <div style={{ color: MUTED, fontSize: 13 }}>Нет запланированных платежей</div> : (
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}><tbody>
          {pay.items.map((p: any, i: number) => (
            <tr key={i}><td style={{ padding: "4px 12px 4px 0" }}>{p.date}</td>
              <td style={{ padding: "4px 12px 4px 0" }}>{p.org}</td>
              <td style={{ padding: "4px 12px 4px 0", color: MUTED }}>{p.article}</td>
              <td style={{ padding: "4px 0", textAlign: "right" }}>{money(p.amount)}</td></tr>
          ))}
        </tbody></table>
      )}
    </div>
  );
}

// ── Expenses Section (Расходы компании — ОПиУ) ───────────────────────────────
function ExpensesSection() {
  const MUTED = "var(--muted)";
  const ACCENT = "#1A6B52";
  const RED = "var(--danger-ink)";
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [mSel, setMSel] = React.useState<number | null>(null);
  React.useEffect(() => {
    fetch(`${API}/api/finance/expenses`).then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  if (loading) return <div style={{ padding: 24, color: MUTED }}>Загрузка…</div>;
  if (!data || data.empty) return <div style={{ padding: 24, color: MUTED }}>Нет данных ОПиУ</div>;

  const f = data.fact, p = data.plan;
  const last: number = data.lastFactIdx;
  const i = mSel ?? last;
  const money = (n: number) => (n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });
  const mln = (n: number) => (n / 1e6).toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + " млн";
  const pct1 = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) + "%";
  const expTotal = (b: any, j: number) =>
    (b.nds[j] || 0) + b.groups.reduce((s: number, g: any) => s + (g.total[j] || 0), 0) + (b.belowExpense[j] || 0);
  const rent = (b: any, j: number) => (b.revenue[j] ? (b.netProfit[j] / b.revenue[j]) * 100 : 0);

  // ── KPI за месяц ──
  const kpis = [
    { label: "Выручка", fact: f.revenue[i], plan: p.revenue[i], prev: i > 0 ? f.revenue[i - 1] : null, moreIsGood: true },
    { label: "Все расходы", fact: expTotal(f, i), plan: expTotal(p, i), prev: i > 0 ? expTotal(f, i - 1) : null, moreIsGood: false },
    { label: "Чистая прибыль", fact: f.netProfit[i], plan: p.netProfit[i], prev: i > 0 ? f.netProfit[i - 1] : null, moreIsGood: true },
    { label: "Рентабельность по ЧП", fact: rent(f, i), plan: rent(p, i), prev: i > 0 ? rent(f, i - 1) : null, moreIsGood: true, isPct: true },
  ];

  // ── Водопад месяца ──
  const wf: { label: string; delta: number }[] = [
    { label: "Выручка", delta: f.revenue[i] },
    { label: "НДС", delta: -f.nds[i] },
    { label: "Отдел продаж", delta: -(f.groups.find((g: any) => g.key === "sales")?.total[i] || 0) },
    { label: "Маркетинг", delta: -(f.groups.find((g: any) => g.key === "marketing")?.total[i] || 0) },
    { label: "Постоянные", delta: -(f.groups.find((g: any) => g.key === "fixed")?.total[i] || 0) },
    { label: "Налог УСН", delta: -f.belowExpense[i] },
  ];
  if (f.belowIncome[i]) wf.push({ label: "Проценты банка", delta: f.belowIncome[i] });
  wf.push({ label: "Чистая прибыль", delta: 0 }); // итоговый столбик, высота = остаток
  const wfMax = Math.max(1, f.revenue[i]);
  const WF_H = 190, WF_TOP = 20, WF_W = 900, wfBar = WF_W / wf.length;

  // ── Динамика по месяцам ──
  const dynIdx = Array.from({ length: last + 1 }, (_, j) => j);
  const dynMax = Math.max(1, ...dynIdx.map(j => f.revenue[j]));
  const DY_H = 200, DY_W = 900, dyCol = DY_W / dynIdx.length;
  const rentMax = Math.max(10, ...dynIdx.map(j => rent(f, j)));

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" };
  const h3: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: "28px 0 10px" };
  const dev = (fact: number, plan: number, moreIsGood: boolean) => {
    if (!plan) return null;
    const r = (fact / plan) * 100;
    const good = moreIsGood ? r >= 100 : r <= 100;
    return <span style={{ color: good ? ACCENT : RED, fontWeight: 600 }}>{Math.round(r)}% плана</span>;
  };

  return (
    <div style={{ padding: 24, maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Расходы компании</h2>
        <div style={{ fontSize: 11, color: MUTED }}>живые данные из ОПиУ · обновляется само</div>
      </div>

      {/* Селектор месяца */}
      <div style={{ display: "flex", gap: 6, margin: "14px 0 18px", flexWrap: "wrap" }}>
        {data.months.map((m: string, j: number) => {
          const has = j <= last && (f.revenue[j] > 0 || expTotal(f, j) > 0);
          const active = j === i;
          return (
            <button key={m} disabled={!has} onClick={() => setMSel(j)}
              style={{ background: active ? ACCENT : "var(--surface)", color: active ? "var(--surface)" : has ? "var(--ink-2)" : "var(--faint)",
                border: "1px solid " + (active ? ACCENT : "var(--border-strong)"), borderRadius: 20, padding: "4px 12px",
                fontSize: 12, cursor: has ? "pointer" : "default", fontFamily: "inherit" }}>{m}</button>
          );
        })}
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px" }}>
              {k.isPct ? pct1(k.fact) : money(k.fact)}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {dev(k.fact, k.plan, k.moreIsGood)}
              {k.prev != null && k.prev !== 0 && (
                <span style={{ color: MUTED }}>
                  {k.fact >= k.prev ? "▲" : "▼"} {k.isPct
                    ? pct1(Math.abs(k.fact - k.prev))
                    : mln(Math.abs(k.fact - k.prev))} к пред. мес.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Водопад */}
      <h3 style={h3}>Куда ушли деньги — {data.months[i]}</h3>
      <svg viewBox={`0 0 ${WF_W} ${WF_TOP + WF_H + 40}`} style={{ width: "100%", maxWidth: 900 }}>
        {(() => {
          let run = 0;
          return wf.map((s, k) => {
            const isFirst = k === 0, isLast = k === wf.length - 1;
            const start = isFirst ? 0 : run;
            if (isFirst) run = s.delta; else run += s.delta;
            const top = isLast ? run : Math.max(start, run);
            const h = isLast ? run : Math.abs(s.delta);
            const y = WF_TOP + WF_H - (top / wfMax) * WF_H;
            const hh = Math.max(2, (h / wfMax) * WF_H);
            const fill = isFirst ? ACCENT : isLast ? "#0e4a38" : s.delta >= 0 ? "#7fb3a3" : "#dcaaa2";
            const x = k * wfBar + wfBar * 0.12, w = wfBar * 0.76;
            return (
              <g key={s.label}>
                <rect x={x} y={y} width={w} height={hh} rx={4} fill={fill} />
                <text x={x + w / 2} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={600}
                  fill={isFirst || isLast ? ACCENT : "var(--muted)"}>
                  {isFirst || isLast ? mln(h) : (s.delta > 0 ? "+" : "−") + mln(Math.abs(s.delta))}
                </text>
                <text x={x + w / 2} y={WF_TOP + WF_H + 16} textAnchor="middle" fontSize={10.5} fill={MUTED}>{s.label}</text>
              </g>
            );
          });
        })()}
      </svg>

      {/* Структура расходов */}
      <h3 style={h3}>Структура расходов — {data.months[i]}: факт против плана</h3>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>Красным — перерасход к плану больше 15%</div>
      {f.groups.map((g: any) => {
        const pg = p.groups.find((x: any) => x.key === g.key) || { total: [], items: [] };
        const items = g.items
          .map((it: any) => {
            const pit = pg.items?.find((x: any) => x.label === it.label);
            return { label: it.label, fact: it.values[i] || 0, plan: pit?.values[i] || 0 };
          })
          .filter((it: any) => it.fact || it.plan)
          .sort((a: any, b: any) => b.fact - a.fact);
        const gf = g.total[i] || 0, gp = pg.total?.[i] || 0;
        return (
          <div key={g.key} style={{ ...card, padding: 0, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
              padding: "12px 20px", background: "var(--surface-2)", flexWrap: "wrap", gap: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div>
              <div style={{ fontSize: 13 }}>
                <b>{money(gf)}</b>
                <span style={{ color: MUTED }}> · {pct1(f.revenue[i] ? gf / f.revenue[i] * 100 : 0)} выручки · план {money(gp)} · </span>
                <span style={{ color: gp && gf > gp ? RED : ACCENT, fontWeight: 600 }}>
                  {gp ? (gf > gp ? "+" : "−") + money(Math.abs(gf - gp)) : "—"}
                </span>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: MUTED }}>
                  <th style={{ textAlign: "left", padding: "6px 20px", fontWeight: 500 }}>Статья</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>Факт</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>% выручки</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: 500 }}>План</th>
                  <th style={{ textAlign: "right", padding: "6px 20px 6px 8px", fontWeight: 500 }}>Отклонение</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => {
                  const over = it.plan > 0 && it.fact > it.plan * 1.15;
                  const diff = it.fact - it.plan;
                  return (
                    <tr key={it.label} style={{ borderTop: "1px solid var(--border)", background: over ? "#fdf3f1" : "none" }}>
                      <td style={{ padding: "6px 20px" }}>{it.label}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{money(it.fact)}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", color: MUTED }}>{pct1(f.revenue[i] ? it.fact / f.revenue[i] * 100 : 0)}</td>
                      <td style={{ textAlign: "right", padding: "6px 8px", color: MUTED, whiteSpace: "nowrap" }}>{it.plan ? money(it.plan) : "—"}</td>
                      <td style={{ textAlign: "right", padding: "6px 20px 6px 8px", whiteSpace: "nowrap",
                        color: !it.plan ? MUTED : diff > 0 ? RED : ACCENT, fontWeight: over ? 700 : 500 }}>
                        {it.plan ? (diff > 0 ? "+" : "−") + money(Math.abs(diff)) + (over ? ` (×${(it.fact / it.plan).toLocaleString("ru-RU", { maximumFractionDigits: 1 })})` : "") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Динамика */}
      <h3 style={h3}>Динамика по месяцам</h3>
      <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>
        <span style={{ color: ACCENT }}>■</span> выручка&nbsp;&nbsp;<span style={{ color: "#dcaaa2" }}>■</span> все расходы&nbsp;&nbsp;
        <span style={{ color: "#b8860b" }}>―</span> рентабельность по ЧП
      </div>
      <svg viewBox={`0 0 ${DY_W} ${DY_H + 34}`} style={{ width: "100%", maxWidth: 900 }}>
        {dynIdx.map(j => {
          const rv = f.revenue[j], ex = expTotal(f, j);
          const x = j * dyCol;
          const bw = dyCol * 0.3;
          return (
            <g key={j} opacity={j === i ? 1 : 0.82}>
              <rect x={x + dyCol * 0.14} y={DY_H - rv / dynMax * DY_H} width={bw} height={Math.max(2, rv / dynMax * DY_H)} rx={3} fill={ACCENT} />
              <rect x={x + dyCol * 0.14 + bw + 3} y={DY_H - ex / dynMax * DY_H} width={bw} height={Math.max(2, ex / dynMax * DY_H)} rx={3} fill="#dcaaa2" />
              <text x={x + dyCol / 2} y={DY_H + 14} textAnchor="middle" fontSize={11}
                fontWeight={j === i ? 700 : 400} fill={j === i ? ACCENT : MUTED}>{data.months[j].slice(0, 3)}</text>
              <text x={x + dyCol / 2} y={DY_H + 28} textAnchor="middle" fontSize={10} fill="#b8860b">{pct1(rent(f, j))}</text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#b8860b" strokeWidth={2}
          points={dynIdx.map(j => `${j * dyCol + dyCol / 2},${DY_H - rent(f, j) / rentMax * (DY_H * 0.85)}`).join(" ")} />
        {dynIdx.map(j => (
          <circle key={j} cx={j * dyCol + dyCol / 2} cy={DY_H - rent(f, j) / rentMax * (DY_H * 0.85)} r={3} fill="#b8860b" />
        ))}
      </svg>

      {/* Фонды */}
      <h3 style={h3}>Прибыль с начала года и фонды</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <div style={{ ...card, background: "var(--surface-2)", border: "1px solid #d5e6df" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>ЧП накопленным итогом</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: ACCENT, letterSpacing: "-0.5px" }}>{money(f.netProfitCum[last])}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>январь — {data.months[last].toLowerCase()}</div>
        </div>
        {[
          { label: "Ф: Дивиденды 70%", arr: f.funds.dividends },
          { label: "Ф: Резервный 25%", arr: f.funds.reserve },
          { label: "Ф: Корпоративы 5%", arr: f.funds.corporate },
        ].map(fd => (
          <div key={fd.label} style={card}>
            <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{fd.label}</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px" }}>{money(fd.arr.reduce((s: number, v: number) => s + v, 0))}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>начислено за год</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Motivation Section (Мотивация) ───────────────────────────────────────────
const MOTIV_MUTED = "var(--muted)";
const MOTIV_ACCENT = "#1A6B52";
const money0 = (n: number) => (n || 0).toLocaleString("ru-RU", { maximumFractionDigits: 0 });

const MOTIV_TABS = [
  { key: "payroll", label: "Ведомость" },
  { key: "dir",     label: "Директор продаж" },
  { key: "rop",     label: "РОП" },
  { key: "owners",  label: "Собственники" },
  { key: "office",  label: "Офис-менеджер" },
  { key: "qc",      label: "Контроль качества" },
  { key: "hr",      label: "HR" },
];

function MotivationSection() {
  const [tab, setTab] = React.useState<string>("payroll");
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Мотивация</h2>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #eee", marginBottom: 16, flexWrap: "wrap" }}>
        {MOTIV_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "8px 14px", fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              color: tab === t.key ? MOTIV_ACCENT : MOTIV_MUTED,
              borderBottom: tab === t.key ? `2px solid ${MOTIV_ACCENT}` : "2px solid transparent" }}>
            {t.label}</button>
        ))}
      </div>
      {tab === "payroll" && <MotivPayroll />}
      {tab === "dir" && <MotivRole roleKey="Директор продаж" />}
      {tab === "rop" && <MotivRole roleKey="РОП" />}
      {tab === "owners" && <MotivOwners />}
      {tab === "office" && <MotivKpi role="office-manager" />}
      {tab === "qc" && <MotivKpi role="quality-control" />}
      {tab === "hr" && <MotivHr />}
    </div>
  );
}

function MotivMonthSelect({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return (
    <select value={month} onChange={e => onChange(e.target.value)}
      style={{ marginBottom: 12, padding: "4px 8px", fontFamily: "inherit", fontSize: 13 }}>
      {MONTHS_RU.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}

function MotivCard({ label, val }: { label: string; val: string }) {
  return (
    <div style={{ background: "#f6f6f6", borderRadius: 10, padding: "10px 16px", minWidth: 110 }}>
      <div style={{ fontSize: 11, color: MOTIV_MUTED }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{val}</div>
    </div>
  );
}

// Заголовок блока единого шаблона вкладки: «Аналитика» сверху, «Вводные» ниже
function MotivBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: MOTIV_ACCENT, textTransform: "uppercase",
        letterSpacing: "0.06em", borderBottom: "1px solid #e8efec", paddingBottom: 6, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// Единый годовой график по месяцам (текущий месяц подсвечен)
function MotivBars({ title, values }: { title: string; values: number[] }) {
  const max = Math.max(1, ...values);
  const curIdx = new Date().getMonth();
  const year = new Date().getFullYear();
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{title} · {year}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", maxWidth: 900 }}>
        {values.map((v, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: MOTIV_MUTED, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden" }}>
              {v ? (v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + "м" : Math.round(v / 1000) + "т") : ""}
            </div>
            <div title={money0(v)} style={{ height: Math.max(2, (v / max) * 90),
              background: i === curIdx ? MOTIV_ACCENT : "var(--success-border)", borderRadius: 3 }} />
            <div style={{ fontSize: 10, color: i === curIdx ? MOTIV_ACCENT : MOTIV_MUTED,
              fontWeight: i === curIdx ? 700 : 400, marginTop: 4 }}>{MONTHS_RU[i].slice(0, 3)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MotivPayroll() {
  const [month, setMonth] = React.useState(currentMonthRu());
  const [data, setData] = React.useState<any>(null);
  const [year, setYear] = React.useState<any>(null);
  React.useEffect(() => {
    setData(null);
    fetch(`${API}/api/motivation/payroll?month=${encodeURIComponent(month)}`)
      .then(r => r.json()).then(setData).catch(() => setData({ empty: true }));
  }, [month]);
  React.useEffect(() => {
    fetch(`${API}/api/motivation/payroll-year`).then(r => r.json()).then(setYear).catch(() => {});
  }, []);
  const FIELDS = ["oklad", "sdelka", "premia", "shtrafy", "itogo", "avans"];
  return (
    <div>
      <MotivMonthSelect month={month} onChange={setMonth} />

      <MotivBlock title="Аналитика">
        {(!data) ? <div style={{ color: MOTIV_MUTED }}>Загрузка…</div>
          : data.empty ? <div style={{ color: MOTIV_MUTED }}>Нет данных за {month}</div> : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <MotivCard label="Сотрудников" val={String(data.summary.headcount)} />
            <MotivCard label={`ФОТ · ${month}`} val={money0(data.summary.fot)} />
            <MotivCard label="Оклады" val={money0(data.summary.oklad)} />
            <MotivCard label="Сделка" val={money0(data.summary.sdelka)} />
            <MotivCard label="Премия" val={money0(data.summary.premia)} />
            <MotivCard label="Штрафы" val={money0(data.summary.shtrafy)} />
          </div>
        )}
        {year && year.fotByMonth && (
          <>
            <MotivBars title="ФОТ по месяцам" values={year.fotByMonth} />
            {year.byDepartment?.length > 0 && (
              <table style={{ borderCollapse: "collapse", fontSize: 12, marginTop: 14, minWidth: 700 }}>
                <thead><tr><th style={{ textAlign: "left", padding: 4 }}>ФОТ по отделам</th>
                  {MONTHS_RU.map((m, i) => (
                    <th key={i} style={{ textAlign: "right", padding: 4, color: MOTIV_MUTED }}>{m.slice(0, 3)}</th>))}</tr></thead>
                <tbody>
                  {year.byDepartment.map((d: any) => (
                    <tr key={d.name}><td style={{ padding: 4 }}>{d.name}</td>
                      {d.values.map((v: number, i: number) => (
                        <td key={i} style={{ textAlign: "right", padding: 4 }}>{v ? money0(v) : "—"}</td>))}</tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </MotivBlock>

      {data && !data.empty && (
        <MotivBlock title={`Вводные · ${month}`}>
          {data.departments.map((d: any) => (
            <div key={d.name} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, margin: "8px 0" }}>{d.name}</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead><tr style={{ color: MOTIV_MUTED }}>
                  <th style={{ textAlign: "left", padding: 4 }}>Сотрудник</th>
                  {["Оклад", "Сделка", "Премия", "Штрафы", "Итого", "Аванс"].map(h => (
                    <th key={h} style={{ textAlign: "right", padding: 4 }}>{h}</th>))}</tr></thead>
                <tbody>
                  {d.rows.map((e: any, ri: number) => (
                    <tr key={`${e.fio}-${ri}`}>
                      <td style={{ padding: 4 }}>{e.fio}<span style={{ color: MOTIV_MUTED }}> · {e.position}</span></td>
                      {FIELDS.map(f => (
                        <td key={f} style={{ textAlign: "right", padding: 4 }}>{e[f] ? money0(e[f]) : "—"}</td>))}
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 4 }}>Итого</td>
                    {FIELDS.map(f => (
                      <td key={f} style={{ textAlign: "right", padding: 4 }}>{money0(d.subtotal[f])}</td>))}
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </MotivBlock>
      )}
    </div>
  );
}

function MotivRole({ roleKey }: { roleKey: string }) {
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(`${API}/api/motivation/roles`).then(r => r.json()).then(setData).catch(() => setData({ roles: [] }));
  }, []);
  if (!data) return <div style={{ color: MOTIV_MUTED }}>Загрузка…</div>;
  const role = (data.roles || []).find((r: any) => r.role === roleKey);
  if (!role || !role.months?.length) return <div style={{ color: MOTIV_MUTED }}>Нет данных</div>;
  const cur = currentMonthRu();
  const curM = role.months.find((m: any) => m.month === cur);
  const yearBonus = role.months.reduce((s: number, m: any) => s + (m.total || 0), 0);
  const bonusByMonth = MONTHS_RU.map(mn => (role.months.find((m: any) => m.month === mn)?.total) || 0);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ color: MOTIV_MUTED, marginBottom: 12 }}>{role.person}</div>

      <MotivBlock title="Аналитика">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <MotivCard label={`ИТОГО · ${cur}`} val={money0(curM?.total || 0)} />
          <MotivCard label={`Выполнение откр. · ${cur}`} val={curM?.openPct ? `${curM.openPct}%` : "—"} />
          <MotivCard label={`Выполнение закр. · ${cur}`} val={curM?.closePct ? `${curM.closePct}%` : "—"} />
          <MotivCard label="Бонусы за год" val={money0(yearBonus)} />
        </div>
        <MotivBars title="Бонус (ИТОГО) по месяцам" values={bonusByMonth} />
      </MotivBlock>

      <MotivBlock title="Вводные">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 800 }}>
          <thead><tr style={{ color: MOTIV_MUTED }}>
            <th style={{ textAlign: "left", padding: 4 }}>Месяц</th>
            {["Фикс", "План откр.", "Факт", "%", "Бонус", "План закр.", "Факт", "%", "Бонус", "ИТОГО"].map((h, i) => (
              <th key={i} style={{ textAlign: "right", padding: 4 }}>{h}</th>))}</tr></thead>
          <tbody>
            {role.months.map((m: any) => (
              <tr key={m.month} style={{ fontWeight: m.month === cur ? 700 : 400,
                background: m.month === cur ? "var(--surface-2)" : "none" }}>
                <td style={{ padding: 4 }}>{m.month}</td>
                {["fix", "openPlan", "openFact", "openPct", "openBonus", "closePlan", "closeFact", "closePct", "closeBonus", "total"]
                  .map(f => (
                    <td key={f} style={{ textAlign: "right", padding: 4 }}>
                      {f.includes("Pct") ? (m[f] ? m[f] + "%" : "—") : (m[f] ? money0(m[f]) : "—")}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </MotivBlock>
    </div>
  );
}

function MotivOwners() {
  const [d, setD] = React.useState<any>(null);
  React.useEffect(() => {
    fetch(`${API}/api/motivation/owners`).then(r => r.json()).then(setD).catch(() => setD({ empty: true }));
  }, []);
  if (!d) return <div style={{ color: MOTIV_MUTED }}>Загрузка…</div>;
  if (d.empty) return <div style={{ color: MOTIV_MUTED }}>Нет данных</div>;
  const curIdx = new Date().getMonth();
  const rowsSpec: [string, number[]][] = [
    ["Чистая прибыль (план)", d.netProfit.plan],
    ["Чистая прибыль (факт)", d.netProfit.fact],
    ["Дивиденды начислено (план)", d.dividendsAccrued.plan],
    ["Дивиденды начислено (факт)", d.dividendsAccrued.fact],
    ["Дивиденды выплачено (ДДС)", d.dividendsPaid],
    ["Вклады собственников", d.ownerContributions],
  ];
  const maxNp = Math.max(1, ...d.netProfit.plan, ...d.netProfit.fact);
  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const year = new Date().getFullYear();
  return (
    <div style={{ overflowX: "auto" }}>
      <MotivBlock title="Аналитика">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <MotivCard label={`Чистая прибыль факт · ${year}`} val={money0(sum(d.netProfit.fact))} />
          <MotivCard label={`Дивиденды начислено · ${year}`} val={money0(sum(d.dividendsAccrued.fact))} />
          <MotivCard label={`Дивиденды выплачено · ${year}`} val={money0(Math.abs(sum(d.dividendsPaid)))} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Чистая прибыль: план vs факт · {year}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 100, maxWidth: 900 }}>
          {d.months.map((m: string, i: number) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 84 }}>
                <div title={`план ${money0(d.netProfit.plan[i])}`}
                  style={{ flex: 1, height: Math.max(2, (d.netProfit.plan[i] / maxNp) * 80), background: "var(--success-border)", borderRadius: 2 }} />
                <div title={`факт ${money0(d.netProfit.fact[i])}`}
                  style={{ flex: 1, height: Math.max(2, (d.netProfit.fact[i] / maxNp) * 80),
                    background: i === curIdx ? MOTIV_ACCENT : "#7fae9c", borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: i === curIdx ? MOTIV_ACCENT : MOTIV_MUTED,
                fontWeight: i === curIdx ? 700 : 400, marginTop: 4 }}>{m.slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </MotivBlock>

      <MotivBlock title="Вводные">
        <table style={{ borderCollapse: "collapse", fontSize: 12, minWidth: 900 }}>
          <thead><tr><th style={{ textAlign: "left", padding: 4 }}></th>
            {d.months.map((m: string, i: number) => (
              <th key={i} style={{ textAlign: "right", padding: 4, color: i === curIdx ? MOTIV_ACCENT : MOTIV_MUTED,
                fontWeight: i === curIdx ? 700 : 500 }}>{m.slice(0, 3)}</th>))}</tr></thead>
          <tbody>
            {rowsSpec.map(([label, arr]) => (
              <tr key={label}><td style={{ padding: 4, whiteSpace: "nowrap" }}>{label}</td>
                {arr.map((n, i) => (
                  <td key={i} style={{ textAlign: "right", padding: 4,
                    color: n < 0 ? "var(--danger-ink)" : "var(--ink)", whiteSpace: "nowrap" }}>{n ? money0(n) : "—"}</td>))}</tr>
            ))}
          </tbody>
        </table>
      </MotivBlock>
    </div>
  );
}

function MotivKpi({ role }: { role: string }) {
  const [month, setMonth] = React.useState(currentMonthRu());
  const [d, setD] = React.useState<any>(null);
  const [year, setYear] = React.useState<any>(null);
  React.useEffect(() => {
    setD(null);
    fetch(`${API}/api/motivation/kpi?role=${role}&month=${encodeURIComponent(month)}`)
      .then(r => r.json()).then(setD).catch(() => setD({ empty: true }));
  }, [role, month]);
  React.useEffect(() => {
    setYear(null);
    fetch(`${API}/api/motivation/kpi-year?role=${role}`).then(r => r.json()).then(setYear).catch(() => {});
  }, [role]);
  return (
    <div>
      {d && d.person && <div style={{ color: MOTIV_MUTED, marginBottom: 12 }}>{d.person}</div>}
      <MotivMonthSelect month={month} onChange={setMonth} />

      <MotivBlock title="Аналитика">
        {!d ? <div style={{ color: MOTIV_MUTED }}>Загрузка…</div>
          : d.empty ? <div style={{ color: MOTIV_MUTED }}>Нет данных за {month}</div> : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {([[`Оклад · ${month}`, d.fact?.oklad], ["К1", d.fact?.k1], ["К2", d.fact?.k2],
               ["К3", d.fact?.k3], ["ИТОГО", d.fact?.itogo]] as [string, number][])
              .filter(([, v]) => v)
              .map(([l, v]) => <MotivCard key={l} label={l} val={money0(v)} />)}
          </div>
        )}
        {year && year.itogoByMonth && <MotivBars title="Факт ФОТ (ИТОГО) по месяцам" values={year.itogoByMonth} />}
      </MotivBlock>

      {d && !d.empty && (d.kpis || []).length > 0 && (
        <MotivBlock title={`Вводные · ${month}`}>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr style={{ color: MOTIV_MUTED }}>
              <th style={{ textAlign: "left", padding: 4 }}>KPI</th>
              {["План", "Факт", "%", "Коэфф."].map(h => (
                <th key={h} style={{ textAlign: "right", padding: 4 }}>{h}</th>))}</tr></thead>
            <tbody>
              {d.kpis.map((k: any, i: number) => (
                <tr key={i}><td style={{ padding: 4 }}>{k.name}</td>
                  <td style={{ textAlign: "right", padding: 4 }}>{money0(k.plan)}</td>
                  <td style={{ textAlign: "right", padding: 4 }}>{money0(k.fact)}</td>
                  <td style={{ textAlign: "right", padding: 4 }}>{k.pct || "—"}</td>
                  <td style={{ textAlign: "right", padding: 4 }}>{k.coef}</td></tr>
              ))}
            </tbody>
          </table>
        </MotivBlock>
      )}
    </div>
  );
}

function MotivHr() {
  const [month, setMonth] = React.useState(currentMonthRu());
  const [d, setD] = React.useState<any>(null);
  const [year, setYear] = React.useState<any>(null);
  React.useEffect(() => {
    setD(null);
    fetch(`${API}/api/hr/salary?month=${encodeURIComponent(month)}`)
      .then(r => r.json()).then(setD).catch(() => setD({ empty: true }));
  }, [month]);
  React.useEffect(() => {
    fetch(`${API}/api/motivation/hr-year`).then(r => r.json()).then(setYear).catch(() => {});
  }, []);
  return (
    <div>
      <div style={{ color: MOTIV_MUTED, marginBottom: 12 }}>Мотивация HR-менеджера (Юлия)</div>
      <MotivMonthSelect month={month} onChange={setMonth} />

      <MotivBlock title="Аналитика">
        {!d ? <div style={{ color: MOTIV_MUTED }}>Загрузка…</div>
          : (d.empty || !d.salary) ? <div style={{ color: MOTIV_MUTED }}>Нет данных за {month}</div> : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <MotivCard label={`Оклад · ${month}`} val={money0(d.salary.oklad)} />
            <MotivCard label="Премия (100%)" val={money0(d.salary.premia)} />
            <MotivCard label="Факт премии" val={money0(d.totals?.fact_premii)} />
            <MotivCard label="Итого ФОТ" val={money0(d.totals?.total_fot)} />
            <MotivCard label="Выполнение" val={`${d.overall_pct ?? 0}%`} />
          </div>
        )}
        {year && year.fotByMonth && <MotivBars title="Факт ФОТ по месяцам" values={year.fotByMonth} />}
      </MotivBlock>

      {d && !d.empty && d.salary && (
        <MotivBlock title={`Вводные · ${month}`}>
          {d.plan_text && <div style={{ color: MOTIV_MUTED, fontSize: 13, marginBottom: 12 }}>{d.plan_text}</div>}
          {(d.kpi || []).length > 0 && (
            <table style={{ borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
              <thead><tr style={{ color: MOTIV_MUTED }}>
                <th style={{ textAlign: "left", padding: 4 }}>KPI</th>
                {["Вес", "План", "Факт", "%", "Премия"].map(h => (
                  <th key={h} style={{ textAlign: "right", padding: 4 }}>{h}</th>))}</tr></thead>
              <tbody>
                {d.kpi.map((k: any, i: number) => (
                  <tr key={i}><td style={{ padding: 4 }}>{k.name}</td>
                    <td style={{ textAlign: "right", padding: 4 }}>{k.weight}%</td>
                    <td style={{ textAlign: "right", padding: 4 }}>{k.plan}</td>
                    <td style={{ textAlign: "right", padding: 4 }}>{k.fact}</td>
                    <td style={{ textAlign: "right", padding: 4 }}>{k.pct}%</td>
                    <td style={{ textAlign: "right", padding: 4 }}>{money0(k.fact_premii)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {(d.smart_tasks || []).length > 0 && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>SMART-задачи</div>
              {d.smart_tasks.map((t: string, i: number) => (
                <div key={i} style={{ fontSize: 13, padding: "2px 0" }}>{t}</div>
              ))}
            </div>
          )}
        </MotivBlock>
      )}
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────────────
// ── New Direction Modal ──────────────────────────────────────────────────────
function NewDirectionModal({ onSave, onClose }: { onSave: (d: Direction) => void; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  const save = async () => {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/directions/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), color }),
      });
      if (!res.ok) throw new Error("server error");
      const d = await res.json();
      onSave(d);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, minWidth: 320, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Новый раздел</div>
        <input ref={ref} value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Название раздела"
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
          style={{ width: "100%", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        <div style={{ marginTop: 14, marginBottom: 4, fontSize: 12, color: "var(--muted)" }}>Цвет раздела</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {PRESET_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)}
              style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "3px solid var(--ink)" : "2px solid transparent", boxSizing: "border-box" }} />
          ))}
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 26, height: 26, borderRadius: "50%", border: "none", padding: 0, cursor: "pointer", background: "none" }} />
        </div>
        {/* Preview */}
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8, background: "#f9f9f9", borderRadius: 8, padding: "8px 12px" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: color }}>{label || "Название раздела"}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} disabled={!label.trim() || saving}
            style={{ flex: 1, background: "var(--ink)", color: "var(--surface)", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "Создание…" : "Создать раздел"}
          </button>
          <button onClick={onClose}
            style={{ background: "none", color: "var(--muted)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recurring Delete Modal ──────────────────────────────────────────────────
type RecurringDeleteOption = "this" | "following" | "all";

function RecurringDeleteModal({ taskTitle, onSelect, onClose }: {
  taskTitle: string;
  onSelect: (opt: RecurringDeleteOption) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<RecurringDeleteOption>("this");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 14, padding: 24, minWidth: 320, maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Удалить повторяющееся событие</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{taskTitle}</div>
        {(["this", "following", "all"] as RecurringDeleteOption[]).map(opt => {
          const labels: Record<RecurringDeleteOption, string> = {
            this: "Только это событие",
            following: "Это и следующие события",
            all: "Все события",
          };
          return (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: selected === opt ? "var(--border)" : "transparent", marginBottom: 4 }}>
              <input type="radio" name="recurringDelete" checked={selected === opt} onChange={() => setSelected(opt)}
                style={{ accentColor: "var(--ink)", width: 16, height: 16 }} />
              <span style={{ fontSize: 14 }}>{labels[opt]}</span>
            </label>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => onSelect(selected)}
            style={{ flex: 1, background: "var(--ink)", color: "var(--surface)", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Удалить
          </button>
          <button onClick={onClose}
            style={{ background: "none", color: "var(--muted)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Material Viewer ───────────────────────────────────────────────────────────
function isYaDisk(url: string) {
  return url.includes("disk.yandex.ru");
}

function MaterialViewer({ material, sectionTitle, onBack }: { material: LMaterial; sectionTitle: string; onBack: () => void }) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!material.content_url) return;
    if (isYaDisk(material.content_url)) {
      setLoading(true);
      fetch(`/api/yadisk?url=${encodeURIComponent(material.content_url)}`)
        .then(r => r.json())
        .then(d => { setDirectUrl(d.href); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setDirectUrl(material.content_url);
    }
  }, [material.content_url]);

  const url = directUrl;

  return (
    <div>
      <button onClick={onBack} style={{ marginBottom: 20, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, display: "flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit" }}>
        ← {sectionTitle}
      </button>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
        <div style={{ marginBottom: 4, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>{TYPE_LABELS[material.type]}</div>
        <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{material.title}</h2>
        {loading && <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: 14 }}>Загрузка...</div>}
        {!loading && material.type === "presentation" && material.content_url && (
          <button
            onClick={async () => {
              if (isYaDisk(material.content_url!)) {
                const res = await fetch(`/api/yadisk?url=${encodeURIComponent(material.content_url!)}`);
                const { href } = await res.json();
                window.open(href, "_blank");
              } else {
                window.open(material.content_url!, "_blank");
              }
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#1A6B52", color: "var(--surface)", borderRadius: 10, padding: "14px 24px", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            📄 Открыть презентацию
          </button>
        )}
        {!loading && material.type === "video" && material.content_url && (
          <a href={material.content_url} target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#1A6B52", color: "var(--surface)", borderRadius: 10, padding: "14px 24px", fontSize: 14, fontWeight: 500, textDecoration: "none", fontFamily: "inherit" }}>
            ▶ Смотреть видео
          </a>
        )}
        {!loading && material.type === "article" && material.content_text && (
          <div style={{ lineHeight: 1.7, color: "#374151" }} dangerouslySetInnerHTML={{ __html: material.content_text }} />
        )}
        {!loading && !url && !material.content_text && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: 14 }}>Контент ещё не добавлен</div>
        )}
      </div>
    </div>
  );
}

// ── Learning Panel ────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type LSection = { id: string; title: string; description: string; order: number };
type LMaterial = { id: string; section_id: string; title: string; type: string; content_url: string | null; content_text: string | null };

const SECTION_COLORS: Record<string, string> = {
  "Продажи": "#1A6B52",
  "Маркетинг": "#2563eb",
  "Управление командой": "#d97706",
  "Продукт": "#7c3aed",
  "Юридическая база": "var(--danger)",
};
const SECTION_ICONS: Record<string, string> = {
  "Продажи": "↗", "Маркетинг": "◎", "Управление командой": "👥", "Продукт": "⌂", "Юридическая база": "⚖",
};
const TYPE_LABELS: Record<string, string> = {
  video: "Видео", article: "Статья", presentation: "Презентация", test: "Тест",
};

function LearningPanel() {
  const [sections, setSections] = useState<LSection[]>([]);
  const [activeSection, setActiveSection] = useState<LSection | null>(null);
  const [materials, setMaterials] = useState<LMaterial[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [activeMaterial, setActiveMaterial] = useState<LMaterial | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [newMatTitle, setNewMatTitle] = useState("");
  const [newMatType, setNewMatType] = useState("presentation");
  const [newMatUrl, setNewMatUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("sections").select("*").order("order").then(({ data }) => {
      if (data) setSections(data);
    });
    supabase.from("materials").select("id, section_id").then(({ data }) => {
      if (data) {
        const c: Record<string, number> = {};
        data.forEach(m => { c[m.section_id] = (c[m.section_id] || 0) + 1; });
        setCounts(c);
      }
    });
  }, []);

  useEffect(() => {
    if (!activeSection) return;
    supabase.from("materials").select("*").eq("section_id", activeSection.id).order("order").then(({ data }) => {
      if (data) setMaterials(data);
    });
  }, [activeSection]);

  async function addSection() {
    if (!newSectionTitle.trim()) return;
    setSaving(true);
    const { data } = await supabase.from("sections").insert({ title: newSectionTitle.trim(), description: newSectionDesc.trim(), order: sections.length }).select().single();
    if (data) { setSections(s => [...s, data]); setNewSectionTitle(""); setNewSectionDesc(""); setShowAddSection(false); }
    setSaving(false);
  }

  async function addMaterial() {
    if (!newMatTitle.trim() || !activeSection) return;
    setSaving(true);
    const { data } = await supabase.from("materials").insert({
      section_id: activeSection.id, title: newMatTitle.trim(), type: newMatType,
      content_url: newMatUrl.trim() || null, order: materials.length
    }).select().single();
    if (data) {
      setMaterials(m => [...m, data]);
      setCounts(c => ({ ...c, [activeSection.id]: (c[activeSection.id] || 0) + 1 }));
      setNewMatTitle(""); setNewMatUrl(""); setShowAddMaterial(false);
    }
    setSaving(false);
  }

  if (activeMaterial) {
    return <MaterialViewer material={activeMaterial} sectionTitle={activeSection?.title || ""} onBack={() => setActiveMaterial(null)} />;
  }

  if (activeSection) {
    const color = SECTION_COLORS[activeSection.title] || "#1A6B52";
    return (
      <div>
        <button onClick={() => { setActiveSection(null); setMaterials([]); }} style={{ marginBottom: 20, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, display: "flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit" }}>
          ← Все разделы
        </button>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>{SECTION_ICONS[activeSection.title] || "📄"}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--ink)" }}>{activeSection.title}</h2>
                {activeSection.description && <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 13 }}>{activeSection.description}</p>}
              </div>
            </div>
            <button onClick={() => setShowAddMaterial(true)} style={{ background: color, color: "var(--surface)", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              + Добавить материал
            </button>
          </div>

          {showAddMaterial && (
            <div style={{ background: "#f8f8f8", borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={newMatTitle} onChange={e => setNewMatTitle(e.target.value)} placeholder="Название материала"
                  style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                <select value={newMatType} onChange={e => setNewMatType(e.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "var(--surface)" }}>
                  <option value="presentation">Презентация</option>
                  <option value="video">Видео</option>
                  <option value="article">Статья</option>
                </select>
                <input value={newMatUrl} onChange={e => setNewMatUrl(e.target.value)} placeholder="Ссылка на файл (Google Slides, YouTube, и т.д.)"
                  style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addMaterial} disabled={saving} style={{ background: "var(--ink)", color: "var(--surface)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>
                  <button onClick={() => setShowAddMaterial(false)} style={{ background: "none", color: "var(--muted)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          )}

          {materials.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: 14 }}>
              Материалов пока нет — нажми «Добавить материал»
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {materials.map(m => (
                <button key={m.id} onClick={() => setActiveMaterial(m)}
                  style={{ display: "flex", alignItems: "center", gap: 14, background: "none", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <span style={{ fontSize: 16 }}>{m.type === "video" ? "▶" : m.type === "article" ? "📄" : m.type === "test" ? "✓" : "📊"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{TYPE_LABELS[m.type]}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>Обучение</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Учебные материалы для команды</p>
        </div>
        <button onClick={() => setShowAddSection(true)} style={{ background: "var(--ink)", color: "var(--surface)", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          + Раздел
        </button>
      </div>

      {showAddSection && (
        <div style={{ background: "#f8f8f8", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} placeholder="Название раздела"
              style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
            <input value={newSectionDesc} onChange={e => setNewSectionDesc(e.target.value)} placeholder="Описание (необязательно)"
              style={{ padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addSection} disabled={saving} style={{ background: "var(--ink)", color: "var(--surface)", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {saving ? "Сохранение..." : "Создать"}
              </button>
              <button onClick={() => setShowAddSection(false)} style={{ background: "none", color: "var(--muted)", border: "1px solid var(--border-strong)", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#9ca3af", fontSize: 14 }}>
          Разделов пока нет — нажми «+ Раздел» чтобы создать первый
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {sections.map(section => {
            const color = SECTION_COLORS[section.title] || "#1A6B52";
            const icon = SECTION_ICONS[section.title] || "📄";
            const count = counts[section.id] || 0;
            return (
              <button key={section.id} onClick={() => setActiveSection(section)}
                style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "20px 20px 18px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s", fontFamily: "inherit" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", background: "var(--border)", borderRadius: 6, padding: "2px 8px" }}>
                    {count} {count === 1 ? "материал" : count >= 2 && count <= 4 ? "материала" : "материалов"}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 4 }}>{section.title}</div>
                {section.description && <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{section.description}</div>}
                <div style={{ marginTop: 14, height: 3, background: "var(--border)", borderRadius: 2 }}>
                  <div style={{ height: "100%", width: count > 0 ? "30%" : "0%", background: color, borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const DEAL_SELECT_STYLE: React.CSSProperties = {
  padding: "6px 10px", borderRadius: "var(--r-sm)", border: "1px solid var(--border-strong)",
  fontSize: 12, fontFamily: "inherit", background: "var(--surface)", color: "var(--ink)",
  cursor: "pointer", outline: "none", minWidth: 130,
};

// ── Deals Section (two tabs + cascading filters) ────────────────────────────
function DealsSection() {
  const [tab, setTab] = React.useState<"stuck" | "all">("stuck");
  const [meta, setMeta] = React.useState<DealsMeta | null>(null);
  const [metaLoading, setMetaLoading] = React.useState(true);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");
  const [selectedStage, setSelectedStage] = React.useState<string>("");
  const [deals, setDeals] = React.useState<RiskDeal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Load meta once
  React.useEffect(() => {
    setMetaLoading(true);
    fetch(`${API}/api/deals/meta`)
      .then(r => r.json())
      .then(d => setMeta(d))
      .catch(() => setMeta(null))
      .finally(() => setMetaLoading(false));
  }, []);

  // Reset stage when category changes
  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedStage("");
  };

  // Load deals when tab or filters change
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category_id", selectedCategory);
    if (selectedStage) params.set("stage_id", selectedStage);
    if (tab === "stuck") params.set("min_age", "14");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);

    fetch(`${API}/api/deals/list?${params.toString()}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error("server"); return r.json(); })
      .then(d => { if (!cancelled) setDeals(Array.isArray(d) ? d : []); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error && e.name === "AbortError" ? "Превышено время ожидания Bitrix" : "Нет соединения с сервером"); })
      .finally(() => { clearTimeout(timer); if (!cancelled) setLoading(false); });

    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [tab, selectedCategory, selectedStage, refreshKey]);

  // Available stages for selected category
  const availableStages: DealStage[] = React.useMemo(() => {
    if (!meta || !selectedCategory) return [];
    const cat = meta.categories.find(c => String(c.id) === selectedCategory);
    return cat ? cat.stages : [];
  }, [meta, selectedCategory]);

  // Full stage ID → name map from meta (all categories)
  const stageNameMap: Record<string, string> = React.useMemo(() => {
    if (!meta) return {};
    const map: Record<string, string> = {};
    for (const cat of meta.categories) {
      for (const s of cat.stages) {
        map[s.id] = s.name;
      }
    }
    return map;
  }, [meta]);

  const activeDeals = deals.filter(d => !d.is_fired);
  const firedDeals = deals.filter(d => d.is_fired);
  const byStage: Record<string, RiskDeal[]> = {};
  for (const d of activeDeals) {
    const stageName = stageNameMap[d.stage_id] || d.stage;
    if (!byStage[stageName]) byStage[stageName] = [];
    byStage[stageName].push(d);
  }
  const stages = Object.keys(byStage).sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a);
    const bi = STAGE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div>
      {/* Header with tabs and filters */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["stuck", "all"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "5px 14px", borderRadius: "var(--r-pill)", fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit", border: "1px solid",
              borderColor: tab === t ? "var(--ink)" : "var(--border-strong)",
              background: tab === t ? "var(--ink)" : "var(--surface)",
              color: tab === t ? "var(--surface)" : "var(--ink-2)",
              transition: "background var(--dur) var(--ease-out)",
            }}>
              {t === "stuck" ? "Зависшие" : "Все сделки"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={selectedCategory}
            onChange={e => handleCategoryChange(e.target.value)}
            style={DEAL_SELECT_STYLE}
            disabled={metaLoading}
          >
            <option value="">Все воронки</option>
            {(meta?.categories || []).map(cat => (
              <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
            ))}
          </select>
          <select
            value={selectedStage}
            onChange={e => setSelectedStage(e.target.value)}
            style={DEAL_SELECT_STYLE}
            disabled={!selectedCategory || metaLoading}
          >
            <option value="">Все стадии</option>
            {availableStages.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={() => { setSelectedCategory(""); setSelectedStage(""); }}
            style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
          >
            сбросить
          </button>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            style={{ fontSize: 11, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            ↻ обновить
          </button>
        </div>
      </div>

      {/* Deals list */}
      {(loading || metaLoading) ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13, marginBottom: 32 }}>
          Загрузка из Bitrix…
        </div>
      ) : error ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 28, textAlign: "center", fontSize: 13, marginBottom: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: "var(--r-pill)", background: "var(--danger-soft)", color: "var(--danger)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
          </span>
          <div style={{ color: "var(--ink)", fontWeight: 500 }}>{error}</div>
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ fontSize: 12, color: "var(--ink-2)", background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-xs)", padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", transition: "background var(--dur) var(--ease-out)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}>
            Попробовать снова
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {activeDeals.length === 0 && firedDeals.length === 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: 28, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              {tab === "stuck" ? "Зависших сделок нет" : "Сделок не найдено"}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: firedDeals.length > 0 ? 10 : 0 }}>
            {stages.map(stage => (
              <DealStageGroup key={stage} stage={stage} deals={byStage[stage]} />
            ))}
          </div>
          {firedDeals.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--danger-border)", borderRadius: "var(--r-md)", overflow: "hidden", marginTop: 6 }}>
              <div style={{ padding: "13px 20px", background: "var(--danger-soft)", borderBottom: "1px solid var(--danger-border)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--danger-ink)", flex: 1 }}>Сделки уволенных сотрудников</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--danger-ink)", background: "var(--danger-border)", borderRadius: "var(--r-pill)", padding: "2px 8px" }}>{firedDeals.length}</span>
                <span style={{ fontSize: 12, color: "var(--danger)" }}>требуют переназначения</span>
              </div>
              {firedDeals.map((d, i) => <DealRow key={d.url} d={d} last={i === firedDeals.length - 1} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("deals");
  const [navEdit, setNavEdit] = useState(false);
  const [navOrder, setNavOrder] = useState<string[]>(NAV_ITEMS.map(i => i.key));
  const [navHidden, setNavHidden] = useState<string[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [addingGlobal, setAddingGlobal] = useState(false);
  const [archiveKey, setArchiveKey] = useState(0);
  const [directions, setDirections] = useState<Direction[]>([]);
  const [showNewDirection, setShowNewDirection] = useState(false);
  const [undoState, setUndoState] = useState<{ task: Task; timerId: ReturnType<typeof setTimeout> } | null>(null);
  const [recurringDelete, setRecurringDelete] = useState<{ task: Task; date?: string } | null>(null);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/tasks/?is_done=false`);
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch { setTasks([]); }
    setLoading(false);
  };

  const fetchDirections = async () => {
    try {
      const res = await fetch(`${API}/api/directions/`);
      const data = await res.json();
      dirStore.list = Array.isArray(data) ? data : [];
      setDirections([...dirStore.list]);
    } catch { dirStore.list = []; }
  };

  useEffect(() => { fetchTasks(); fetchDirections(); }, []);

  // Персональная настройка меню (порядок + скрытые разделы) — хранится в браузере
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("oazis_nav_v1") || "{}");
      const allKeys = NAV_ITEMS.map(i => i.key);
      const savedOrder: string[] = Array.isArray(saved.order) ? saved.order.filter((k: string) => allKeys.includes(k)) : [];
      setNavOrder([...savedOrder, ...allKeys.filter(k => !savedOrder.includes(k))]);
      setNavHidden(Array.isArray(saved.hidden) ? saved.hidden.filter((k: string) => allKeys.includes(k)) : []);
    } catch {}
  }, []);
  useEffect(() => {
    localStorage.setItem("oazis_nav_v1", JSON.stringify({ order: navOrder, hidden: navHidden }));
  }, [navOrder, navHidden]);

  const reorderNav = (from: string, to: string) => {
    if (from === to) return;
    setNavOrder(prev => {
      const arr = prev.filter(k => k !== from);
      const idx = arr.indexOf(to);
      if (idx < 0) return prev;
      arr.splice(idx, 0, from);
      return arr;
    });
  };
  const hideNav = (key: string, label: string) => {
    if (!confirm(`Вы точно хотите удалить раздел «${label}»?`)) return;
    setNavHidden(prev => (prev.includes(key) ? prev : [...prev, key]));
    if (activeTab === key) {
      const nextKey = navOrder.find(k => k !== key && !navHidden.includes(k));
      if (nextKey) setActiveTab(nextKey);
    }
  };
  const restoreNav = () => setNavHidden([]);

  // Optimistic updates — no page scroll
  const markDone = (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    fetch(`${API}/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_done: true }) });
    setArchiveKey(k => k + 1);
  };

  const restoreTask = (id: number) => {
    fetch(`${API}/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_done: false }) })
      .then(() => fetchTasks());
    setArchiveKey(k => k + 1);
  };

  const permanentlyDelete = (id: number, taskSnapshot?: Task) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    setArchiveKey(k => k + 1);

    if (undoState) {
      clearTimeout(undoState.timerId);
      fetch(`${API}/api/tasks/${undoState.task.id}`, { method: "DELETE" });
    }

    const task = taskSnapshot || tasks.find(t => t.id === id) || null;
    if (!task) { fetch(`${API}/api/tasks/${id}`, { method: "DELETE" }); return; }

    const timerId = setTimeout(() => {
      fetch(`${API}/api/tasks/${id}`, { method: "DELETE" });
      setUndoState(null);
    }, 5000);

    setUndoState({ task, timerId });
  };

  const deleteTask = (id: number, date?: string) => {
    const task = tasks.find(t => t.id === id) || null;
    if (task && task.repeat && task.repeat !== "none") {
      setRecurringDelete({ task, date });
      return;
    }
    permanentlyDelete(id, task || undefined);
  };

  const handleRecurringDelete = (option: RecurringDeleteOption) => {
    if (!recurringDelete) return;
    const { task, date } = recurringDelete;
    setRecurringDelete(null);

    if (option === "all") {
      permanentlyDelete(task.id, task);
    } else if (option === "this" && date) {
      const newExcluded = task.excluded_dates
        ? task.excluded_dates + "," + date
        : date;
      updateTask(task.id, { excluded_dates: newExcluded });
    } else if (option === "following" && date) {
      const d = new Date(date + "T00:00:00");
      d.setDate(d.getDate() - 1);
      const until = d.toISOString().split("T")[0];
      updateTask(task.id, { repeat_until: until });
    } else {
      permanentlyDelete(task.id, task);
    }
  };

  const undoDelete = () => {
    if (!undoState) return;
    clearTimeout(undoState.timerId);
    setTasks(prev => [...prev, undoState.task]);
    setUndoState(null);
  };

  const updateTask = (id: number, data: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    fetch(`${API}/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  };

  const createTask = async (data: Partial<Task>) => {
    const res = await fetch(`${API}/api/tasks/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: data.title, description: data.description || null, direction: data.direction || "personal", priority: data.priority || "medium", deadline: data.deadline || null, repeat: data.repeat || "none", repeat_days: data.repeat_days || null, scheduled_time: data.scheduled_time || null }),
    });
    const created = await res.json();
    setTasks(prev => [...prev, created]);
  };

  const duplicateTask = async (task: Task) => {
    const res = await fetch(`${API}/api/tasks/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: task.title, description: task.description || null, direction: task.direction, priority: task.priority, deadline: task.deadline || null }),
    });
    const created = await res.json();
    setTasks(prev => [...prev, created]);
  };

  const today = new Date().toISOString().split("T")[0];
  const dateLabel = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });

  const filtered = filter === "all" ? tasks
    : filter === "today" ? tasks.filter(t => t.deadline && t.deadline <= today)
    : tasks.filter(t => t.direction === filter);

  const groupedTasks: Record<string, Task[]> = {};
  for (const task of filtered) {
    const dir = task.direction || "other";
    if (!groupedTasks[dir]) groupedTasks[dir] = [];
    groupedTasks[dir].push(task);
  }
  const sortedDirections = dirOrder().filter(d => groupedTasks[d]);

  const overdue = tasks.filter(t => t.deadline && t.deadline < today).length;

  const orderedNav = navOrder.map(k => NAV_ITEMS.find(i => i.key === k)).filter(Boolean) as typeof NAV_ITEMS;
  const visibleNav = orderedNav.filter(i => !navHidden.includes(i.key));
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font-inter), -apple-system, sans-serif", color: "var(--ink)", display: "flex" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, minHeight: "100vh", background: "var(--surface)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.svg" alt="Oazis Estate" style={{ width: 32, height: 32, filter: "invert(27%) sepia(51%) saturate(500%) hue-rotate(115deg) brightness(85%)" }} />
            <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.3px", color: "var(--ink)" }}>Oazis Estate</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "var(--faint)", textTransform: "uppercase", letterSpacing: "0.8px" }}>Кабинет</span>
            <button onClick={() => setNavEdit(v => !v)} title="Настроить меню"
              style={{ background: "none", border: "none", cursor: "pointer", color: navEdit ? "var(--brand)" : "var(--muted)", fontSize: 11, fontWeight: 600, fontFamily: "inherit", padding: 0 }}>
              {navEdit ? "Готово" : "Настроить"}
            </button>
          </div>
          {visibleNav.map((item) => {
            const active = activeTab === item.key;
            const dragging = dragKey === item.key;
            return (
              <div key={item.key}
                draggable={navEdit}
                onDragStart={navEdit ? (e) => { setDragKey(item.key); e.dataTransfer.effectAllowed = "move"; } : undefined}
                onDragOver={navEdit ? (e) => { e.preventDefault(); if (dragKey && dragKey !== item.key) reorderNav(dragKey, item.key); } : undefined}
                onDragEnd={navEdit ? () => setDragKey(null) : undefined}
                onDrop={navEdit ? (e) => { e.preventDefault(); setDragKey(null); } : undefined}
                style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2, borderRadius: "var(--r-sm)", opacity: dragging ? 0.4 : 1, background: dragging ? "var(--surface-2)" : "transparent" }}
              >
                <button
                  onClick={() => { if (!navEdit) setActiveTab(item.key); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0,
                    padding: "8px 12px", borderRadius: "var(--r-sm)", border: "none", cursor: navEdit ? "grab" : "pointer",
                    background: active ? "var(--brand-soft)" : "transparent", fontFamily: "inherit",
                    color: active ? "var(--brand-ink)" : "var(--ink-2)",
                    fontWeight: active ? 600 : 500, fontSize: 13, textAlign: "left",
                    transition: "background var(--dur) var(--ease-out), color var(--dur) var(--ease-out)",
                  }}
                  onMouseEnter={e => { if (!active && !navEdit) e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  {navEdit && <span aria-hidden style={{ color: "var(--faint)", fontSize: 15, lineHeight: 1, flexShrink: 0, letterSpacing: "-2px" }}>⠿</span>}
                  <span style={{ width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: active ? "var(--brand)" : "var(--muted)" }}><NavIcon k={item.key} /></span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                </button>
                {navEdit && (
                  <button title="Удалить раздел" onClick={() => hideNav(item.key, item.label)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 16, lineHeight: 1, padding: "2px 8px", flexShrink: 0, fontFamily: "inherit" }}>×</button>
                )}
              </div>
            );
          })}
          {navEdit && navHidden.length > 0 && (
            <button onClick={restoreNav}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 8, padding: "8px 12px", borderRadius: "var(--r-sm)", border: "1px dashed var(--border-strong)", background: "transparent", cursor: "pointer", color: "var(--ink-2)", fontSize: 12.5, fontFamily: "inherit" }}>
              ↩ Вернуть скрытые ({navHidden.length})
            </button>
          )}
        </nav>

        {/* Bottom date */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "capitalize" }}>{dateLabel}</div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px" }}>

        {activeTab === "deals" && (
          <>
            {/* Риск-баннер */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
              <StatCard label="Под риском" value="—" hint="комиссий без движения" />
              <StatCard label="Зависших сделок" value="—" hint="требуют внимания" />
              <StatCard label="Задач просрочено" value={overdue} hint={`из ${tasks.length} активных`} tone={overdue > 0 ? "danger" : "default"} />
            </div>

            {/* Зависшие / Все сделки */}
            <DealsSection />

            {/* Задачи — шапка */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setShowArchive(false)}
                  style={{ background: !showArchive ? "var(--ink)" : "var(--surface)", color: !showArchive ? "var(--surface)" : "var(--ink-2)", border: "1px solid " + (!showArchive ? "var(--ink)" : "var(--border-strong)"), borderRadius: "var(--r-pill)", padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background var(--dur) var(--ease-out)" }}>
                  Неделя
                </button>
                <button onClick={() => setShowArchive(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, background: showArchive ? "var(--ink)" : "var(--surface)", color: showArchive ? "var(--surface)" : "var(--ink-2)", border: "1px solid " + (showArchive ? "var(--ink)" : "var(--border-strong)"), borderRadius: "var(--r-pill)", padding: "5px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background var(--dur) var(--ease-out)" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></svg>
                  Архив
                </button>
              </div>
              {!showArchive && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowNewDirection(true)}
                    style={{ background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "7px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "background var(--dur) var(--ease-out)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--surface-2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; }}>
                    + Раздел
                  </button>
                  <button onClick={() => setAddingGlobal(true)}
                    style={{ background: "var(--brand)", color: "var(--surface)", border: "none", borderRadius: "var(--r-sm)", padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxShadow: "var(--shadow-xs)", transition: "background var(--dur) var(--ease-out)" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--brand-hover)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--brand)"; }}>
                    + Новая задача
                  </button>
                </div>
              )}
            </div>

            {showArchive ? (
              <ArchivePanel key={archiveKey} today={today} onRestore={restoreTask} onDelete={deleteTask} onDuplicate={duplicateTask} />
            ) : (
              <>
                {addingGlobal && (
                  <div style={{ marginBottom: 12 }}>
                    <TaskEditForm
                      onSave={async data => { await createTask(data); setAddingGlobal(false); }}
                      onCancel={() => setAddingGlobal(false)} />
                  </div>
                )}
                {loading ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "var(--muted)", fontSize: 13 }}>Загрузка…</div>
                ) : (
                  <WeeklyView
                    tasks={tasks} today={today}
                    onDone={markDone} onDelete={deleteTask} onUpdate={updateTask}
                    onDuplicate={duplicateTask} onAdd={createTask}
                  />
                )}
              </>
            )}
          </>
        )}

        {activeTab === "sales" && (
          <SalesDashboard />
        )}

        {activeTab === "support" && (
          <SupportTable />
        )}

        {activeTab === "knowledge" && (
          <LearningPanel />
        )}

        {activeTab === "content" && <ContentSprint />}

        {activeTab === "team" && <TeamSection />}
        {activeTab === "brokers" && <ExpensesSection />}
        {activeTab === "rnp" && <RnpEfficiencySection />}
        {activeTab === "ssp" && <SspSection />}
        {activeTab === "ceo" && <CeoReportSection />}

        {activeTab === "weekly" && <HRDashboard />}
        {activeTab === "finance" && <FinanceSection />}
        {activeTab === "motivation" && <MotivationSection />}
        {activeTab === "legal" && <LegalSection />}
        {activeTab === "legal_processes" && <LegalProcessesSection />}
        {activeTab === "competitors" && <MarketSection />}

      </main>
      </div>{/* end main content */}
      {recurringDelete && (
        <RecurringDeleteModal
          taskTitle={recurringDelete.task.title}
          onSelect={handleRecurringDelete}
          onClose={() => setRecurringDelete(null)}
        />
      )}

      {undoState && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "var(--ink)", color: "var(--surface)", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.25)", zIndex: 9999, fontSize: 13, whiteSpace: "nowrap" }}>
          <span>Задача удалена: <b>{undoState.task.title}</b></span>
          <button onClick={undoDelete}
            style={{ background: "var(--surface)", color: "var(--ink)", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            Отменить
          </button>
        </div>
      )}

      {showNewDirection && (
        <NewDirectionModal
          onSave={d => { dirStore.list = [...dirStore.list, d]; setDirections([...dirStore.list]); }}
          onClose={() => setShowNewDirection(false)}
        />
      )}
    </div>
  );
}
