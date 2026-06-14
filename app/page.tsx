"use client";
import { useEffect, useState } from "react";

const API = "http://localhost:8000";

const DIRECTION_LABELS: Record<string, string> = {
  support: "📋 Сопровождение",
  sales: "💼 Продажи",
  hr: "👥 HR",
  care: "💛 Отдел заботы",
  finance: "💰 Финансы",
  marketing: "📣 Маркетинг",
  instagram: "📸 Инстаграм",
  personal: "⭐ Личное",
  other: "📌 Другое",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "border-l-4 border-red-500",
  medium: "border-l-4 border-yellow-400",
  low: "border-l-4 border-green-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "🔴 Срочно",
  medium: "🟡 Обычное",
  low: "🟢 Руки дойдут",
};

type Task = {
  id: number;
  title: string;
  description?: string;
  direction: string;
  priority: string;
  deadline?: string;
  is_done: boolean;
  repeat: string;
  source: string;
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/tasks/?is_done=false`);
      const data = await res.json();
      setTasks(data);
    } catch {
      console.error("Не удалось загрузить задачи — убедись что backend запущен");
    }
    setLoading(false);
  };

  const markDone = async (id: number) => {
    await fetch(`${API}/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_done: true }),
    });
    fetchTasks();
  };

  useEffect(() => { fetchTasks(); }, []);

  const today = new Date().toISOString().split("T")[0];

  const filtered = filter === "all"
    ? tasks
    : filter === "today"
    ? tasks.filter(t => t.deadline && t.deadline <= today)
    : tasks.filter(t => t.direction === filter);

  const urgent = tasks.filter(t => t.priority === "high").length;
  const overdue = tasks.filter(t => t.deadline && t.deadline < today).length;
  const directions = Array.from(new Set(tasks.map(t => t.direction)));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Oazis Estate</h1>
          <p className="text-sm text-gray-500">Операционный дашборд</p>
        </div>
        <div className="text-sm text-gray-500">
          {new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Сводка */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="text-2xl font-bold text-gray-800">{tasks.length}</div>
            <div className="text-sm text-gray-500">Активных задач</div>
          </div>
          <div className={`rounded-xl p-4 shadow-sm border ${urgent > 0 ? "bg-red-50 border-red-200" : "bg-white"}`}>
            <div className={`text-2xl font-bold ${urgent > 0 ? "text-red-600" : "text-gray-800"}`}>{urgent}</div>
            <div className="text-sm text-gray-500">Срочных</div>
          </div>
          <div className={`rounded-xl p-4 shadow-sm border ${overdue > 0 ? "bg-orange-50 border-orange-200" : "bg-white"}`}>
            <div className={`text-2xl font-bold ${overdue > 0 ? "text-orange-600" : "text-gray-800"}`}>{overdue}</div>
            <div className="text-sm text-gray-500">Просрочено</div>
          </div>
        </div>

        {/* Фильтры */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: "all", label: "Все" },
            { key: "today", label: "⏰ Сегодня" },
            ...directions.map(d => ({ key: d, label: DIRECTION_LABELS[d] || d }))
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === key ? "bg-indigo-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Список задач */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Нет задач ✅</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(task => {
              const isOverdue = task.deadline && task.deadline < today;
              return (
                <div key={task.id}
                  className={`bg-white rounded-xl p-4 shadow-sm ${PRIORITY_COLOR[task.priority] || ""} flex items-start gap-3`}>
                  <button onClick={() => markDone(task.id)}
                    className="mt-0.5 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 flex-shrink-0 transition-colors" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${PRIORITY_BADGE[task.priority]}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{DIRECTION_LABELS[task.direction] || task.direction}</span>
                      {task.deadline && (
                        <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                          {isOverdue ? "⚠️ до " : "до "}
                          {new Date(task.deadline + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {task.repeat !== "none" && <span>🔄 Повторяется</span>}
                      {task.source === "sheets" && <span>📊 Спринт</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={fetchTasks}
          className="mt-6 text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1">
          🔄 Обновить
        </button>
      </div>
    </div>
  );
}
