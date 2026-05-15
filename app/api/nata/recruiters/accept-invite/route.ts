import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashPassword, setRecruiterSessionCookies } from "@/lib/recruiterAuth";

function hashInviteToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const token = String(formData.get("token") || "").trim();
    const password = String(formData.get("password") || "").trim();
    const confirmPassword = String(formData.get("confirm_password") || "").trim();

    if (!token) {
      return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
    }

    if (!password || password.length < 10 || password !== confirmPassword) {
      return NextResponse.json(
        { error: "Password must be at least 10 characters and both fields must match" },
        { status: 400 }
      );
    }

    const tokenHash = hashInviteToken(token);
    const now = new Date().toISOString();

    const { data: invite, error: inviteError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_invites")
      .select(
        `
        id,
        recruiter_id,
        token_hash,
        status,
        expires_at,
        accepted_at,
        recruiters (
          id,
          name,
          slug,
          role,
          status,
          activated_at
        )
      `
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const recruiter = Array.isArray(invite?.recruiters)
      ? invite?.recruiters[0]
      : invite?.recruiters;

    if (inviteError || !invite || !recruiter) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .schema("nata")
        .from("recruiter_invites")
        .update({ status: "expired", updated_at: now })
        .eq("id", invite.id);

      return NextResponse.json({ error: "Invite expired" }, { status: 400 });
    }

    if (invite.status !== "pending" && invite.status !== "accepted") {
      return NextResponse.json({ error: "Invite is no longer valid" }, { status: 400 });
    }

    const { error: recruiterError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .update({
        status: "active",
        is_active: true,
        activated_at: recruiter.activated_at || now,
        password_hash: hashPassword(password),
        password_updated_at: now,
        updated_at: now,
      })
      .eq("id", invite.recruiter_id);

    if (recruiterError) {
      return NextResponse.json(
        { error: "Failed to activate recruiter" },
        { status: 500 }
      );
    }

    const { error: acceptError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_invites")
      .update({
        status: "accepted",
        accepted_at: invite.accepted_at || now,
        updated_at: now,
      })
      .eq("id", invite.id);

    if (acceptError) {
      return NextResponse.json(
        { error: "Failed to mark invite accepted" },
        { status: 500 }
      );
    }

    const redirectUrl = new URL(`/recruiter/${recruiter.slug}/dashboard`, request.url);
    const response = NextResponse.redirect(redirectUrl, { status: 303 });

    setRecruiterSessionCookies(response, recruiter);

    return response;
  } catch (error) {
    console.error("POST /api/nata/recruiters/accept-invite failed", error);

    return NextResponse.json(
      { error: "Invite acceptance failed" },
      { status: 500 }
    );
  }
}
