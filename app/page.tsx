"use client";
import React, { useEffect, useState, useRef } from "react";

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
  { key: "sales",       label: "Продажи",         icon: "↗"  },
  { key: "support",     label: "Сопровождение",   icon: "✓"  },
  { key: "reporting",   label: "Отчётность",      icon: "▦"  },
  { key: "rnp",         label: "Годовой свод РНП",icon: "📋" },
  { key: "weekly",      label: "По неделям",      icon: "📅" },
  { key: "brokers",     label: "Расходы брокеров",icon: "💳" },
  { key: "knowledge",   label: "Обучение",        icon: "📖" },
  { key: "finance",     label: "Финансы",         icon: "₽"  },
  { key: "team",        label: "Команда",         icon: "👥" },
  { key: "legal",       label: "Юр-риски",        icon: "⚖"  },
  { key: "leads",       label: "Лиды",            icon: "◎"  },
  { key: "competitors", label: "Конкуренты",      icon: "⊛"  },
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

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDays = getWeekDays(baseDate);
  const weekStart = toYMD(weekDays[0]);
  const weekEnd = toYMD(weekDays[6]);

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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"funnel" | "brokers">("funnel");

  React.useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/sales/rating`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Ошибка загрузки данных"); setLoading(false); });
  }, []);

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
          {(["funnel", "brokers"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              background: view === v ? "#111" : "none", color: view === v ? "#fff" : "#999",
              border: view === v ? "none" : "1px solid #e0e0e0",
            }}>{v === "funnel" ? "Воронка" : "Рейтинг брокеров"}</button>
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
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "24px 28px" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Воронка продаж</div>
          <div style={{ fontSize: 12, color: "#bbb", marginBottom: 24 }}>Подсвечено узкое место — этап с худшей конверсией</div>
          {data.funnel.map((stage, i) => {
            const barW = Math.max((stage.value / maxFunnelVal) * 100, 2);
            const isBottleneck = stage.stage === data.bottleneck;
            return (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                  <div style={{ width: 140, fontSize: 13, color: "#444", flexShrink: 0, textAlign: "right" }}>{stage.stage}</div>
                  <div style={{ flex: 1, position: "relative", height: 32, background: "#f5f5f5", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${barW}%`,
                      background: isBottleneck ? "#f87171" : "linear-gradient(90deg, #818cf8, #6366f1)",
                      borderRadius: 6, display: "flex", alignItems: "center", paddingLeft: 10,
                    }}>
                      <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{Math.round(stage.value)}</span>
                    </div>
                    {isBottleneck && (
                      <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, fontWeight: 700, background: "#fde68a", color: "#92400e", borderRadius: 4, padding: "1px 6px" }}>УЗКОЕ МЕСТО</span>
                    )}
                  </div>
                  {stage.conv !== null && (
                    <div style={{ width: 60, fontSize: 12, color: isBottleneck ? "#e53e3e" : "#999", fontWeight: isBottleneck ? 700 : 400, flexShrink: 0 }}>↓ {stage.conv}%</div>
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
  const deals = MOCK_SUPPORT_DEALS;
  const thStyle: React.CSSProperties = { padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "left", borderBottom: "1px solid #ebebeb", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13, borderBottom: "1px solid #f5f5f5", verticalAlign: "middle" };

  const riskCount = deals.filter(d => d.is_risk).length;

  return (
    <div>
      {/* Шапка */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>Отдел сопровождения</div>
          <div style={{ fontSize: 12, color: "#bbb", marginTop: 2 }}>Первичный источник: таблица «Отдела сопровождения» · Google Sheets</div>
        </div>
        <span style={{ fontSize: 11, color: "#f6ad55", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "5px 12px" }}>Черновик · данные тестовые</span>
      </div>

      {/* Метрики */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Активных сделок</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{deals.length}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Под риском</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: riskCount > 0 ? "#e53e3e" : "#111" }}>{riskCount}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 10, padding: "16px 20px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Следующий дайджест</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>10:00</div>
        </div>
      </div>

      {/* Таблица */}
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#fafafa" }}>
            <tr>
              <th style={thStyle}>Клиент</th>
              <th style={thStyle}>Ответственный</th>
              <th style={thStyle}>Статус</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Дней без движения</th>
              <th style={thStyle}>Последнее обновление</th>
              <th style={thStyle}>Примечание</th>
              <th style={{ ...thStyle, textAlign: "center" }}>Риск</th>
            </tr>
          </thead>
          <tbody>
            {deals.map(d => (
              <tr key={d.id} style={{ transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <td style={{ ...tdStyle, fontWeight: 500 }}>{d.client}</td>
                <td style={{ ...tdStyle, color: "#666" }}>{d.executor}</td>
                <td style={tdStyle}>
                  <span style={{ background: "#f5f5f5", color: "#555", borderRadius: 6, padding: "3px 8px", fontSize: 12 }}>{d.status}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <span style={{ color: d.age_days >= 3 ? "#e53e3e" : "#bbb", fontWeight: d.age_days >= 3 ? 600 : 400 }}>{d.age_days} дн.</span>
                </td>
                <td style={{ ...tdStyle, color: "#999", fontSize: 12 }}>{fmtDeadline(d.last_update)}</td>
                <td style={{ ...tdStyle, color: "#999", fontSize: 12, maxWidth: 200 }}>
                  <span style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const }}>{d.note || "—"}</span>
                </td>
                <td style={{ ...tdStyle, textAlign: "center" }}>
                  {d.is_risk
                    ? <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#e53e3e" }} />
                    : <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#68d391" }} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Team Section ────────────────────────────────────────────────────────────
function TeamSection() {
  const [data, setData] = React.useState<{ period: string; total_brokers: number; brokers: any[] } | null>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetch(`${API}/api/sales/team`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  const medal = (r: number) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : String(r);
  if (loading) return <div style={{ color: "#bbb", padding: 40, textAlign: "center" }}>Загрузка…</div>;
  if (!data) return <div style={{ color: "#e53e3e", padding: 40, textAlign: "center" }}>Ошибка загрузки</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Команда брокеров</h2>
        <span style={{ fontSize: 12, color: "#999" }}>{data.period} · {data.total_brokers} брокеров</span>
      </div>
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #ebebeb" }}>
              {["#", "Брокер", "Лиды", "Квалы", "Сделки", "Комиссия", "Ср. чек", "В работе"].map(h => (
                <th key={h} style={{ padding: "10px 14px", textAlign: h === "#" || h === "В работе" ? "center" : "left", fontWeight: 600, color: "#555", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.brokers.map((b: any, i: number) => (
              <tr key={b.name} style={{ borderBottom: i < data.brokers.length - 1 ? "1px solid #f5f5f5" : "none" }}>
                <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600, fontSize: 13 }}>{medal(b.rank)}</td>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>{b.name}{b.tier ? <span style={{ marginLeft: 6, fontSize: 10, color: "#999", background: "#f5f5f5", borderRadius: 4, padding: "1px 5px" }}>{b.tier}</span> : null}</td>
                <td style={{ padding: "10px 14px" }}>{b.leads}</td>
                <td style={{ padding: "10px 14px" }}>{b.quals}</td>
                <td style={{ padding: "10px 14px", fontWeight: 500 }}>{b.deals}</td>
                <td style={{ padding: "10px 14px" }}>{b.commission > 0 ? `${fmt(b.commission)} ₽` : "—"}</td>
                <td style={{ padding: "10px 14px", color: "#888" }}>{b.avg_check > 0 ? `${fmt(b.avg_check)} ₽` : "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "center", color: b.open_deals > 0 ? "#5b4ff5" : "#bbb", fontWeight: b.open_deals > 0 ? 600 : 400 }}>{b.open_deals > 0 ? b.open_deals : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    fetch(`${API}/api/sales/rating`).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  if (loading) return <div style={{ color: "#bbb", padding: 40, textAlign: "center" }}>Загрузка…</div>;
  if (!data) return <div style={{ color: "#e53e3e", padding: 40, textAlign: "center" }}>Ошибка загрузки</div>;
  const total = data.brokers.reduce((s: number, b: any) => s + b.commission, 0);
  const totalDeals = data.brokers.reduce((s: number, b: any) => s + b.deals, 0);
  const topBroker = data.brokers[0]?.name || "—";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Отчётность</h2>
        <span style={{ fontSize: 12, color: "#999" }}>{data.period}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Оборот компании</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-1px" }}>{fmt(data.company_val)} ₽</div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>объём сделок</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Эффективный доход</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-1px", color: "#22c55e" }}>{fmt(data.company_eff)} ₽</div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>комиссия за период</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
          <div style={{ fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>Брокерских комиссий</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-1px" }}>{fmt(total)} ₽</div>
          <div style={{ fontSize: 11, color: "#bbb", marginTop: 4 }}>всего по {totalDeals} сделкам</div>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "#333" }}>Топ-5 брокеров по комиссии</div>
        {data.brokers.slice(0, 5).map((b: any, i: number) => {
          const pct = total > 0 ? Math.round(b.commission / total * 100) : 0;
          return (
            <div key={b.name} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} {b.name}</span>
                <span style={{ color: "#5b4ff5", fontWeight: 600 }}>{b.commission > 0 ? `${fmt(b.commission)} ₽` : "—"} <span style={{ color: "#bbb", fontWeight: 400 }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: i === 0 ? "#5b4ff5" : "#a5b4fc", borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Placeholder Section ──────────────────────────────────────────────────────
function PlaceholderSection({ label }: { label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px", color: "#bbb" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🚧</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: "#999", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13 }}>Раздел в разработке</div>
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

// ── Learning Panel ────────────────────────────────────────────────────────────
const LEARNING_SECTIONS = [
  { id: "sales",    title: "Продажи",           desc: "Техники продаж, работа с возражениями, скрипты",    icon: "↗", color: "#1A6B52", materials: 0 },
  { id: "marketing",title: "Маркетинг",         desc: "Продвижение, реклама, аналитика",                   icon: "◎", color: "#2563eb", materials: 0 },
  { id: "team",     title: "Управление командой", desc: "Лидерство, мотивация, делегирование",             icon: "👥", color: "#d97706", materials: 0 },
  { id: "product",  title: "Продукт",            desc: "Знание объектов, условия, застройщики",            icon: "⌂", color: "#7c3aed", materials: 0 },
  { id: "legal",    title: "Юридическая база",   desc: "Договоры, ипотека, документация",                  icon: "⚖", color: "#e53e3e", materials: 0 },
];

function LearningPanel() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  if (activeSection) {
    const section = LEARNING_SECTIONS.find(s => s.id === activeSection)!;
    return (
      <div>
        <button
          onClick={() => setActiveSection(null)}
          style={{ marginBottom: 20, background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 13, display: "flex", alignItems: "center", gap: 6, padding: 0, fontFamily: "inherit" }}
        >
          ← Все разделы
        </button>
        <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 16, padding: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <span style={{ fontSize: 24 }}>{section.icon}</span>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#111" }}>{section.title}</h2>
          </div>
          <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 32 }}>{section.desc}</p>
          <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af", fontSize: 14 }}>
            Материалы появятся здесь после загрузки контента
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#111" }}>Обучение</h2>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>Учебные материалы для команды</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {LEARNING_SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 14, padding: "20px 20px 18px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s", fontFamily: "inherit" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = section.color)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "#ebebeb")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <span style={{ fontSize: 11, color: "#9ca3af", background: "#f5f5f5", borderRadius: 6, padding: "2px 8px" }}>
                {section.materials === 0 ? "Скоро" : `${section.materials} материалов`}
              </span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111", marginBottom: 4 }}>{section.title}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.5 }}>{section.desc}</div>
            <div style={{ marginTop: 14, height: 3, background: "#f0f0f0", borderRadius: 2 }}>
              <div style={{ height: "100%", width: "0%", background: section.color, borderRadius: 2 }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [riskDeals, setRiskDeals] = useState<RiskDeal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);
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

  const fetchDeals = async () => {
    setDealsLoading(true);
    setDealsError(null);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${API}/api/deals/at-risk`, { signal: controller.signal });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) { setDealsError("Ошибка загрузки сделок из Bitrix"); setRiskDeals([]); }
      else setRiskDeals(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setDealsError(e instanceof Error && e.name === "AbortError" ? "Превышено время ожидания Bitrix" : "Нет соединения с сервером");
      setRiskDeals([]);
    }
    setDealsLoading(false);
  };

  const fetchDirections = async () => {
    try {
      const res = await fetch(`${API}/api/directions/`);
      const data = await res.json();
      dirStore.list = Array.isArray(data) ? data : [];
      setDirections([...dirStore.list]);
    } catch { dirStore.list = []; }
  };

  useEffect(() => { fetchTasks(); fetchDeals(); fetchDirections(); }, []);

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
  const riskMoney = riskDeals.reduce((s, d) => s + (d.commission || 0), 0);
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", fontFamily: "'Inter', -apple-system, sans-serif", color: "#111", display: "flex" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, minHeight: "100vh", background: "#fff", borderRight: "1px solid #ebebeb", display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>O</div>
            <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.3px" }}>OazisEstate</div>
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
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-1px", color: riskMoney > 0 ? "#e53e3e" : "#111" }}>
                  {dealsLoading ? "—" : riskMoney > 0 ? `${fmt(riskMoney)} ₽` : "—"}
                </div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>комиссий без движения</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Зависших сделок</div>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-1px" }}>{dealsLoading ? "—" : riskDeals.length}</div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>требуют внимания</div>
              </div>
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "20px 24px" }}>
                <div style={{ fontSize: 12, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Задач просрочено</div>
                <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-1px", color: overdue > 0 ? "#e53e3e" : "#111" }}>{overdue}</div>
                <div style={{ fontSize: 12, color: "#bbb", marginTop: 4 }}>из {tasks.length} активных</div>
              </div>
            </div>

            {/* Зависшие сделки — заголовок */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>Зависшие сделки</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#bbb" }}>по дате последнего движения</span>
                <button onClick={fetchDeals} style={{ fontSize: 11, color: "#bbb", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>↻ обновить</button>
              </div>
            </div>

            {dealsLoading ? (
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "28px", textAlign: "center", color: "#bbb", fontSize: 13, marginBottom: 32 }}>Загрузка из Bitrix…</div>
            ) : dealsError ? (
              <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "24px", textAlign: "center", fontSize: 13, marginBottom: 32 }}>
                <div style={{ color: "#e53e3e", marginBottom: 8 }}>{dealsError}</div>
                <button onClick={fetchDeals} style={{ fontSize: 12, color: "#999", background: "none", border: "1px solid #e0e0e0", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>Попробовать снова</button>
              </div>
            ) : (() => {
              const activeDeals = riskDeals.filter(d => !d.is_fired);
              const firedDeals = riskDeals.filter(d => d.is_fired);

              // group active by stage
              const byStage: Record<string, RiskDeal[]> = {};
              for (const d of activeDeals) {
                if (!byStage[d.stage]) byStage[d.stage] = [];
                byStage[d.stage].push(d);
              }
              const stages = STAGE_ORDER.filter(s => byStage[s]);

              return (
                <div style={{ marginBottom: 32 }}>
                  {activeDeals.length === 0 && firedDeals.length === 0 && (
                    <div style={{ background: "#fff", border: "1px solid #ebebeb", borderRadius: 12, padding: "28px", textAlign: "center", color: "#bbb", fontSize: 13 }}>Зависших сделок нет</div>
                  )}

                  {/* По стадиям — горизонтально */}
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(stages.length, 3)}, 1fr)`, gap: 10, marginBottom: firedDeals.length > 0 ? 10 : 0 }}>
                    {stages.map(stage => (
                      <DealStageGroup key={stage} stage={stage} deals={byStage[stage]} />
                    ))}
                  </div>

                  {/* Сделки уволенных */}
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
              );
            })()}

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
        {activeTab === "brokers" && <BrokerCostsSection />}
        {activeTab === "reporting" && <ReportingSection />}
        {activeTab === "rnp" && <ReportingSection />}
        {activeTab === "leads" && <SalesDashboard />}
        {activeTab === "weekly" && <PlaceholderSection label="По неделям" />}
        {activeTab === "finance" && <PlaceholderSection label="Финансы" />}
        {activeTab === "legal" && <PlaceholderSection label="Юр-риски" />}
        {activeTab === "competitors" && <PlaceholderSection label="Конкуренты" />}

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
