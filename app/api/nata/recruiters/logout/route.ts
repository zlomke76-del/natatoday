import { NextRequest, NextResponse } from "next/server";
import { clearRecruiterSessionCookies } from "../../../../../lib/recruiterAuth";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/recruiter/login?status=logged_out", request.url), { status: 303 });
  clearRecruiterSessionCookies(response);
  return response;
}
