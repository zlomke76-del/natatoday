import { NextRequest, NextResponse } from "next/server";

function isPublicRecruiterPath(pathname: string) {
  return (
    pathname === "/recruiter/login" ||
    pathname === "/recruiter/password-reset" ||
    pathname.startsWith("/recruiter/invite") ||
    pathname === "/recruiter/admin" ||
    pathname.startsWith("/api/nata/recruiters/login") ||
    pathname.startsWith("/api/nata/recruiters/logout") ||
    pathname.startsWith("/api/nata/recruiters/password-reset") ||
    pathname.startsWith("/api/nata/recruiters/invite") ||
    pathname.startsWith("/api/nata/recruiters/accept-invite")
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/recruiter")) {
    return NextResponse.next();
  }

  if (isPublicRecruiterPath(pathname)) {
    return NextResponse.next();
  }

  const recruiterId = request.cookies.get("nata_recruiter_id")?.value;
  const recruiterSlug = request.cookies.get("nata_recruiter_slug")?.value;
  const recruiterRole = request.cookies.get("nata_recruiter_role")?.value;

  if (!recruiterId || !recruiterSlug) {
    const loginUrl = new URL("/recruiter/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    loginUrl.searchParams.set("reason", "session_required");
    return NextResponse.redirect(loginUrl);
  }

  const routeSlug = pathname.split("/")[2];

  if (routeSlug && routeSlug !== recruiterSlug && recruiterRole !== "admin") {
    return NextResponse.redirect(
      new URL(`/recruiter/${recruiterSlug}/dashboard`, request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/recruiter/:path*"],
};
