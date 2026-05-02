import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function redirectToInvite(request: NextRequest, token: string, status: string) {
  const url = new URL(`/recruiter/invite/${token}`, request.url);
  url.searchParams.set("status", status);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = String(formData.get("token") || "").trim();

    if (!token) {
      return NextResponse.redirect(new URL("/recruiter/dashboard", request.url), { status: 303 });
    }

    const tokenHash = sha256(token);

    const { data: invite, error: inviteError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_invites")
      .select("id,recruiter_id,status,expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (inviteError) {
      console.error("Invite lookup failed:", inviteError);
      return redirectToInvite(request, token, "error");
    }

    if (!invite || invite.status !== "pending") {
      return redirectToInvite(request, token, "invalid");
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .schema("nata")
        .from("recruiter_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      return redirectToInvite(request, token, "expired");
    }

    const acceptedAt = new Date().toISOString();

    const { data: recruiter, error: recruiterError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .update({
        status: "active",
        is_active: true,
        activated_at: acceptedAt,
        updated_at: acceptedAt,
      })
      .eq("id", invite.recruiter_id)
      .select("slug")
      .single();

    if (recruiterError || !recruiter) {
      console.error("Recruiter activation failed:", recruiterError);
      return redirectToInvite(request, token, "error");
    }

    await supabaseAdmin
      .schema("nata")
      .from("recruiter_invites")
      .update({ status: "accepted", accepted_at: acceptedAt })
      .eq("id", invite.id);

    return NextResponse.redirect(new URL(`/recruiter/${recruiter.slug}/dashboard`, request.url), { status: 303 });
  } catch (error) {
    console.error("POST /api/nata/recruiters/accept-invite failed:", error);
    return NextResponse.redirect(new URL("/recruiter/dashboard", request.url), { status: 303 });
  }
}
