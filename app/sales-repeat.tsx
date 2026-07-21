"use client";

import React from "react";

// ── Повторные продажи (подраздел «Отдел продаж») ────────────────────────────
// Данные вносятся руками — источник живёт в Google Sheets «Сделки Краузе Мария ОЕ»,
// автоматической выгрузки нет. Чтобы обновить раскладку, правится ТОЛЬКО REPEAT_DATA.
//
// В строках показателей хранятся числитель и знаменатель, а не процент: доля и длина
// полосы считаются из них. Так процент не может разойтись с подписью «20 из 103».

type MetricRow = { year: number; num: number; den: number };

export const REPEAT_DATA = {
  /** Дата актуальности — показывается в шапке раздела */
  updated: "16 июля 2026",

  /** Верхняя граница шкалы полос, %. Общая для всех блоков — иначе окна несравнимы */
  scale: 24,

  windows: [
    {
      key: "h1",
      title: "Первое полугодие · январь–июль",
      note: "одинаковое окно, честное сравнение",
      clients: [
        { year: 2025, num: 20, den: 103 },
        { year: 2026, num: 6, den: 69 },
      ] as MetricRow[],
      lots: [
        { year: 2025, num: 28, den: 134 },
        { year: 2026, num: 6, den: 75 },
      ] as MetricRow[],
    },
    {
      key: "year",
      title: "Весь год",
      note: "2025 полный, 2026 на июль (неполный)",
      clients: [
        { year: 2025, num: 29, den: 226 },
        { year: 2026, num: 8, den: 96 },
      ] as MetricRow[],
      lots: [
        { year: 2025, num: 62, den: 281 },
        { year: 2026, num: 8, den: 104 },
      ] as MetricRow[],
    },
  ],

  thesis:
    "Повторные продажи у нас не канал, а побочный продукт: они возникают сами — из платного " +
    "яндекс-трафика и связей пары агентов. По честному сравнению одинаковых окон (7 месяцев) " +
    "в 2026-м повторки просели вдвое и по клиентам, и по лотам. А за полный 2025-й видно, что " +
    "держались они во многом на инвесторах, бравших портфелями, — этот сегмент в 2026-м выпал.",

  insight:
    "За полный 2025-й вернувшиеся клиенты — 13% по головам, но 22% всех лотов: инвестор брал " +
    "в среднем по 2,1 лота. В 2026-м разрыв исчез (8,3% ≈ 7,7%) — вернувшиеся берут по одному лоту. " +
    "Выпал именно портфельный сегмент инвесторов — самый доходный.",

  risks: [
    { tag: "ИНВЕСТОРЫ", title: "Ушёл портфельный сегмент", text: "За 2025-й повторные лоты — 22%, инвесторы брали по 5–16 лотов. В 2026-м — 8%, портфельных покупок в повторках нет." },
    { tag: "ТРЕНД", title: "Свежие сделки — вниз вдвое", text: "Полугодие к полугодию: клиенты 19,4% → 8,7%, лоты 20,9% → 8,0%. Просел и объём (103 → 69 клиентов)." },
    { tag: "КОНЦЕНТРАЦИЯ", title: "Всё на одном застройщике", text: "Почти все повторки 2026-го — СК «Жилищная Инициатива» (Ризалта), 8 из 11. Уйдёт партнёр — обнулится." },
    { tag: "ЛЮДИ", title: "Держится на 3–4 агентах", text: "В 2025-м топ-4 агента дали больше половины повторок. Компетенция в головах, а не в регламенте." },
    { tag: "УЧЁТ", title: "Нечем управлять", text: "Флаг «повторная» ставится непоследовательно, нет чистого ID клиента. Метрику нельзя достоверно считать помесячно." },
  ],

  money: {
    headline: "≈ 11–30 млн ₽ комиссии в год",
    sub: "Средняя комиссия с одной повторной продажи — 1,26 млн ₽. Ориентир по объёму — 226 продаж в год. Сценарии подъёма с текущих ~9% (по клиентам):",
    scenarios: [
      { label: "Удержать уровень 2025 (13%)", value: "+11 млн ₽" },
      { label: "Поднять до 15%", value: "+17 млн ₽" },
      { label: "Выйти на 19% (было в H1 2025)", value: "+30 млн ₽" },
    ],
  },

  plan: [
    { title: "Назначить владельца повторных продаж.", text: "Отдельная метрика в плане отдела, чистый помесячный подсчёт — по клиентам и по лотам." },
    { title: "Вернуть инвесторов.", text: "Всех, кто брал портфелями (Айрапетян, Токарев, Кузнецова…), — на системное касание, новые лоты им первыми, до трат на трафик." },
    { title: "Реферальная программа.", text: "Формализовать бонус за приведённого клиента — сарафан сейчас почти не работает (7 из 39)." },
    { title: "Расшить концентрацию.", text: "Повторить плейбук «Жилищной Инициативы» ещё с 2–3 застройщиками." },
    { title: "Навести порядок в CRM.", text: "Единое правило тегирования повторки и ID клиента — иначе метрика неуправляема." },
  ],

  decision:
    "Вопрос не «дотянуть до какого-то процента» — цели по повторкам у нас нет. Вопрос стратегический: " +
    "делаем ли мы повторные продажи управляемым каналом? Сейчас это ~13% клиентов на автопилоте из платного " +
    "трафика, а портфельные инвесторы в 2026-м выпали. Потенциал сегмента — сотни клиентов базы 2024–2025 " +
    "плюс инвесторы — кратно выше, но требует владельца и вложений в удержание. Альтернатива — продолжать " +
    "каждый раз покупать трафик заново.",

  source:
    "Источник: Google Sheets «Сделки Краузе Мария ОЕ», вкладки «Всего реализовано 2025/2026». Считалось по " +
    "фактически поступившей комиссии; оптовые покупки объединены в одного клиента. Полугодие — по дате получения " +
    "задатка (январь–июль каждого года). Показатель 1 — доля вернувшихся клиентов; показатель 2 — доля лотов " +
    "вернувшихся клиентов. 2026 — данные на июль, год не завершён. Полного реестра 2024 в таблице нет.",
};

