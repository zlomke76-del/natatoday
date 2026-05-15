import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { hashPassword, setRecruiterSessionCookies } from "../../../../../lib/recruiterAuth";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function redirectToReset(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/recruiter/password-reset", request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url, { status: 303 });
}

function secretMatches(submitted: string) {
  const expected = process.env.NATA_ADMIN_RESET_SECRET || process.env.NATA_ADMIN_SECRET || "";
  return Boolean(expected && submitted && submitted === expected);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const adminSecret = clean(formData.get("admin_secret"));
    const identifier = clean(formData.get("identifier")).toLowerCase();
    const password = clean(formData.get("password"));
    const confirmPassword = clean(formData.get("confirm_password"));
    const signInAfterReset = formData.get("sign_in_after_reset") === "on";

    if (!secretMatches(adminSecret)) {
      return redirectToReset(request, { error: "unauthorized" });
    }

    if (!identifier || !password || password.length < 10) {
      return redirectToReset(request, { error: "weak" });
    }

    if (password !== confirmPassword) {
      return redirectToReset(request, { error: "mismatch" });
    }

    const { data: recruiter, error: findError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("id,name,slug,email,role,status,is_active")
      .or(`email.eq.${identifier},slug.eq.${identifier}`)
      .maybeSingle();

    if (findError || !recruiter) {
      return redirectToReset(request, { error: "not_found" });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .update({
        password_hash: hashPassword(password),
        password_updated_at: now,
        status: "active",
        is_active: true,
        activated_at: now,
        updated_at: now,
      })
      .eq("id", recruiter.id);

    if (updateError) {
      console.error("Password reset failed", updateError);
      return redirectToReset(request, { error: "server" });
    }

    if (signInAfterReset) {
      const response = NextResponse.redirect(new URL(`/recruiter/${recruiter.slug}/dashboard`, request.url), { status: 303 });
      setRecruiterSessionCookies(response, recruiter);
      return response;
    }

    return redirectToReset(request, { status: "updated", recruiter: recruiter.slug });
  } catch (error) {
    console.error("POST /api/nata/recruiters/password-reset failed", error);
    return redirectToReset(request, { error: "server" });
  }
}
