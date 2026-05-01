import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "nata_dealer_access";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type DealerAccessPayload = {
  dealerSlug: string;
  issuedAt: number;
  expiresAt: number;
};

function getSecret() {
  const secret =
    process.env.DEALER_ACCESS_SECRET ||
    process.env.NATA_ADMIN_KEY ||
    process.env.STRIPE_WEBHOOK_SECRET ||
    "";

  if (!secret) {
    throw new Error("Missing DEALER_ACCESS_SECRET or fallback signing secret.");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createDealerAccessToken(dealerSlug: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload: DealerAccessPayload = {
    dealerSlug,
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyDealerAccessToken(token: string | undefined, dealerSlug: string) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload);

  if (!safeCompare(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as DealerAccessPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.dealerSlug !== dealerSlug) {
      return false;
    }

    if (!payload.expiresAt || payload.expiresAt < now) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function hasDealerAccess(dealerSlug: string) {
  const token = cookies().get(COOKIE_NAME)?.value;
  return verifyDealerAccessToken(token, dealerSlug);
}

export function setDealerAccessCookie(response: NextResponse, dealerSlug: string) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: createDealerAccessToken(dealerSlug),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TOKEN_TTL_SECONDS,
  });

  return response;
}

export function clearDealerAccessCookie(response: NextResponse) {
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
