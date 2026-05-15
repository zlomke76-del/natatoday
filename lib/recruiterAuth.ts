import crypto from "crypto";
import { NextResponse } from "next/server";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export type RecruiterSessionInput = {
  id: string;
  slug: string;
  role?: string | null;
};

function timingSafeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto
    .scryptSync(password, salt, KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    })
    .toString("base64url");

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash?: string | null) {
  if (!password || !storedHash) return false;

  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, rawN, rawR, rawP, salt, expectedHash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const actualHash = crypto
    .scryptSync(password, salt, KEY_LENGTH, { N, r, p })
    .toString("base64url");

  return timingSafeEqual(actualHash, expectedHash);
}

export function setRecruiterSessionCookies(response: NextResponse, recruiter: RecruiterSessionInput) {
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set("nata_recruiter_id", recruiter.id, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  response.cookies.set("nata_recruiter_slug", recruiter.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });

  response.cookies.set("nata_recruiter_role", recruiter.role || "recruiter", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function clearRecruiterSessionCookies(response: NextResponse) {
  for (const name of ["nata_recruiter_id", "nata_recruiter_slug", "nata_recruiter_role"]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
}
