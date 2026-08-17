export const ACCESS_COOKIE = "pf_access";

function getAccessKey(): string | undefined {
  return process.env.PASSFLOW_ACCESS_KEY;
}

export function isAccessKeyConfigured(): boolean {
  return Boolean(getAccessKey());
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAccessCookieValue(): Promise<string | null> {
  const secret = getAccessKey();
  if (!secret) return null;
  const issuedAt = String(Date.now());
  const signature = await hmacSha256Hex(secret, issuedAt);
  return `${issuedAt}.${signature}`;
}

export async function verifyAccessCookieValue(value: string | undefined): Promise<boolean> {
  const secret = getAccessKey();
  if (!secret) return true;
  if (!value) return false;

  const dot = value.lastIndexOf(".");
  if (dot === -1) return false;

  const issuedAt = value.slice(0, dot);
  const signature = value.slice(dot + 1);
  const expected = await hmacSha256Hex(secret, issuedAt);
  return timingSafeEqual(signature, expected);
}

export function verifyUnlockKey(key: string): boolean {
  const secret = getAccessKey();
  if (!secret) return true;
  return timingSafeEqual(key, secret);
}

export function accessCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
