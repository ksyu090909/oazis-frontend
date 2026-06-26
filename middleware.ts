import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function verify(value: string, secret: string): Promise<boolean> {
  const parts = value.split(".");
  if (parts.length !== 2) return false;
  const [payload, signature] = parts;
  if (payload !== "authenticated") return false;

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
    return await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(payload)
    );
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("oazis_session")?.value;
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    console.error("[auth] SESSION_SECRET is not set");
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!session || !(await verify(session, secret))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
