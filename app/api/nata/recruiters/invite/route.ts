import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import {
  buildRecruiterInviteUrl,
  createInviteToken,
  sendRecruiterInvite,
} from "../../../../../lib/nataRecruiterInvites";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(value: string) {
  const role = value.toLowerCase();
  if (role === "admin") return "admin";
  if (role === "agent") return "agent";
  return "recruiter";
}

function permissionsForRole(role: string) {
  if (role === "admin") {
    return {
      can_assign: true,
      can_interview: true,
      can_approve: true,
      can_view_all: true,
      can_manage_team: true,
    };
  }

  if (role === "recruiter") {
    return {
      can_assign: false,
      can_interview: true,
      can_approve: true,
      can_view_all: false,
      can_manage_team: false,
    };
  }

  return {
    can_assign: false,
    can_interview: false,
    can_approve: false,
    can_view_all: false,
    can_manage_team: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const recruiterId = clean(formData.get("recruiterId"));
    const forceNewToken = clean(formData.get("forceNewToken")) === "true";

    if (!recruiterId) {
      return NextResponse.json({ error: "Missing recruiterId" }, { status: 400 });
    }

    const { data: recruiter, error: loadError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("*")
      .eq("id", recruiterId)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    if (!recruiter) {
      return NextResponse.json({ error: "Recruiter not found" }, { status: 404 });
    }

    const inviteToken =
      !forceNewToken && recruiter.invite_token
        ? recruiter.invite_token
        : createInviteToken();

    const inviteUrl = buildRecruiterInviteUrl(inviteToken);
    const role = normalizeRole(recruiter.role || "recruiter");

    const sendResult = await sendRecruiterInvite({
      recruiterId: recruiter.id,
      name: recruiter.name,
      email: recruiter.email,
      phone: recruiter.phone,
      role,
      title: recruiter.title,
      inviteToken,
    });

    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .update({
        role,
        permissions: recruiter.permissions || permissionsForRole(role),
        status: recruiter.status === "active" ? "active" : "invited",
        invite_token: inviteToken,
        invite_url: inviteUrl,
        invited_at: recruiter.invited_at || new Date().toISOString(),
        invite_sent_at: new Date().toISOString(),
        invite_email_status: sendResult.email.sent
          ? "sent"
          : sendResult.email.reason || "not_sent",
        invite_sms_status: sendResult.sms.sent
          ? "sent"
          : sendResult.sms.reason || "not_sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", recruiter.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL("/recruiter/admin", req.url));
  } catch (error) {
    console.error("POST /api/nata/recruiters/invite failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invite failed" },
      { status: 500 }
    );
  }
}