/** Цвета годов — смысловые, не декоративные: синий = базовый год, терракота = текущий */
const YEAR_COLOR: Record<number, string> = { 2025: "#2c6fb0", 2026: "#c15a36" };
const yearColor = (y: number) => YEAR_COLOR[y] ?? "var(--ink-2)";

const pctOf = (r: MetricRow) => (r.den ? (r.num / r.den) * 100 : 0);
const fmtPct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)", whiteSpace: "nowrap" }}>
        {children}
      </span>
      <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function MetricBars({ label, rows, scale }: { label: string; rows: MetricRow[]; scale: number }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
        {label}
      </div>
      {rows.map(r => {
        const pct = pctOf(r);
        const width = Math.min(100, (pct / scale) * 100);
        const c = yearColor(r.year);
        return (
          <div key={r.year} style={{ display: "grid", gridTemplateColumns: "44px 1fr 104px", alignItems: "center", gap: 12, margin: "8px 0" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: c }}>{r.year}</span>
            <div style={{ position: "relative", height: 22, background: "var(--surface-2)", borderRadius: "var(--r-sm)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${width}%`, background: c, borderRadius: "var(--r-sm)" }} />
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: c }}>{fmtPct(pct)}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.num} из {r.den}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RepeatSalesPanel() {
  const d = REPEAT_DATA;
  const h1 = d.windows[0];
  const year = d.windows[1];

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--r-md)",
    padding: "20px 24px",
  };

  return (
    <div style={{ maxWidth: 900 }}>
      {/* Три показателя сверху */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { k: "Повторные клиенты · 7 мес (янв–июль)", v: `${fmtPct(pctOf(h1.clients[0]))} → ${fmtPct(pctOf(h1.clients[1]))}`, n: "2025 → 2026", c: yearColor(2026) },
          { k: "Повторные лоты · 7 мес (янв–июль)", v: `${fmtPct(pctOf(h1.lots[0]))} → ${fmtPct(pctOf(h1.lots[1]))}`, n: "2025 → 2026", c: yearColor(2026) },
          { k: "Недобор комиссии в год", v: "11–30 млн ₽", n: "если управлять повторками", c: "var(--warn-ink)" },
        ].map(s => (
          <div key={s.k} style={card}>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8, lineHeight: 1.35 }}>{s.k}</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: s.c, letterSpacing: "-0.01em" }}>{s.v}</div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{s.n}</div>
          </div>
        ))}
      </div>

      {/* Главная мысль */}
      <div style={{ ...card, borderLeft: "3px solid var(--ink)", marginBottom: 24, fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>
        <b style={{ color: "var(--ink)" }}>Главная мысль. </b>
        {d.thesis}
      </div>

      {/* Два показателя, два окна */}
      <SectionLabel>Два показателя · по полугодию и по году</SectionLabel>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14, maxWidth: "70ch", lineHeight: 1.5 }}>
        Клиенты — сколько людей вернулось за второй покупкой. Лоты — какой объём сделок приходится на этих
        вернувшихся (инвестор берёт по несколько лотов). Полосы во всех блоках в одном масштабе (0–{d.scale}%).
      </div>

      {d.windows.map(w => (
        <div key={w.key} style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", paddingBottom: 12, marginBottom: 14, borderBottom: "1px solid var(--border)" }}>
            {w.title} <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)" }}>— {w.note}</span>
          </div>
          <MetricBars label="Показатель 1 — повторные клиенты" rows={w.clients} scale={d.scale} />
          <div style={{ height: 1, background: "var(--border)", margin: "14px 0" }} />
          <MetricBars label="Показатель 2 — повторные лоты" rows={w.lots} scale={d.scale} />
        </div>
      ))}

      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "14px 18px", marginBottom: 24, fontSize: 13.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
        <b style={{ color: "var(--ink)" }}>Ключ: </b>{d.insight}
      </div>

      {/* Риски */}
      <SectionLabel>Пять рисков</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 24 }}>
        {d.risks.map(r => (
          <div key={r.tag} style={card}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.05em", color: yearColor(2026), marginBottom: 5 }}>{r.tag}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 5 }}>{r.title}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>{r.text}</div>
          </div>
        ))}
      </div>

      {/* Недобор */}
      <SectionLabel>Сколько денег недобираем</SectionLabel>
      <div style={{ background: "var(--warn-soft)", border: "1px solid var(--warn-border)", borderRadius: "var(--r-md)", padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: "var(--warn-ink)", marginBottom: 4 }}>{d.money.headline}</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.5 }}>{d.money.sub}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          {d.money.scenarios.map(s => (
            <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "13px 15px" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 5, lineHeight: 1.4 }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* План */}
      <SectionLabel>План действий</SectionLabel>
      <div style={{ display: "grid", gap: 10, marginBottom: 24 }}>
        {d.plan.map((p, i) => (
          <div key={p.title} style={{ ...card, display: "grid", gridTemplateColumns: "28px 1fr", gap: 14, alignItems: "start", padding: "14px 18px" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>
              {i + 1}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>
              <b style={{ color: "var(--ink)" }}>{p.title}</b>{" "}
              <span style={{ color: "var(--muted)" }}>{p.text}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Решение для собственника */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: "var(--r-md)", padding: "20px 24px" }}>
        <SectionLabel>Решение для собственника</SectionLabel>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--ink-2)" }}>{d.decision}</div>
      </div>

      <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, marginTop: 20 }}>{d.source}</div>
    </div>
  );
}
