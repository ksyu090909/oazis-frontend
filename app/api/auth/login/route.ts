import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

function sign(value: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(value);
  return `${value}.${hmac.digest("hex")}`;
}

export async function POST(request: Request) {
  const { password } = await request.json();

  const correctPassword = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_SECRET;

  if (!correctPassword || !secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const a = Buffer.from(password);
  const b = Buffer.from(correctPassword);
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const sessionValue = sign("authenticated", secret);
  const maxAge = 30 * 24 * 60 * 60;

  const response = NextResponse.json({ ok: true });
  response.cookies.set("oazis_session", sessionValue, {
    httpOnly: true,
    sameSite: "lax",
    maxAge,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
