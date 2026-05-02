import { NextRequest, NextResponse } from "next/server";

function isPublicRecruiterPath(pathname: string) {
  return (
    pathname.startsWith("/recruiter/invite") ||
    pathname === "/recruiter/admin" ||
    pathname.startsWith("/api/nata/recruiters/invite") ||
    pathname.startsWith("/api/nata/recruiters/accept-invite")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
    return NextResponse.redirect(new URL("/careers", request.url));
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
