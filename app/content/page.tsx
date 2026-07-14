"use client";
import React from "react";
import { ContentSprint } from "../content-sprint";

export default function ContentSprintPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/logo.svg" alt="Oazis Estate" style={{ width: 30, height: 30, filter: "invert(27%) sepia(51%) saturate(500%) hue-rotate(115deg) brightness(85%)" }} />
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Oazis Estate · Контент</div>
          </div>
          <a href="/api/auth/logout" style={{ fontSize: 12.5, color: "var(--muted)", textDecoration: "none", border: "1px solid var(--border-strong)", borderRadius: "var(--r-sm)", padding: "6px 12px" }}>Выйти</a>
        </div>
      </header>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 64px" }}>
        <ContentSprint />
      </main>
    </div>
  );
}
