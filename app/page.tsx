"use client";
import React, { useEffect, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const API = "http://localhost:8000";

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
  "#ea580c","#c026d3","#0891b2","#e53e3e","#6b7280",
];

const PRIORITY_OPTIONS = [
  { value: "high", label: "Высокий", color: "#e53e3e" },
  { value: "medium", label: "Средний", color: "#f6ad55" },
  { value: "low", label: "Низкий", color: "#68d391" },
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
  { key: "sales",       label: "Отдел продаж",    icon: "↗"  },
  { key: "support",     label: "Сопровождение",   icon: "✓"  },
  { key: "rnp",         label: "Эффективность компании", icon: "📋" },
  { key: "weekly",      label: "HR",              icon: "📅" },
  { key: "knowledge",   label: "Обучение",        icon: "📖" },
  { key: "finance",     label: "Финансы",         icon: "₽"  },
  { key: "brokers",     label: "Расходы компании", icon: "💳" },
  { key: "team",        label: "Команда",         icon: "👥" },
  { key: "legal",       label: "Юр-риски",        icon: "⚖"  },
  { key: "competitors", label: "Рынок",            icon: "⊛"  },
];
const DEPARTMENTS = NAV_ITEMS;

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
    width: "100%", border: "1px solid #e0e0e0", borderRadius: 6, padding: "6px 10px",
    fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", boxSizing: "border-box" as const,
  };

  return (
    <div style={{ background: "#f9f9f9", border: "1px solid #ddd", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
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
                padding: "4px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                fontFamily: "inherit", border: "1.5px solid",
                borderColor: repeat === opt.value ? "#111" : "#e0e0e0",
                background: repeat === opt.value ? "#111" : "#fff",
                color: repeat === opt.value ? "#fff" : "#555",
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
                  borderColor: repeatDays.includes(d.key) ? "#111" : "#e0e0e0",
                  background: repeatDays.includes(d.key) ? "#111" : "#fff",
                  color: repeatDays.includes(d.key) ? "#fff" : "#777",
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
          style={{ background: "#111", color: "#fff", border: "none", borderRadius: 6, padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
        <button onClick={onCancel}
          style={{ background: "none", color: "#999", border: "1px solid #e0e0e0", borderRadius: 6, padding: "7px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
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
    <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 10, padding: 12, zIndex: 200, minWidth: 190, boxShadow: "0 4px 16px rgba(0,0,0,0.10)" }}>
      {options.map(o => {
        const v = o.date.toISOString().split("T")[0];
        return (
          <div key={v} onClick={() => { onSelect(v); onClose(); }}
            style={{ padding: "7px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f5f5f5")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}>
            <span>{o.label}</span>
            <span style={{ color: "#999", fontSize: 11 }}>{fmtDeadline(v)}</span>
          </div>
        );
      })}
      <div style={{ borderTop: "1px solid #f0f0f0", marginTop: 6, paddingTop: 8 }}>
        <input type="date" value={custom} onChange={e => setCustom(e.target.value)}
          style={{ width: "100%", border: "1px solid #e0e0e0", borderRadius: 6, padding: "5px 8px", fontSize: 12, fontFamily: "inherit" }} />
        {custom && (
          <button onClick={() => { onSelect(custom); onClose(); }}
            style={{ marginTop: 6, width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: 6, padding: "6px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            Выбрать
          </button>
        )}
      </div>
      <button onClick={onClose} style={{ marginTop: 4, width: "100%", background: "none", border: "none", color: "#bbb", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Закрыть</button>
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
  const priorityDot: Record<string, string> = { high: "#e53e3e", medium: "#f6ad55", low: "#68d391" };

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
    background: "none", border: "1px solid #e8e8e8", borderRadius: 6, padding: "3px 8px",
    fontSize: 11, color: "#888", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const,
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setShowPostpone(false); }}
      style={{
        background: isArchive ? "#fafafa" : "#fff",
        border: "1px solid #ebebeb", borderRadius: 10, padding: "11px 14px",
        display: "flex", alignItems: "flex-start", gap: 10,
        boxShadow: hovered ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
        opacity: isArchive ? 0.75 : 1,
      }}>
      {/* Checkbox */}
      <button onClick={onDone}
        style={{
          marginTop: 3, width: 16, height: 16, borderRadius: "50%",
          border: isArchive ? "1.5px solid #68d391" : "1.5px solid #ddd",
          background: isArchive ? "#68d391" : "none",
          cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
        }}
        title={isArchive ? "Вернуть в работу" : "Отметить выполненной"}>
        {isArchive && <span style={{ color: "#fff", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <span
            style={{ fontSize: 14, fontWeight: 500, cursor: "pointer", textDecoration: isArchive ? "line-through" : "none", color: isArchive ? "#999" : "#111" }}
            onDoubleClick={() => !isArchive && setEditing(true)}
            title={isArchive ? "" : "Двойной клик для редактирования"}>
            {task.title}
          </span>
          {!isArchive && <div style={{ width: 6, height: 6, borderRadius: "50%", background: priorityDot[task.priority] || "#ddd", flexShrink: 0, marginTop: 5 }} />}
        </div>
        {task.description && (
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
            {task.description}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
          {isArchive ? (
            <>
              {task.created_at && (
                <span style={{ fontSize: 11, color: "#bbb" }}>
                  Поставлена: {fmtDate(task.created_at)}
                </span>
              )}
              {task.done_at && (
                <span style={{ fontSize: 11, color: "#68d391", fontWeight: 500 }}>
                  Выполнена: {fmtDate(task.done_at)}
                </span>
              )}
              {task.deadline && (
                <span style={{ fontSize: 11, color: "#bbb" }}>
                  Срок: {fmtDeadline(task.deadline)}
                </span>
              )}
            </>
          ) : (
            <>
              {task.deadline && (
                <span style={{ fontSize: 11, color: isOverdue ? "#e53e3e" : "#bbb", fontWeight: isOverdue ? 600 : 400 }}>
                  {isOverdue ? "⚠ " : ""}до {fmtDeadline(task.deadline)}
                </span>
              )}
              {task.repeat !== "none" && <span style={{ fontSize: 11, color: "#bbb" }}>↻ повтор</span>}
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
                style={{ ...btnStyle, color: "#e53e3e", borderColor: "#fdd" }}
                onClick={onDelete}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff5f5"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
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
        <span style={{ fontSize: 11, color: "#bbb", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.15s" }}>▼</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {dirLabel(direction)}
        </span>
        <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", borderRadius: 10, padding: "1px 7px" }}>{tasks.length}</span>
        {!isArchive && overdue > 0 && <span style={{ fontSize: 11, color: "#e53e3e", fontWeight: 600 }}>{overdue} просрочено</span>}
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
                style={{ background: "none", border: "1px dashed #e0e0e0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#bbb", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#bbb"; (e.currentTarget as HTMLButtonElement).style.color = "#888"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e0e0e0"; (e.currentTarget as HTMLButtonElement).style.color = "#bbb"; }}>
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

  if (loading) return <div style={{ padding: "24px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>Загрузка архива…</div>;
  if (doneTasks.length === 0) return <div style={{ padding: "32px 0", textAlign: "center", color: "#bbb", fontSize: 13 }}>Выполненных задач пока нет</div>;

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
      <div style={{ fontSize: 12, color: "#bbb", marginBottom: 16 }}>
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
        <span style={{ fontSize: 11, color: "#bbb", display: "inline-block", transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.15s" }}>▼</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#555", letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {dirLabel(direction)}
        </span>
        <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", borderRadius: 10, padding: "1px 7px" }}>{tasks.length}</span>
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
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 501, width: 360, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", padding: 16 }}
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
      <div style={{ fontWeight: 600, color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: COL_W - 20 }}>
        {task.title}
      </div>
      {task.scheduled_time && <div style={{ fontSize: 10, color: "#888" }}>{task.scheduled_time}</div>}
      {hov && (
        <div style={{ position: "absolute", right: 4, top: 2, display: "flex", gap: 3 }}>
          <button onClick={e => { e.stopPropagation(); setEditing(true); }}
            style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 4, padding: "1px 4px", fontSize: 10, cursor: "pointer", color: "#555" }}>✏</button>
          <button onClick={e => { e.stopPropagation(); onDone(); }}
            style={{ background: "#fff", border: "1px solid #e0e0e0", borderRadius: 4, padding: "1px 4px", fontSize: 10, cursor: "pointer", color: "#68d391" }}>✓</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ background: "#fff", border: "1px solid #fdd", borderRadius: 4, padding: "1px 4px", fontSize: 10, cursor: "pointer", color: "#e53e3e" }}>✕</button>
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
          style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "5px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#555" }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#333", minWidth: 220, textAlign: "center" }}>{weekLabel}</span>
        <button onClick={() => setWeekOffset(w => w + 1)}
          style={{ background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "5px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#555" }}>›</button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)}
            style={{ fontSize: 12, color: "#999", background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            Сегодня
          </button>
        )}
      </div>

      {/* Просроченные */}
      {overdue.length > 0 && (
        <div style={{ background: "#fff5f5", border: "1px solid #fdd", borderRadius: 10, padding: "8px 14px", marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#c53030", marginRight: 4 }}>⚠ Просроченные</span>
          {overdue.map(t => (
            <span key={t.id} style={{ fontSize: 11, background: "#fed7d7", color: "#c53030", borderRadius: 6, padding: "2px 8px", cursor: "pointer" }}
              onClick={() => onUpdate(t.id, { deadline: today })}>
              {t.title}
            </span>
          ))}
        </div>
      )}

      {/* Calendar grid — horizontally scrollable */}
      <div style={{ overflowX: "auto", border: "1px solid #ebebeb", borderRadius: 12, background: "#fff" }}>
        <div style={{ minWidth: totalW }}>

          {/* Day headers */}
          <div style={{ display: "flex", borderBottom: "1px solid #ebebeb" }}>
            <div style={{ width: TIME_W, flexShrink: 0 }} />
            {weekDays.map(day => {
              const ymd = toYMD(day);
              const isToday = ymd === today;
              return (
                <div key={ymd} style={{ width: COL_W, flexShrink: 0, padding: "10px 8px", borderLeft: "1px solid #f0f0f0", textAlign: "center", background: isToday ? "#111" : "#fff" }}>
                  <div style={{ fontSize: 11, color: isToday ? "rgba(255,255,255,0.6)" : "#bbb", fontWeight: 500 }}>{DAY_SHORT[day.getDay()]}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: isToday ? "#fff" : "#111", marginTop: 1 }}>{day.getDate()}</div>
                  <div style={{ fontSize: 10, color: isToday ? "rgba(255,255,255,0.5)" : "#ccc" }}>{day.toLocaleDateString("ru-RU", { month: "short" })}</div>
                </div>
              );
            })}
          </div>

          {/* All-day row — tasks without scheduled_time */}
          <div style={{ display: "flex", borderBottom: "1px solid #ebebeb", minHeight: 36 }}>
            <div style={{ width: TIME_W, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 6 }}>
              <span style={{ fontSize: 9, color: "#ccc", textTransform: "uppercase", letterSpacing: "0.5px" }}>весь<br/>день</span>
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
                  style={{ width: COL_W, flexShrink: 0, borderLeft: "1px solid #f0f0f0", padding: "4px 4px", background: isDropTarget ? "#f0f7ff" : "transparent", minHeight: 36 }}>
                  {allDay.map(t => (
                    <CalendarChip key={t.id} task={t}
                      onDone={() => onDone(t.id)}
                      onUpdate={d => onUpdate(t.id, d)}
                      onDelete={() => onDelete(t.id, ymd)}
                      dragging={draggingId === t.id}
                      onDragStart={() => setDraggingId(t.id)} />
                  ))}
                  {appleEvents.filter(e => e.date === ymd && e.allday).map((e, i) => (
                    <div key={`ac-ad-${i}`} style={{ background: e.calendar === "personal" ? "#fef3c7" : "#e0e7ff", borderLeft: `3px solid ${e.calendar === "personal" ? "#f59e0b" : "#6366f1"}`, borderRadius: "0 5px 5px 0", padding: "2px 6px", fontSize: 11, marginBottom: 2 }} title={e.cal_name}>
                      <span style={{ marginRight: 3 }}>🍎</span>{e.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          {HOURS.map(hour => (
            <div key={hour} style={{ display: "flex", height: SLOT_H, borderBottom: "1px solid #f5f5f5" }}>
              {/* Time label */}
              <div style={{ width: TIME_W, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 6, paddingTop: 3 }}>
                <span style={{ fontSize: 10, color: "#ccc" }}>{hour}:00</span>
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
                      width: COL_W, flexShrink: 0, borderLeft: "1px solid #f0f0f0",
                      padding: "2px 4px", position: "relative", cursor: "pointer",
                      background: isDropTarget ? "#e8f4fd" : isToday ? "#fafeff" : "transparent",
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
                        style={{ background: e.calendar === "personal" ? "#fef9c3" : "#ede9fe", borderLeft: `3px solid ${e.calendar === "personal" ? "#f59e0b" : "#6366f1"}`, borderRadius: "0 5px 5px 0", padding: "2px 6px", fontSize: 11, marginBottom: 2, userSelect: "none" }}>
                        <div style={{ fontWeight: 600, color: "#222", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: COL_W - 20 }}>
                          <span style={{ marginRight: 3 }}>🍎</span>{e.title}
                        </div>
                        <div style={{ fontSize: 10, color: "#888" }}>{e.start_time}–{e.end_time}</div>
                      </div>
                    ))}
                    {addingInSlot?.date === ymd && addingInSlot?.hour === hour && (
                      <div style={{ position: "absolute", top: 0, left: 0, zIndex: 50, width: COL_W * 2, background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: 8 }}
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
            style={{ marginTop: 12, border: `1px solid ${isDropZone ? "#3182ce" : "#ebebeb"}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s", background: isDropZone ? "#f0f7ff" : "transparent" }}>
            <div style={{ padding: "10px 16px", background: isDropZone ? "#e8f4fd" : "#fafafa", borderBottom: "1px solid #ebebeb", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isDropZone ? "#2563eb" : "#555" }}>Входящие</span>
              <span style={{ fontSize: 11, color: "#bbb", background: "#f0f0f0", borderRadius: 10, padding: "1px 7px" }}>{unscheduled.length}</span>
              <span style={{ fontSize: 11, color: isDropZone ? "#3182ce" : "#bbb" }}>
                {isDropZone ? "↓ отпустите, чтобы убрать дату" : "— перетащите задачу в нужный день и время"}
              </span>
            </div>
            <div style={{ padding: "10px 12px" }}>
              {unscheduled.length === 0 && !isDropZone && (
                <div style={{ fontSize: 12, color: "#ccc", padding: "4px 2px" }}>Нет неразобранных задач</div>
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
  const dotColor = critical ? "#e53e3e" : warn ? "#f6ad55" : "#68d391";
  const ageColor = critical ? "#e53e3e" : warn ? "#f6ad55" : "#bbb";
  return (
    <a href={d.url} target="_blank" rel="noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: last ? "none" : "1px solid #f0f0f0", textDecoration: "none", color: "inherit", transition: "background 0.1s" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.client}</div>
        {d.broker && <div style={{ fontSize: 12, color: "#999", marginTop: 1 }}>{d.broker}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#111", flexShrink: 0 }}>
        {d.commission > 0 ? `${d.commission.toLocaleString("ru-RU")} ₽` : "—"}
      </div>
      <div style={{ fontSize: 12, color: ageColor, fontWeight: 600, minWidth: 64, textAlign: "right", flexShrink: 0 }}>
        {d.age_days} дн.
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17L17 7M17 7H7M17 7v10" />
      </svg>
    </a>
  );
}

const STAGE_ORDER = ["Дожим", "Бронь", "Показ проведён", "Показ назначен", "Открыта сделка"];
const STAGE_COLOR: Record<string, string> = {
  "Дожим": "#e53e3e",
  "Бронь": "#9f7aea",
  "Показ проведён": "#3182ce",
  "Показ назначен": "#38a169",
  "Открыта сделка": "#f6ad55",
};

function DealStageGroup({ stage, deals }: { stage: string; deals: RiskDeal[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalCommission = deals.reduce((s, d) => s + (d.commission || 0), 0);
  const color = STAGE_COLOR[stage] || "#888";

  return (
    <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{ padding: "13px 20px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none", borderBottom: collapsed ? "none" : "1px solid #f5f5f5" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }} />
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{stage}</span>
        <span style={{ fontSize: 11, color: "#bbb", background: "#f5f5f5", borderRadius: 10, padding: "2px 8px" }}>{deals.length}</span>
        {totalCommission > 0 && (
          <span style={{ fontSize: 12, color: "#999" }}>{fmt(totalCommission)} ₽</span>
        )}
        <span style={{ fontSize: 11, color: "#bbb", transform: collapsed ? "rotate(-90deg)" : "rotate(0)", transition: "transform 0.15s", display: "inline-block" }}>▼</span>
      </div>
      {!collapsed && deals.map((d, i) => <DealRow key={d.url} d={d} last={i === deals.length - 1} />)}
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

function SalesDashboard() {
  const [data, setData] = React.useState<SalesData | null>(null);
  const [rnpData, setRnpData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"funnel" | "brokers" | "rnp">("funnel");
  const [rnpMonth, setRnpMonth] = React.useState("Июнь");

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

  if (loading) return <div style={{ padding: 60, textAlign: "center", color: "#bbb", fontSize: 13 }}>Загрузка данных продаж…</div>;
  if (error || !data) return <div style={{ padding: 40, textAlign: "center", color: "#e53e3e", fontSize: 13 }}>{error}</div>;

  const maxFunnelVal = data.funnel[0]?.value || 1;

  return (
    <div>
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>РНП · Отдел продаж</div>
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>Период: {data.period} · Google Sheets</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["funnel", "brokers", "rnp"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              background: view === v ? "#111" : "none", color: view === v ? "#fff" : "#999",
              border: view === v ? "none" : "1px solid #e0e0e0",
            }}>{v === "funnel" ? "Воронка" : v === "brokers" ? "Рейтинг брокеров" : "РНП"}</button>
          ))}
        </div>
      </div>

      {/* Метрики верхнего уровня */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Вал компании", value: fmt(data.company_val) + " ₽", sub: data.period },
          { label: "Эффективность", value: fmt(data.company_eff) + " ₽", sub: "вал закрытых сделок" },
          { label: "Сделок", value: Math.round(data.funnel.find(f => f.stage === "Сделки")?.value || 0).toString(), sub: "закрыто за период" },
          { label: "Узкое место", value: data.bottleneck, sub: "мин. конверсия", accent: true },
        ].map((m, i) => (
          <div key={i} style={{ background: m.accent ? "#fffbeb" : "#fff", border: `1px solid ${m.accent ? "#fde68a" : "#ebebeb"}`, borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: m.accent ? 16 : 22, fontWeight: 700, color: m.accent ? "#b45309" : "#111", letterSpacing: "-0.5px" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Воронка */}
      {view === "funnel" && (
        <div style={{ background: "#f0ebe4", border: "1px solid #ddd5c8", borderRadius: 12, padding: "24px 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: "#3b1f10" }}>Воронка продаж</div>
          <div style={{ fontSize: 12, color: "#9c8474", marginBottom: 24 }}>Подсвечено узкое место — этап с худшей конверсией</div>
          {data.funnel.map((stage, i) => {
            const barW = Math.max((stage.value / maxFunnelVal) * 100, 2);
            const isBottleneck = stage.stage === data.bottleneck;
            return (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <div style={{ width: 140, fontSize: 13, color: "#6b5040", flexShrink: 0, textAlign: "right" }}>{stage.stage}</div>
                  <div style={{ flex: 1, position: "relative", height: 32, background: "#ddd5c8", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${barW}%`,
                      background: isBottleneck ? "#c9883a" : "#5c2d1a",
                      borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 10,
                    }}>
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{Math.round(stage.value)}</span>
                    </div>
                    {isBottleneck && (
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, background: "#c9883a", color: "#fff3e6", borderRadius: 4, padding: "2px 7px" }}>УЗКОЕ МЕСТО</span>
                    )}
                  </div>
                  {stage.conv !== null && (
                    <div style={{ width: 60, fontSize: 12, color: isBottleneck ? "#a0522d" : "#b09a89", fontWeight: isBottleneck ? 600 : 400, flexShrink: 0 }}>↓ {stage.conv}%</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Рейтинг брокеров */}
      {view === "brokers" && (
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
              <tr>
                {["#", "Брокер", "Лиды", "Квалы", "Показы", "Встречи", "Задатки", "Сделки", "Вал", "Ср. чек"].map(h => (
                  <th key={h} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: h === "#" || h === "Брокер" ? "left" : "right", borderBottom: "1px solid #ebebeb", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.brokers.map((b, i) => {
                const isTop3 = b.rank <= 3;
                const rankColor = b.rank === 1 ? "#f59e0b" : b.rank === 2 ? "#9ca3af" : b.rank === 3 ? "#c2714f" : "#bbb";
                return (
                  <tr key={i}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid #f5f5f5" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", background: isTop3 ? rankColor : "transparent", color: isTop3 ? "#fff" : "#bbb", fontSize: 12, fontWeight: 700 }}>{b.rank}</span>
                    </td>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid #f5f5f5", fontWeight: 500, fontSize: 13 }}>{b.name}</td>
                    {[b.leads, b.quals, b.shows, b.meetings, Math.round(b.deposits)].map((v, j) => (
                      <td key={j} style={{ padding: "12px 12px", borderBottom: "1px solid #f5f5f5", textAlign: "right", fontSize: 13, color: "#555" }}>{v}</td>
                    ))}
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid #f5f5f5", textAlign: "right", fontSize: 13, color: "#555" }}>{Math.round(b.deals)}</td>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid #f5f5f5", textAlign: "right", fontSize: 13, fontWeight: b.rank <= 3 ? 600 : 400, color: b.rank === 1 ? "#f59e0b" : "#111" }}>{fmt(b.commission)} ₽</td>
                    <td style={{ padding: "12px 12px", borderBottom: "1px solid #f5f5f5", textAlign: "right", fontSize: 12, color: "#999" }}>{fmt(b.avg_check)} ₽</td>
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
            {["Январь","Февраль","Март","Апрель","Май","Июнь"].map(m => (
              <button key={m} onClick={() => setRnpMonth(m)} style={{
                padding: "5px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                background: rnpMonth === m ? "#5b4ff5" : "#fff",
                color: rnpMonth === m ? "#fff" : "#555",
                border: `1px solid ${rnpMonth === m ? "#5b4ff5" : "#e0e0e0"}`,
                fontWeight: rnpMonth === m ? 600 : 400,
              }}>{m}</button>
            ))}
          </div>

          {!rnpData ? (
            <div style={{ color: "#bbb", textAlign: "center", padding: 40 }}>Загрузка РНП…</div>
          ) : (
            <>
              {/* Воронка план/факт */}
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "24px 28px", marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Воронка — план vs факт · {rnpData.month}</div>
                {rnpData.funnel.map((f: any, i: number) => {
                  const isVal = f.metric.includes("₽");
                  const planVal = f.plan;
                  const factVal = f.fact;
                  const pct = f.pct;
                  const barFact = planVal > 0 ? Math.min((factVal / planVal) * 100, 100) : 0;
                  const color = pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#e53e3e";
                  return (
                    <div key={i} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                        <span style={{ fontWeight: 500, color: "#333" }}>{f.metric}</span>
                        <span style={{ color: "#999" }}>
                          факт: <b style={{ color: "#111" }}>{isVal ? `${fmt(factVal)} ₽` : Math.round(factVal)}</b>
                          {" / "}план: {isVal ? `${fmt(planVal)} ₽` : Math.round(planVal)}
                          <span style={{ marginLeft: 10, fontWeight: 700, color }}>{pct}%</span>
                        </span>
                      </div>
                      <div style={{ height: 10, background: "#f0f0f0", borderRadius: 5, overflow: "hidden", position: "relative" }}>
                        <div style={{ height: "100%", width: `${barFact}%`, background: color, borderRadius: 5, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Рейтинг РНП брокеров */}
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", fontSize: 14, fontWeight: 600, borderBottom: "1px solid #ebebeb" }}>Брокеры · {rnpData.month}</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#fafafa" }}>
                      {["Брокер", "Сделки факт", "Вал факт", "КВАЛы 12+", "Показы", "Встречи", "Задатки"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid #ebebeb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rnpData.brokers.map((b: any, i: number) => {
                      const m = (name: string) => b.metrics?.find((x: any) => x.metric === name);
                      return (
                        <tr key={i} onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <td style={{ padding: "10px 14px", fontWeight: 500, borderBottom: "1px solid #f5f5f5" }}>{b.name}</td>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid #f5f5f5", color: b.deals_fact > 0 ? "#22c55e" : "#bbb", fontWeight: 600 }}>{b.deals_fact || "—"}</td>
                          <td style={{ padding: "10px 14px", borderBottom: "1px solid #f5f5f5", fontWeight: b.val_fact > 0 ? 600 : 400, color: b.val_fact > 0 ? "#111" : "#bbb" }}>{b.val_fact > 0 ? `${fmt(b.val_fact)} ₽` : "—"}</td>
                          {["КВАЛы 12+","Показы","Встречи","Задатки"].map(name => {
                            const met = m(name);
                            return <td key={name} style={{ padding: "10px 14px", borderBottom: "1px solid #f5f5f5", color: "#666" }}>{met ? `${met.fact} / ${Math.round(met.plan)}` : "—"}</td>;
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
  const thStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid #ebebeb", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13, borderBottom: "1px solid #f5f5f5", verticalAlign: "middle" };

  const riskMoney = deals.reduce((s, d) => s + (d.commission || 0), 0);

  return (
    <div>
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>Отдел продаж</div>
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>Первичный источник: Битрикс24 · только чтение</div>
        </div>
        <button onClick={onRefresh} style={{ fontSize: 12, color: "#999", background: "none", border: "1px solid #e0e0e0", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>↻ Обновить</button>
      </div>

      {/* Метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Зависших сделок</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: deals.length > 0 ? "#e53e3e" : "#111" }}>{loading ? "—" : deals.length}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Под риском</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: riskMoney > 0 ? "#e53e3e" : "#111" }}>{loading ? "—" : riskMoney > 0 ? `${fmt(riskMoney)} ₽` : "—"}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Уволенных брокеров</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{loading ? "—" : deals.filter(d => d.is_fired).length}</div>
        </div>
      </div>

      {/* Таблица */}
      {loading ? (
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: 40, textAlign: "center", color: "#bbb", fontSize: 13 }}>Загрузка из Битрикс24…</div>
      ) : error ? (
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: 32, textAlign: "center" }}>
          <div style={{ color: "#e53e3e", fontSize: 13, marginBottom: 10 }}>{error}</div>
          <button onClick={onRefresh} style={{ fontSize: 12, color: "#999", background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>Попробовать снова</button>
        </div>
      ) : deals.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: 40, textAlign: "center", color: "#bbb", fontSize: 13 }}>Зависших сделок нет</div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#fafafa" }}>
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
                const dotColor = critical ? "#e53e3e" : warn ? "#f6ad55" : "#68d391";
                const stageColor = STAGE_COLOR[d.stage] || "#888";
                return (
                  <tr key={i} style={{ transition: "background 0.1s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500 }}>{d.client}</div>
                      {d.is_fired && <div style={{ fontSize: 11, color: "#e53e3e", marginTop: 2 }}>уволен</div>}
                    </td>
                    <td style={{ ...tdStyle, color: "#666" }}>{d.broker || "—"}</td>
                    <td style={tdStyle}>
                      <span style={{ background: stageColor + "18", color: stageColor, borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 500 }}>{d.stage}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 500 }}>{d.commission > 0 ? `${d.commission.toLocaleString("ru-RU")} ₽` : "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <span style={{ color: critical ? "#e53e3e" : warn ? "#f6ad55" : "#bbb", fontWeight: (critical || warn) ? 600 : 400 }}>{d.age_days} дн.</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: dotColor }} />
                    </td>
                    <td style={tdStyle}>
                      <a href={d.url} target="_blank" rel="noreferrer" style={{ color: "#bbb", textDecoration: "none", fontSize: 13 }}>↗</a>
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

  const load = () => {
    setLoading(true); setError(null);
    fetch(`${API}/api/support/deals`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Нет соединения с сервером"); setLoading(false); });
  };
  React.useEffect(() => { load(); }, []);

  const RISK_COLOR: Record<string, string> = { green: "#22c55e", yellow: "#f59e0b", red: "#e53e3e", gray: "#d1d5db" };
  const RISK_BG:    Record<string, string> = { green: "#f0fdf4", yellow: "#fffbeb", red: "#fef2f2", gray: "#f9fafb" };
  const RISK_LABEL: Record<string, string> = { green: "Высокая", yellow: "Средняя", red: "Низкая", gray: "—" };
  const DOC_COLOR: Record<string, string>  = { "Готово": "#22c55e", "В работе": "#f59e0b", "в работе": "#f59e0b", "Есть риск": "#e53e3e" };

  const thStyle: React.CSSProperties = { padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid #ebebeb", whiteSpace: "nowrap", background: "#fafafa" };
  const tdStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 12, borderBottom: "1px solid #f5f5f5", verticalAlign: "middle" };

  if (loading) return <div style={{ color: "#bbb", padding: 60, textAlign: "center" }}>Загрузка данных из Google Sheets…</div>;
  if (error)   return <div style={{ color: "#e53e3e", padding: 60, textAlign: "center" }}>{error}<br /><button onClick={load} style={{ marginTop: 12, padding: "6px 16px", borderRadius: 8, border: "1px solid #ebebeb", background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>Попробовать снова</button></div>;

  const s = data.summary;
  const deals = filter === "all" ? data.deals : data.deals.filter((d: any) => d.executor.trim().toLowerCase() === filter.toLowerCase());

  return (
    <div>
      {/* Заголовок */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#111" }}>Отдел сопровождения</div>
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>Google Sheets · «Прогноз июнь» · {s.total_deals} сделок</div>
        </div>
        <button onClick={load} style={{ background: "none", border: "1px solid #ebebeb", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", color: "#888", fontFamily: "inherit" }}>↻ Обновить</button>
      </div>

      {/* Метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Итог сделок",    value: `${fmt(s.total_amount)} ₽`,    color: "#111" },
          { label: "Зашло",          value: `${fmt(s.received_amount)} ₽`, color: "#22c55e" },
          { label: "План комиссии",  value: `${fmt(s.plan_commission)} ₽`, color: "#5b4ff5" },
          { label: "Подтверждено",   value: `${fmt(s.confirmed)} ₽`,       color: "#22c55e" },
          { label: "Красные сделки", value: `${fmt(s.red_amount)} ₽`,      color: "#e53e3e" },
          { label: "Всего сделок",   value: `${s.total_deals}`,            color: "#111", sub: `🟢 ${s.green_deals}  🟡 ${s.yellow_deals}  🔴 ${s.red_deals}` },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: c.color, letterSpacing: "-0.5px" }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10, color: "#bbb", marginTop: 3 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {/* Фильтр по сопровожденцу */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "Меркулова", "Добрицкая"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: "5px 14px", borderRadius: 20, border: "1px solid", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              borderColor: filter === f ? "#5b4ff5" : "#e0e0e0",
              background: filter === f ? "#5b4ff5" : "#fff",
              color: filter === f ? "#fff" : "#555", fontWeight: filter === f ? 600 : 400 }}>
            {f === "all" ? "Все" : f}
          </button>
        ))}
      </div>

      {/* Таблица */}
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "auto" }}>
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
                style={{ background: d.risk_level === "red" ? "#fef9f9" : "transparent", transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8f8ff")}
                onMouseLeave={e => (e.currentTarget.style.background = d.risk_level === "red" ? "#fef9f9" : "transparent")}>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: RISK_COLOR[d.risk_level] || "#ddd" }} title={RISK_LABEL[d.risk_level]} />
                </td>
                <td style={{ ...tdStyle, fontWeight: 500, color: "#444", whiteSpace: "nowrap" }}>{d.executor}</td>
                <td style={{ ...tdStyle, fontWeight: 500, maxWidth: 220 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.client_obj}>{d.client_obj}</div>
                </td>
                <td style={{ ...tdStyle, color: "#666", maxWidth: 160 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.broker}>{d.broker || "—"}</div>
                </td>
                <td style={{ ...tdStyle, color: "#888", whiteSpace: "nowrap" }}>{d.rg || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: d.commission > 0 ? "#111" : "#ccc" }}>
                  {d.commission > 0 ? `${fmt(d.commission)} ₽` : "—"}
                </td>
                <td style={{ ...tdStyle, color: "#666", whiteSpace: "nowrap" }}>{d.pay_date || "—"}</td>
                <td style={tdStyle}>
                  {d.doc_status ? (
                    <span style={{ fontSize: 11, fontWeight: 500, color: DOC_COLOR[d.doc_status] || "#888", background: (DOC_COLOR[d.doc_status] || "#888") + "18", borderRadius: 5, padding: "2px 7px" }}>
                      {d.doc_status}
                    </span>
                  ) : <span style={{ color: "#ccc" }}>—</span>}
                </td>
                <td style={{ ...tdStyle, color: "#888", fontSize: 11, maxWidth: 140 }}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.ext_stage}>{d.ext_stage || "—"}</div>
                </td>
                <td style={{ ...tdStyle, color: "#888", fontSize: 11, whiteSpace: "nowrap" }}>{d.mortgage || "—"}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {d.crm_url ? (
                    <a href={d.crm_url} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: "#5b4ff5", textDecoration: "none", background: "#f0f0ff", borderRadius: 5, padding: "2px 7px" }}>
                      #{d.deal_id}
                    </a>
                  ) : <span style={{ color: "#ccc" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Легенда */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: "#aaa" }}>
        {[["#22c55e", "Высокая вероятность"], ["#f59e0b", "Средняя / требует контроля"], ["#e53e3e", "Высокий риск"]].map(([c, l]) => (
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

  const C = { founder:"#a78bfa", ceo:"#c4b5fd", mkt:"#6366f1", sales:"#22c55e",
               ops:"#f59e0b", hr:"#fb923c", fin:"#60a5fa", legal:"#e53e3e", dim:"#555" };

  const tree: N = mkNode("учредители","Учредители","Ольга & Алексей Изосин", C.founder, [
    mkNode("ceo","CEO / Учредитель","Ольга Изосина", C.ceo, [
      mkNode("mkt-dir","Директор по маркетингу","Юлия Побожьева", C.mkt, [
        mkNode("kontm","Контент-маркетолог","Диана (до сентября)", C.mkt),
        mkNode("pr","PR-менеджер","Вакансия", "#7f1d1d"),
        mkNode("intm","Интернет-маркетолог","Вакансия (была Юля)", "#7f1d1d"),
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
        mkNode("rop2","РОП №2","Вакансия", "#7f1d1d", [
          mkNode("rg2","Рук. группы","Вакансия", "#7f1d1d", [
            mkNode("br2","Брокеры","Вакансия", "#7f1d1d"),
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
      mkNode("ba","Бизнес-ассистент","Вакансия", "#7f1d1d"),
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
          <h2 style={{ margin:0, fontSize:20, fontWeight:700, color:"#111" }}>Оргструктура</h2>
          <p style={{ margin:"3px 0 0", color:"#888", fontSize:13 }}>Oazis Estate · версия 4.0</p>
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <button onClick={()=>setZoom(z=>Math.min(2,z+0.1))}
            style={{ padding:"5px 14px", background:"#fff", border:"1px solid #e0e0e0", borderRadius:6, color:"#333", cursor:"pointer", fontSize:16, fontWeight:600, boxShadow:"0 1px 3px rgba(0,0,0,.08)" }}>+</button>
          <span style={{ fontSize:12, color:"#888", minWidth:40, textAlign:"center" }}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.max(0.1,z-0.1))}
            style={{ padding:"5px 14px", background:"#fff", border:"1px solid #e0e0e0", borderRadius:6, color:"#333", cursor:"pointer", fontSize:16, fontWeight:600, boxShadow:"0 1px 3px rgba(0,0,0,.08)" }}>−</button>
          <button onClick={doReset}
            style={{ padding:"5px 14px", background:"#fff", border:"1px solid #e0e0e0", borderRadius:6, color:"#555", cursor:"pointer", fontSize:12, boxShadow:"0 1px 3px rgba(0,0,0,.08)" }}>Подогнать</button>
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
                <div style={{ fontSize:9, color:"#94a3b8", lineHeight:1.2, marginBottom:2 }}>
                  {node.role}
                </div>
                <div style={{ fontSize:11, fontWeight:700, lineHeight:1.3,
                  color: vac ? "#ef4444" : isFounder || isCeo ? "#7c3aed" : "#1e293b" }}>
                  {vac ? "● Вакансия" : node.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p style={{ fontSize:11, color:"#bbb", marginTop:6, textAlign:"center" }}>
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
  if (loading) return <div style={{ color: "#bbb", padding: 40, textAlign: "center" }}>Загрузка…</div>;
  if (!data) return <div style={{ color: "#e53e3e", padding: 40, textAlign: "center" }}>Ошибка загрузки</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Расходы брокеров</h2>
        <span style={{ fontSize: 12, color: "#999" }}>{data.period}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Выплачено брокерам", value: `${fmt(data.total_paid)} ₽`, sub: "фактически" },
          { label: "Расходы (качество+тех)", value: `${fmt(data.total_cost)} ₽`, sub: "доп. затраты" },
          { label: "Комиссионный доход", value: `${fmt(data.total_commission)} ₽`, sub: "агентские" },
          { label: "ROI", value: `${data.roi > 0 ? "+" : ""}${data.roi}%`, sub: "рентабельность", accent: data.roi > 0 },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: (c as any).accent ? "#22c55e" : "#111", letterSpacing: "-0.5px" }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#bbb", marginTop: 3 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #ebebeb" }}>
              {["#", "Брокер", "Сделки", "Комиссия", "Выплачено", "Расходы", "% от KV", "Прогноз"].map(h => (
                <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.brokers.map((b: any, i: number) => (
              <tr key={b.name} style={{ borderBottom: i < data.brokers.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                <td style={{ padding: "8px 12px", color: "#999" }}>{b.rank}</td>
                <td style={{ padding: "8px 12px", fontWeight: 500 }}>{b.name}</td>
                <td style={{ padding: "8px 12px" }}>{b.deals}</td>
                <td style={{ padding: "8px 12px" }}>{b.commission > 0 ? `${fmt(b.commission)} ₽` : "—"}</td>
                <td style={{ padding: "8px 12px" }}>{b.paid_out > 0 ? `${fmt(b.paid_out)} ₽` : "—"}</td>
                <td style={{ padding: "8px 12px", color: "#e53e3e" }}>{b.cost_total > 0 ? `${fmt(b.cost_total)} ₽` : "—"}</td>
                <td style={{ padding: "8px 12px" }}>{b.broker_pct > 0 ? `${b.broker_pct}%` : "—"}</td>
                <td style={{ padding: "8px 12px", color: "#5b4ff5" }}>{b.forecast_eff > 0 ? `${fmt(b.forecast_eff)} ₽` : "—"}</td>
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
          background: open ? "#f0f0f0" : "#fff", cursor: "pointer",
          fontSize: 13, color: "#888", fontWeight: 700, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >?</button>

      {open && (
        <div style={{
          position: "absolute", top: 34, right: 0, width: 380, zIndex: 50,
          background: "#fff", border: "1px solid #e8e8e8", borderRadius: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.10)", padding: "20px 22px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>Как считается эффективность</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#bbb", padding: 0 }}>✕</button>
          </div>

          <div style={{ fontSize: 12, color: "#555", lineHeight: 1.7 }}>
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
                { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", label: "≥ 85% — норма" },
                { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", label: "60–84% — под контролем" },
                { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", label: "< 60% — требует внимания" },
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
  if (score >= 85) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}
function scoreBg(score: number): string {
  if (score >= 85) return "#f0fdf4";
  if (score >= 60) return "#fffbeb";
  return "#fef2f2";
}
function scoreBorder(score: number): string {
  if (score >= 85) return "#bbf7d0";
  if (score >= 60) return "#fde68a";
  return "#fecaca";
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
    <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 14, overflow: "hidden", transition: "box-shadow 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 18px rgba(0,0,0,0.07)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
      {/* Шапка карточки */}
      <div style={{ padding: "18px 20px 14px", borderBottom: open ? "1px solid #f0f0f0" : "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>{dept.icon}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{dept.name}</span>
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
          <div style={{ fontSize: 12, color: "#ef4444" }}>Ошибка: {dept.error}</div>
        ) : dept.kpis.length === 0 ? (
          <div style={{ fontSize: 12, color: "#bbb" }}>Нет данных</div>
        ) : (
          <div>
            {(open ? dept.kpis : dept.kpis.slice(0, 3)).map((kpi: any, i: number) => {
              const barW = Math.min(kpi.pct, 100);
              const c = scoreColor(kpi.pct);
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 4 }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{kpi.metric}</span>
                    <span style={{ flexShrink: 0, display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ color: "#999" }}>{fmtKpiVal(kpi.fact, kpi.is_money)}</span>
                      <span style={{ color: "#bbb" }}>/</span>
                      <span style={{ color: "#bbb" }}>{fmtKpiVal(kpi.plan, kpi.is_money)}</span>
                      <span style={{ fontWeight: 700, color: c, minWidth: 36, textAlign: "right" }}>{kpi.pct > 0 ? kpi.pct.toFixed(0) + "%" : "—"}</span>
                    </span>
                  </div>
                  <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${barW}%`, background: c, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                </div>
              );
            })}
            {dept.kpis.length > 3 && (
              <button onClick={() => setOpen(!open)} style={{
                marginTop: 4, fontSize: 11, color: "#6366f1", background: "none", border: "none",
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
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>Эффективность по отделам</h2>
            <MethodologyCard />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>На основании РНП · данные актуальны на сегодня</p>
        </div>
        {/* Выбор месяца */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {MONTHS_RU_EFF.slice(0, 6).map(m => (
            <button key={m} onClick={() => setMonth(m)} style={{
              padding: "4px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
              background: month === m ? "#111" : "#fff",
              color: month === m ? "#fff" : "#666",
              border: `1px solid ${month === m ? "#111" : "#e0e0e0"}`,
              fontWeight: month === m ? 600 : 400,
            }}>{m}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 60, textAlign: "center", color: "#bbb", fontSize: 13 }}>Загружаю данные из РНП…</div>
      )}
      {error && (
        <div style={{ padding: 40, textAlign: "center", color: "#ef4444", fontSize: 13 }}>{error}</div>
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
                  <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Среднее по компании</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: "-1px" }}>{avg}%</div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{data.month}</div>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Лидер</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>{best?.icon} {best?.name}</div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{best?.score?.toFixed(0)}% выполнения</div>
                </div>
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px" }}>
                  <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Требует внимания</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>{worst?.icon} {worst?.name}</div>
                  <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{worst?.score?.toFixed(0)}% выполнения</div>
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
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#111" }}>Эффективность компании</h2>
            <MethodologyCard />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999" }}>Актуальные данные из всех РНП-таблиц</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f5f5f5", borderRadius: 10, padding: 4 }}>
          {(["month", "year"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 18px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              background: view === v ? "#fff" : "transparent",
              color: view === v ? "#111" : "#888",
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
            {MONTHS_RU_EFF.slice(0, 6).map(m => (
              <button key={m} onClick={() => setMonth(m)} style={{
                padding: "4px 12px", borderRadius: 16, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                background: month === m ? "#111" : "#fff",
                color: month === m ? "#fff" : "#666",
                border: `1px solid ${month === m ? "#111" : "#e0e0e0"}`,
                fontWeight: month === m ? 600 : 400,
              }}>{m}</button>
            ))}
          </div>
          {loadingMonth && (
            <div style={{ padding: 60, textAlign: "center", color: "#bbb", fontSize: 13 }}>Загружаю данные…</div>
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
                      <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Среднее по компании</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(avg), letterSpacing: "-1px" }}>{avg}%</div>
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{monthData.month}</div>
                    </div>
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Лидер</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>{best?.icon} {best?.name}</div>
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{best?.score?.toFixed(0)}% выполнения</div>
                    </div>
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px" }}>
                      <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>Требует внимания</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>{worst?.icon} {worst?.name}</div>
                      <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{worst?.score?.toFixed(0)}% выполнения</div>
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
            <div style={{ padding: 60, textAlign: "center", color: "#bbb", fontSize: 13 }}>Загружаю данные за год… это может занять 15–20 секунд</div>
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>{d.icon} {d.name}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(d.avg_score), letterSpacing: "-1px" }}>
                      {d.avg_score > 0 ? d.avg_score.toFixed(0) : "—"}%
                    </div>
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>ср. за {yearData.year}</div>
                  </div>
                ))}
              </div>

              {/* Тепловая карта: строки = месяцы, колонки = отделы */}
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#333" }}>Динамика по месяцам</span>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#bbb" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#22c55e", display: "inline-block" }} />≥85%</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#f59e0b", display: "inline-block" }} />60–84%</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: "#ef4444", display: "inline-block" }} />&lt;60%</span>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid #f0f0f0", minWidth: 100 }}>Месяц</th>
                        {yearData.months[0]?.departments.map((d: any) => (
                          <th key={d.key} style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "center", borderBottom: "1px solid #f0f0f0", whiteSpace: "nowrap" }}>
                            {d.icon} {d.name}
                          </th>
                        ))}
                        <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "center", borderBottom: "1px solid #f0f0f0" }}>Среднее</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearData.months.map((row: any, i: number) => (
                        <tr key={row.month} style={{ borderBottom: "1px solid #f5f5f5", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                          <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "#333" }}>{row.month}</td>
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

  const BG     = "#fdf8f5";
  const CARD   = "#ffffff";
  const BORDER = "#ecddd6";
  const TEXT   = "#3d2a26";
  const MUTED  = "#9a7d76";
  const ACCENT = "#7aa4d4";
  const UP     = "#2d9e6b";
  const DOWN   = "#d94040";

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
                <tr style={{background:"#fef5ef",color:MUTED,textAlign:"left"}}>
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
                    <tr key={i} style={{borderBottom:`1px solid ${BORDER}`,background: i%2===0? CARD :"#faf5f2"}}>
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
                  <div style={{marginBottom:20,padding:"12px 16px",background:"#fef5ef",borderRadius:10,border:`1px solid ${BORDER}`,fontSize:13,color:"#5a3e3a",lineHeight:1.65}}>
                    {(intro as string).replace(/^Digital-marketing\s*/i,"").replace(/^Что структура трафика говорит о каждом бизнесе, гипотезы \(Цифры верифицированы\)\s*/,"")}
                  </div>
                )}
                {(blocks as string[]).map((block:string, i:number) => {
                  const statsRe = new RegExp(`^(.+?)\\s+((?:(?:${CHANNELS}): [\\d,.]+%(?:\\s*·\\s*)?)+)`);
                  const m = block.match(statsRe);
                  if (!m) return <div key={i} style={{marginBottom:12,fontSize:13,color:"#5a3e3a",lineHeight:1.65}}>{block}</div>;
                  const companyName = m[1].trim();
                  const statsStr = m[2].trim();
                  const analysis = block.slice(m[0].length).trim();
                  const statItems = statsStr.split(/\s*·\s*/).map((s:string) => {
                    const [label, val] = s.split(/:\s*/);
                    return { label: label?.trim(), val: val?.trim() };
                  }).filter((s:{label?:string,val?:string}) => s.label && s.val);
                  return (
                    <div key={i} style={{marginBottom:10,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden",background:CARD}}>
                      <div style={{background:"#fef5ef",padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:10}}>
                        <div style={{width:4,height:28,borderRadius:2,background:"#b07a5a",flexShrink:0}}/>
                        <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{companyName}</div>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,padding:"12px 16px",borderBottom:`1px solid ${BORDER}`}}>
                        {statItems.map((s:{label?:string,val?:string},j:number) => {
                          const v = parseFloat((s.val||"").replace(",","."));
                          const isHigh = ["Organic","Direct"].includes(s.label||"") && v > 30;
                          return (
                            <div key={j} style={{background:isHigh?"#f0f4fd":"#faf5f2",border:`1px solid ${isHigh?"#c5d8f0":BORDER}`,borderRadius:8,padding:"4px 10px",fontSize:12}}>
                              <span style={{color:MUTED,marginRight:4}}>{s.label}:</span>
                              <span style={{fontWeight:700,color:isHigh?ACCENT:TEXT}}>{s.val}</span>
                            </div>
                          );
                        })}
                      </div>
                      {analysis && <div style={{padding:"12px 16px",fontSize:13,color:"#5a3e3a",lineHeight:1.72}}>{analysis}</div>}
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
                  <div style={{marginBottom:16,padding:"12px 16px",background:"#fef5ef",borderRadius:10,border:`1px solid ${BORDER}`,fontSize:13,color:"#5a3e3a",lineHeight:1.65}}>
                    {(intro as string).replace(/^Технологии на сайтах\s*/,"")}
                  </div>
                )}
                {(allBlocks as string[]).map((block:string, i:number) => {
                  const kw = TECH_KEYWORDS.find((k:string) => block.startsWith(k)) || "";
                  const body = block.slice(kw.length).trim();
                  const icon = ICONS[kw] || "•";
                  return (
                    <div key={i} style={{marginBottom:8,border:`1px solid ${BORDER}`,borderRadius:12,overflow:"hidden",background:CARD}}>
                      <div style={{background:"#fef5ef",padding:"12px 16px",borderBottom:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
                        <div style={{fontSize:14,fontWeight:700,color:TEXT}}>{kw}</div>
                      </div>
                      <div style={{padding:"14px 18px",fontSize:13,color:"#5a3e3a",lineHeight:1.75,whiteSpace:"pre-wrap"}}>
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
                <div style={{marginBottom:12,padding:"12px 16px",background:"#fef5ef",borderRadius:10,border:`1px solid ${BORDER}`,fontSize:13,color:"#5a3e3a",lineHeight:1.65}}>
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
                    background:openIdx===i?"#fef5ef":CARD,
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
                  <div style={{padding:"14px 18px",background:"#faf5f2",fontSize:13,lineHeight:1.75,
                    color:"#5a3e3a",maxHeight:600,overflowY:"auto",borderTop:`1px solid ${BORDER}`}}>
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
              <tr style={{background:"#fef5ef",textAlign:"left"}}>
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
                  <tr key={i} style={{borderBottom:`1px solid ${BORDER}`,background:i%2===0?CARD:"#faf5f2"}}>
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

  const BG   = "#fdf8f5";
  const CARD = "#ffffff";
  const BORDER = "#ecddd6";
  const TEXT  = "#3d2a26";
  const MUTED = "#9a7d76";
  const HIGH  = "#d94040";
  const MED   = "#d97706";
  const LOW   = "#2d9e6b";

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
          <div style={{ width: 4, height: 36, borderRadius: 2, background: "#b07a5a" }} />
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
            padding: "14px 18px", background: "#fef5ef", border: "none", cursor: "pointer",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18 }}>⚖️</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>АД № 2-4258 — Бражников Г.В.</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>февраль – март 2026 · ИП Греков (Принципал) → ИП Изосин (Агент)</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
                Остаток не получен
              </span>
              <span style={{ color: MUTED, fontSize: 14 }}>{openCase ? "▲" : "▼"}</span>
            </div>
          </button>

          {openCase && (
            <div style={{ padding: "16px 18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Суть */}
              <div style={{ fontSize: 13, color: "#5a3e3a", lineHeight: 1.7, background: "#faf5f2", borderRadius: 8, padding: "12px 14px" }}>
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
                  <div key={c.label} style={{ background: "#faf5f2", borderRadius: 8, padding: "12px 14px", border: `1px solid ${BORDER}` }}>
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
                    <div key={r.label} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#faf5f2", borderRadius: 8, padding: "10px 14px", border: `1px solid ${BORDER}` }}>
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
                    <div key={s.text} style={{ fontSize: 13, color: s.done ? "#5a3e3a" : MED, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: s.done ? LOW : MED, flexShrink: 0 }}>{s.done ? "✓" : "!"}</span>
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>

              {/* Вывод */}
              <div style={{ background: "#f0f4fd", borderRadius: 8, padding: "12px 14px", borderLeft: "3px solid #7aa4d4" }}>
                <div style={{ fontSize: 12, color: "#4a6fa5", fontWeight: 600, marginBottom: 6 }}>Вывод и рекомендации</div>
                <div style={{ fontSize: 13, color: "#3d4f6e", lineHeight: 1.65 }}>
                  Зафиксировать дату утверждения Отчёта-Акта у Принципала и запустить отсчёт 8 банковских дней для остатка. Простановить дату в ДС № 1 к АД. В будущих сделках по схеме ДКП будущей недвижимости — не допускать несовпадения адреса в АД и Отчёте-Акте, фиксировать дистанцию Oazis от основной сделки с покупателем.
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Легенда рисков */}
      <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
        {[["#d94040", "Критичный риск"], ["#d97706", "Средний риск"], ["#2d9e6b", "Выполнено"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
            <span style={{ fontSize: 12, color: MUTED }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HR раздел ─────────────────────────────────────────────────────────────────
const TONE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  good: { bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d", dot: "#22c55e" },
  warn: { bg: "#fffbeb", border: "#fde68a", color: "#b45309", dot: "#f59e0b" },
  bad:  { bg: "#fef2f2", border: "#fecaca", color: "#dc2626", dot: "#ef4444" },
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
          <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>HR · Подбор и команда</div>
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>Данные из Google Sheets · обновление каждые 3 мин</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setView(t.key)} style={{
              fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              background: view === t.key ? "#111" : "none", color: view === t.key ? "#fff" : "#999",
              border: view === t.key ? "none" : "1px solid #e0e0e0",
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
  return <div style={{ padding: 60, textAlign: "center", color: "#bbb", fontSize: 13 }}>{text}</div>;
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
          <div key={i} style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111", letterSpacing: "-0.5px" }}>{m.value}</div>
            <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{m.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Выводы по подбору</div>
      <div style={{ fontSize: 12, color: "#bbb", marginBottom: 16 }}>
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
                <div style={{ fontSize: 13, color: "#444", lineHeight: 1.55 }}>{f.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
            background: year === y ? "#6366f1" : "none", color: year === y ? "#fff" : "#999",
            border: year === y ? "none" : "1px solid #e0e0e0",
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
              <div key={i} style={{ background: m.warn ? "#fef2f2" : "#fff", border: `1px solid ${m.warn ? "#fecaca" : "#ebebeb"}`, borderRadius: 10, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: m.warn ? "#dc2626" : "#111", letterSpacing: "-0.5px" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={{ padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", textAlign: "left", borderBottom: "1px solid #ebebeb", position: "sticky", left: 0, background: "#fafafa", minWidth: 200 }}>Показатель</th>
                  {data.months.map((m: string) => (
                    <th key={m} style={{ padding: "10px 10px", fontSize: 11, fontWeight: 600, color: "#999", textAlign: "center", borderBottom: "1px solid #ebebeb", whiteSpace: "nowrap" }}>{m.slice(0, 3)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any, i: number) => {
                  const isSub = r.kind === "sub";
                  const isTotal = r.kind === "total";
                  return (
                    <tr key={i} style={{ background: isTotal ? "#f9f9ff" : "transparent" }}>
                      <td style={{
                        padding: isSub ? "7px 16px 7px 32px" : "9px 16px",
                        fontSize: 13, fontWeight: isTotal ? 700 : isSub ? 400 : 600,
                        color: isTotal ? "#6366f1" : isSub ? "#888" : "#222",
                        borderBottom: "1px solid #f5f5f5", whiteSpace: "nowrap",
                        position: "sticky", left: 0, background: isTotal ? "#f9f9ff" : isSub ? "#fdfdfd" : "#fff",
                      }}>{r.label}</td>
                      {r.values.map((v: number, j: number) => (
                        <td key={j} style={{
                          padding: "8px 10px", fontSize: 13, textAlign: "center", borderBottom: "1px solid #f5f5f5",
                          color: v === 0 ? "#ddd" : isTotal ? "#6366f1" : isSub ? "#888" : "#333",
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
  const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь"];
  const [month, setMonth] = React.useState("Июнь");
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
            background: month === m ? "#6366f1" : "none", color: month === m ? "#fff" : "#999",
            border: month === m ? "none" : "1px solid #e0e0e0",
          }}>{m}</button>
        ))}
      </div>
      {!data ? <HRLoading text="Загружаю РНП…" /> : (
        <>
          {/* Воронка — карточки */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 24 }}>
            {data.funnel.map((f: any, i: number) => {
              const ok = (f.pct ?? 0) >= 90;
              const over = (f.pct ?? 0) >= 110;
              const bg = over ? "#f0fdf4" : ok ? "#fff" : "#fffbeb";
              const border = over ? "#bbf7d0" : ok ? "#ebebeb" : "#fde68a";
              const pctColor = over ? "#15803d" : ok ? "#6366f1" : "#b45309";
              const short = f.label.replace("Общее кол-во ", "").replace("кол-во ", "");
              return (
                <div key={i} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>{short}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#111", marginBottom: 4 }}>{f.fact ?? "—"}</div>
                  <div style={{ fontSize: 12, color: "#bbb", marginBottom: 6 }}>план {f.plan ?? "—"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: pctColor }}>{f.pct != null ? `${f.pct}%` : "—"}</div>
                </div>
              );
            })}
          </div>

          {/* По неделям */}
          <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden", marginBottom: 24, overflowX: "auto" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #ebebeb", fontSize: 13, fontWeight: 600 }}>Разбивка по неделям</div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  <th style={{ padding: "8px 16px", fontSize: 11, fontWeight: 600, color: "#999", textAlign: "left", borderBottom: "1px solid #ebebeb" }}>Метрика</th>
                  {[1,2,3,4,5,6].map(w => (
                    <th key={w} style={{ padding: "8px 10px", fontSize: 11, fontWeight: 600, color: "#999", textAlign: "center", borderBottom: "1px solid #ebebeb" }}>Неделя {w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.funnel.map((f: any, i: number) => {
                  const short = f.label.replace("Общее кол-во ", "").replace("кол-во ", "");
                  return (
                    <tr key={i}>
                      <td style={{ padding: "9px 16px", fontSize: 13, color: "#333", borderBottom: "1px solid #f5f5f5", whiteSpace: "nowrap" }}>{short}</td>
                      {f.weeks.map((w: any, j: number) => {
                        const hasData = w.fact != null || w.plan != null;
                        const ok2 = (w.pct ?? 0) >= 90;
                        return (
                          <td key={j} style={{ padding: "8px 10px", fontSize: 12, textAlign: "center", borderBottom: "1px solid #f5f5f5" }}>
                            {hasData && (w.fact != null || w.plan != null) ? (
                              <span>
                                <b style={{ color: ok2 ? "#15803d" : "#b45309" }}>{w.fact ?? "—"}</b>
                                <span style={{ color: "#ccc" }}>/{w.plan ?? "—"}</span>
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
                  <div key={si} style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", background: "#f9f9ff", borderBottom: "1px solid #ebebeb", fontSize: 13, fontWeight: 700, color: "#6366f1" }}>{sec.title}</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <tbody>
                        {sec.rows.map((row: any, ri: number) => {
                          const isConv = row.label.toLowerCase().includes("конверсия");
                          const ok3 = (row.pct ?? 0) >= 90;
                          const pctColor2 = (row.pct ?? 0) >= 110 ? "#15803d" : ok3 ? "#6366f1" : "#b45309";
                          return (
                            <tr key={ri} style={{ borderBottom: ri < sec.rows.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                              <td style={{ padding: "8px 14px", fontSize: 12, color: isConv ? "#999" : "#333", fontStyle: isConv ? "italic" : "normal" }}>{row.label}</td>
                              <td style={{ padding: "8px 10px", fontSize: 12, textAlign: "right", color: "#aaa" }}>{row.plan != null ? row.plan : "—"}</td>
                              <td style={{ padding: "8px 10px", fontSize: 13, textAlign: "right", fontWeight: 600, color: "#222" }}>{row.fact != null ? row.fact : "—"}</td>
                              <td style={{ padding: "8px 14px", fontSize: 12, textAlign: "right", fontWeight: 600, color: row.pct != null ? pctColor2 : "#bbb", minWidth: 48 }}>{row.pct != null ? `${row.pct}%` : "—"}</td>
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
  const T3_MONTHS = ["Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь"];
  const [month, setMonth] = React.useState("Июнь");
  const [data, setData] = React.useState<any>(null);
  React.useEffect(() => {
    setData(null);
    fetch(`${API}/api/hr/salary?month=${encodeURIComponent(month)}`).then(r => r.json()).then(setData).catch(() => {});
  }, [month]);

  const fmtRub2 = (v: number) => `${Math.round(v).toLocaleString("ru-RU")} ₽`;
  const pctColor = (v: number) => v >= 100 ? "#15803d" : v >= 80 ? "#b45309" : "#dc2626";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {T3_MONTHS.map(m => (
          <button key={m} onClick={() => setMonth(m)} style={{
            fontSize: 12, fontWeight: 500, padding: "5px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            background: month === m ? "#6366f1" : "none", color: month === m ? "#fff" : "#999",
            border: month === m ? "none" : "1px solid #e0e0e0",
          }}>{m}</button>
        ))}
      </div>
      {!data || data.error ? <HRLoading text="Загружаю данные по зарплате…" /> : (
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
                background: m.accent ? (m.ok ? "#f0fdf4" : "#fffbeb") : "#fff",
                border: `1px solid ${m.accent ? (m.ok ? "#bbf7d0" : "#fde68a") : "#ebebeb"}`,
                borderRadius: 10, padding: "16px 20px"
              }}>
                <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: m.accent ? pctColor(data.overall_pct) : "#111", letterSpacing: "-0.5px" }}>{m.value}</div>
                <div style={{ fontSize: 11, color: "#bbb", marginTop: 3 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {data.plan_text && (
            <div style={{ background: "#f9f9ff", border: "1px solid #e0e0f0", borderRadius: 10, padding: "10px 16px", marginBottom: 20, fontSize: 13, color: "#6366f1", fontWeight: 500 }}>{data.plan_text}</div>
          )}

          {/* Таблица KPI */}
          <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #ebebeb", fontSize: 13, fontWeight: 600 }}>KPI на {month.toLowerCase()}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#fafafa" }}>
                <tr>
                  {["Показатель", "Вес", "ФОТ", "План", "Факт", "%", "Выплата"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 14px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", textAlign: i === 0 ? "left" : "right", borderBottom: "1px solid #ebebeb" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.kpi.map((k: any, i: number) => {
                  const pc = pctColor(k.pct);
                  const isLast = i === data.kpi.length - 1;
                  return (
                    <tr key={i}>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "#222", borderBottom: isLast ? "none" : "1px solid #f5f5f5" }}>{k.name}</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#999", textAlign: "right", borderBottom: isLast ? "none" : "1px solid #f5f5f5" }}>{k.weight}%</td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "#aaa", textAlign: "right", borderBottom: isLast ? "none" : "1px solid #f5f5f5" }}>{fmtRub2(k.fot)}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, color: "#555", textAlign: "right", borderBottom: isLast ? "none" : "1px solid #f5f5f5" }}>{k.plan}</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 600, color: "#222", textAlign: "right", borderBottom: isLast ? "none" : "1px solid #f5f5f5" }}>{k.fact}</td>
                      <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 700, color: pc, textAlign: "right", borderBottom: isLast ? "none" : "1px solid #f5f5f5" }}>{k.pct}%</td>
                      <td style={{ padding: "11px 14px", fontSize: 13, fontWeight: 500, color: "#333", textAlign: "right", borderBottom: isLast ? "none" : "1px solid #f5f5f5" }}>{fmtRub2(k.fact_premii)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ background: "#f9f9ff" }}>
                <tr>
                  <td colSpan={6} style={{ padding: "11px 14px", fontSize: 13, fontWeight: 700, color: "#6366f1" }}>Итого премия факт</td>
                  <td style={{ padding: "11px 14px", fontSize: 14, fontWeight: 700, color: "#6366f1", textAlign: "right" }}>{fmtRub2(data.totals.fact_premii)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* SMART-задачи */}
          {data.smart_tasks.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "18px 22px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>SMART-задачи · {month}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.smart_tasks.map((t: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 12, fontSize: 13, color: "#444", lineHeight: 1.55, alignItems: "flex-start" }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#6366f1", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
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
        <div style={{ fontSize: 22, fontWeight: 700, color: "#8a6a64", fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em" }}>
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
        <div style={{ fontSize: 22, fontWeight: 700, color: "#8a6a64", fontFamily: "system-ui, sans-serif", letterSpacing: "0.02em" }}>
          Финансы
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, color: "#9e7a74", fontFamily: "system-ui, sans-serif" }}>
          Финансы скоро придут 🐰
        </div>
      </div>
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
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, minWidth: 320, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Новый раздел</div>
        <input ref={ref} value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Название раздела"
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
          style={{ width: "100%", border: "1px solid #e0e0e0", borderRadius: 8, padding: "8px 12px", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        <div style={{ marginTop: 14, marginBottom: 4, fontSize: 12, color: "#888" }}>Цвет раздела</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {PRESET_COLORS.map(c => (
            <div key={c} onClick={() => setColor(c)}
              style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: color === c ? "3px solid #111" : "2px solid transparent", boxSizing: "border-box" }} />
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
            style={{ flex: 1, background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "Создание…" : "Создать раздел"}
          </button>
          <button onClick={onClose}
            style={{ background: "none", color: "#999", border: "1px solid #e0e0e0", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
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
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, minWidth: 320, maxWidth: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Удалить повторяющееся событие</div>
        <div style={{ fontSize: 12, color: "#999", marginBottom: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{taskTitle}</div>
        {(["this", "following", "all"] as RecurringDeleteOption[]).map(opt => {
          const labels: Record<RecurringDeleteOption, string> = {
            this: "Только это событие",
            following: "Это и следующие события",
            all: "Все события",
          };
          return (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, cursor: "pointer", background: selected === opt ? "#f5f5f5" : "transparent", marginBottom: 4 }}>
              <input type="radio" name="recurringDelete" checked={selected === opt} onChange={() => setSelected(opt)}
                style={{ accentColor: "#111", width: 16, height: 16 }} />
              <span style={{ fontSize: 14 }}>{labels[opt]}</span>
            </label>
          );
        })}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={() => onSelect(selected)}
            style={{ flex: 1, background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "9px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Удалить
          </button>
          <button onClick={onClose}
            style={{ background: "none", color: "#999", border: "1px solid #e0e0e0", borderRadius: 8, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
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
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 16, padding: 32 }}>
        <div style={{ marginBottom: 4, fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.5px" }}>{TYPE_LABELS[material.type]}</div>
        <h2 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 600, color: "#111" }}>{material.title}</h2>
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
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#1A6B52", color: "#fff", borderRadius: 10, padding: "14px 24px", fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            📄 Открыть презентацию
          </button>
        )}
        {!loading && material.type === "video" && material.content_url && (
          <a href={material.content_url} target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#1A6B52", color: "#fff", borderRadius: 10, padding: "14px 24px", fontSize: 14, fontWeight: 500, textDecoration: "none", fontFamily: "inherit" }}>
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
  "Юридическая база": "#e53e3e",
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
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 16, padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>{SECTION_ICONS[activeSection.title] || "📄"}</span>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111" }}>{activeSection.title}</h2>
                {activeSection.description && <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: 13 }}>{activeSection.description}</p>}
              </div>
            </div>
            <button onClick={() => setShowAddMaterial(true)} style={{ background: color, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
              + Добавить материал
            </button>
          </div>

          {showAddMaterial && (
            <div style={{ background: "#f8f8f8", borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={newMatTitle} onChange={e => setNewMatTitle(e.target.value)} placeholder="Название материала"
                  style={{ padding: "8px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                <select value={newMatType} onChange={e => setNewMatType(e.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: "#fff" }}>
                  <option value="presentation">Презентация</option>
                  <option value="video">Видео</option>
                  <option value="article">Статья</option>
                </select>
                <input value={newMatUrl} onChange={e => setNewMatUrl(e.target.value)} placeholder="Ссылка на файл (Google Slides, YouTube, и т.д.)"
                  style={{ padding: "8px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addMaterial} disabled={saving} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    {saving ? "Сохранение..." : "Сохранить"}
                  </button>
                  <button onClick={() => setShowAddMaterial(false)} style={{ background: "none", color: "#999", border: "1px solid #e0e0e0", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
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
                  style={{ display: "flex", alignItems: "center", gap: 14, background: "none", border: "1px solid #ebebeb", borderRadius: 10, padding: "12px 16px", cursor: "pointer", textAlign: "left", fontFamily: "inherit", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "#ebebeb")}>
                  <span style={{ fontSize: 16 }}>{m.type === "video" ? "▶" : m.type === "article" ? "📄" : m.type === "test" ? "✓" : "📊"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#111" }}>{m.title}</div>
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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#111" }}>Обучение</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Учебные материалы для команды</p>
        </div>
        <button onClick={() => setShowAddSection(true)} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          + Раздел
        </button>
      </div>

      {showAddSection && (
        <div style={{ background: "#f8f8f8", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input value={newSectionTitle} onChange={e => setNewSectionTitle(e.target.value)} placeholder="Название раздела"
              style={{ padding: "8px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
            <input value={newSectionDesc} onChange={e => setNewSectionDesc(e.target.value)} placeholder="Описание (необязательно)"
              style={{ padding: "8px 12px", border: "1px solid #e0e0e0", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={addSection} disabled={saving} style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {saving ? "Сохранение..." : "Создать"}
              </button>
              <button onClick={() => setShowAddSection(false)} style={{ background: "none", color: "#999", border: "1px solid #e0e0e0", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
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
                style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 14, padding: "20px 20px 18px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s", fontFamily: "inherit" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#ebebeb")}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af", background: "#f5f5f5", borderRadius: 6, padding: "2px 8px" }}>
                    {count} {count === 1 ? "материал" : count >= 2 && count <= 4 ? "материала" : "материалов"}
                  </span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: "#111", marginBottom: 4 }}>{section.title}</div>
                {section.description && <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{section.description}</div>}
                <div style={{ marginTop: 14, height: 3, background: "#f0f0f0", borderRadius: 2 }}>
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
  padding: "5px 10px", borderRadius: 7, border: "1px solid #e0e0e0",
  fontSize: 12, fontFamily: "inherit", background: "#fff", color: "#333",
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

  const activeDeals = deals.filter(d => !d.is_fired);
  const firedDeals = deals.filter(d => d.is_fired);
  const byStage: Record<string, RiskDeal[]> = {};
  for (const d of activeDeals) {
    if (!byStage[d.stage]) byStage[d.stage] = [];
    byStage[d.stage].push(d);
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
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit", border: "1px solid",
              borderColor: tab === t ? "#111" : "#e0e0e0",
              background: tab === t ? "#111" : "#fff",
              color: tab === t ? "#fff" : "#666",
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
            style={{ fontSize: 11, color: "#bbb", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}
          >
            сбросить
          </button>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            style={{ fontSize: 11, color: "#bbb", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            ↻ обновить
          </button>
        </div>
      </div>

      {/* Deals list */}
      {loading ? (
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: 28, textAlign: "center", color: "#bbb", fontSize: 13, marginBottom: 32 }}>
          Загрузка из Bitrix…
        </div>
      ) : error ? (
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: 24, textAlign: "center", fontSize: 13, marginBottom: 32 }}>
          <div style={{ color: "#e53e3e", marginBottom: 8 }}>{error}</div>
          <button onClick={() => setRefreshKey(k => k + 1)} style={{ fontSize: 12, color: "#999", background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            Попробовать снова
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 32 }}>
          {activeDeals.length === 0 && firedDeals.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: 28, textAlign: "center", color: "#bbb", fontSize: 13 }}>
              {tab === "stuck" ? "Зависших сделок нет" : "Сделок не найдено"}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(Math.max(stages.length, 1), 3)}, 1fr)`, gap: 10, marginBottom: firedDeals.length > 0 ? 10 : 0 }}>
            {stages.map(stage => (
              <DealStageGroup key={stage} stage={stage} deals={byStage[stage]} />
            ))}
          </div>
          {firedDeals.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #fdd", borderRadius: 12, overflow: "hidden", marginTop: 6 }}>
              <div style={{ padding: "13px 20px", background: "#fff5f5", borderBottom: "1px solid #fdd", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#c53030", flex: 1 }}>Сделки уволенных сотрудников</span>
                <span style={{ fontSize: 11, color: "#e53e3e", background: "#fed7d7", borderRadius: 10, padding: "2px 8px" }}>{firedDeals.length}</span>
                <span style={{ fontSize: 12, color: "#fc8181" }}>требуют переназначения</span>
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
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter', -apple-system, sans-serif", color: "#111", display: "flex" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, minHeight: "100vh", background: "#fff", borderRight: "1px solid #ebebeb", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.svg" alt="Oazis Estate" style={{ width: 32, height: 32, filter: "invert(27%) sepia(51%) saturate(500%) hue-rotate(115deg) brightness(85%)" }} />
            <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.3px" }}>Oazis Estate</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.8px", padding: "4px 12px 8px" }}>Кабинет</div>
          {NAV_ITEMS.map(item => {
            const active = activeTab === item.key;
            return (
              <button key={item.key}
                onClick={() => setActiveTab(item.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? "#f0f0ff" : "none", fontFamily: "inherit",
                  color: active ? "#5b4ff5" : "#555",
                  fontWeight: active ? 600 : 400, fontSize: 13, textAlign: "left", marginBottom: 2,
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f8f8f8"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "none"; }}
              >
                <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom date */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f0f0" }}>
          <div style={{ fontSize: 11, color: "#bbb" }}>{dateLabel}</div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>

        {activeTab === "deals" && (
          <>
            {/* Риск-баннер */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Под риском</div>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-1px", color: "#111" }}>—</div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>комиссий без движения</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Зависших сделок</div>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-1px" }}>—</div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>требуют внимания</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Задач просрочено</div>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-1px", color: overdue > 0 ? "#e53e3e" : "#111" }}>{overdue}</div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>из {tasks.length} активных</div>
              </div>
            </div>

            {/* Зависшие / Все сделки */}
            <DealsSection />

            {/* Задачи — шапка */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setShowArchive(false)}
                  style={{ background: !showArchive ? "#111" : "#fff", color: !showArchive ? "#fff" : "#666", border: "1px solid " + (!showArchive ? "#111" : "#e0e0e0"), borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  Неделя
                </button>
                <button onClick={() => setShowArchive(true)}
                  style={{ background: showArchive ? "#555" : "#fff", color: showArchive ? "#fff" : "#888", border: "1px solid " + (showArchive ? "#555" : "#e0e0e0"), borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                  📁 Архив
                </button>
              </div>
              {!showArchive && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setShowNewDirection(true)}
                    style={{ background: "#fff", color: "#555", border: "1px solid #e0e0e0", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    + Раздел
                  </button>
                  <button onClick={() => setAddingGlobal(true)}
                    style={{ background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
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
                  <div style={{ textAlign: "center", padding: "48px 0", color: "#bbb", fontSize: 13 }}>Загрузка…</div>
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

        {activeTab === "team" && <TeamSection />}
        {activeTab === "brokers" && <PlaceholderSection label="Расходы компании" />}
        {activeTab === "rnp" && <RnpEfficiencySection />}

        {activeTab === "weekly" && <HRDashboard />}
        {activeTab === "finance" && <FinancePlaceholder />}
        {activeTab === "legal" && <LegalSection />}
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
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#111", color: "#fff", borderRadius: 12, padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 4px 24px rgba(0,0,0,0.25)", zIndex: 9999, fontSize: 13, whiteSpace: "nowrap" }}>
          <span>Задача удалена: <b>{undoState.task.title}</b></span>
          <button onClick={undoDelete}
            style={{ background: "#fff", color: "#111", border: "none", borderRadius: 8, padding: "5px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
