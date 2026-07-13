import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Проверяет подпись cookie и возвращает роль ("authenticated" | "content") или null.
async function verifyRole(value: string | undefined, secret: string): Promise<string | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (payload !== "authenticated" && payload !== "content") return null;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = hexToBytes(signature);
    const ok = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(payload)
    );
    return ok ? payload : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|txt|xml|json|woff2?|ttf|otf|css|js|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error("[auth] SESSION_SECRET is not set");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = await verifyRole(request.cookies.get("oazis_session")?.value, secret);
  if (!role) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Контент-роль видит только раздел /content — всё остальное недоступно.
  const isContentArea = pathname === "/content" || pathname.startsWith("/content/");
  if (role === "content" && !isContentArea) {
    return NextResponse.redirect(new URL("/content", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
