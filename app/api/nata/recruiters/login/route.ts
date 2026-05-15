import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { setRecruiterSessionCookies, verifyPassword } from "../../../../../lib/recruiterAuth";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNextPath(value: string, fallback: string) {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  return value;
}

function redirectToLogin(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/recruiter/login", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const identifier = clean(formData.get("identifier")).toLowerCase();
    const password = clean(formData.get("password"));
    const next = safeNextPath(clean(formData.get("next")), "/recruiter/dashboard");

    if (!identifier || !password) {
      return redirectToLogin(request, { error: "missing", next });
    }

    const { data: recruiter, error } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("id,name,slug,email,role,status,is_active,password_hash")
      .or(`email.eq.${identifier},slug.eq.${identifier}`)
      .maybeSingle();

    if (error || !recruiter || recruiter.status !== "active" || recruiter.is_active === false) {
      return redirectToLogin(request, { error: "invalid", next });
    }

    if (!verifyPassword(password, recruiter.password_hash)) {
      return redirectToLogin(request, { error: "invalid", next });
    }

    await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", recruiter.id);

    const destination = next === "/recruiter/dashboard" ? `/recruiter/${recruiter.slug}/dashboard` : next;
    const response = NextResponse.redirect(new URL(destination, request.url), { status: 303 });
    setRecruiterSessionCookies(response, recruiter);
    return response;
  } catch (error) {
    console.error("POST /api/nata/recruiters/login failed", error);
    return redirectToLogin(request, { error: "server" });
  }
}
