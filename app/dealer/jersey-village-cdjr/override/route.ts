import { NextRequest, NextResponse } from "next/server";
import { setDealerAccessCookie } from "../../../../lib/dealerAccess";
export const dynamic = "force-dynamic";

const DEALER_SLUG = "jersey-village-cdjr";

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const providedKey = request.nextUrl.searchParams.get("key")?.trim() || "";
  const expectedKey = process.env.NATA_JV_OVERRIDE_KEY?.trim() || "";

  if (!expectedKey) {
    return NextResponse.json(
      { error: "Missing NATA_JV_OVERRIDE_KEY" },
      { status: 500 }
    );
  }

  if (!providedKey || providedKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const redirectUrl = `${appUrl()}/dealer/${DEALER_SLUG}/dashboard`;
  const response = NextResponse.redirect(redirectUrl, 302);

  return setDealerAccessCookie(response, DEALER_SLUG);
}
