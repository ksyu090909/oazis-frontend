import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

function sign(value: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(value);
  return `${value}.${hmac.digest("hex")}`;
}

function matches(input: string, expected: string | undefined): boolean {
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const { password } = await request.json();

  const secret = process.env.SESSION_SECRET;
  const adminPassword = process.env.DASHBOARD_PASSWORD;
  const contentPassword = process.env.CONTENT_PASSWORD;

  if (!secret || !adminPassword) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Полный доступ — главный пароль; только контент-раздел — контент-пароль.
  let role: "authenticated" | "content" | null = null;
  if (matches(password, adminPassword)) role = "authenticated";
  else if (matches(password, contentPassword)) role = "content";

  if (!role) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const sessionValue = sign(role, secret);
  const maxAge = 30 * 24 * 60 * 60;

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set("oazis_session", sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    maxAge,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
