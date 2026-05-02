import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendRecruiterInvite } from "../../../../../lib/nataRecruiterInvites";

type RecruiterRole = "admin" | "recruiter" | "agent";

type PermissionSet = {
  can_assign: boolean;
  can_interview: boolean;
  can_approve: boolean;
  can_view_all: boolean;
  can_manage_team: boolean;
};

function clean(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRole(value: string): RecruiterRole {
  if (value === "admin") return "admin";
  if (value === "agent") return "agent";
  return "recruiter";
}

function permissionDefaults(role: RecruiterRole): PermissionSet {
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

function boolFromForm(formData: FormData, key: keyof PermissionSet) {
  return formData.get(key) === "on";
}

function buildPermissions(formData: FormData, role: RecruiterRole): PermissionSet {
  const base = permissionDefaults(role);

  return {
    can_assign: boolFromForm(formData, "can_assign") || base.can_assign,
    can_interview: boolFromForm(formData, "can_interview") || base.can_interview,
    can_approve: boolFromForm(formData, "can_approve") || base.can_approve,
    can_view_all: boolFromForm(formData, "can_view_all") || base.can_view_all,
    can_manage_team: role === "admin" ? true : false,
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createToken() {
  return randomBytes(32).toString("base64url");
}

function redirectToAdmin(request: NextRequest, params?: Record<string, string>) {
  const url = new URL("/recruiter/admin", request.url);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const name = clean(formData.get("name"));
    const rawSlug = clean(formData.get("slug"));
    const slug = slugify(rawSlug || name);
    const email = clean(formData.get("email")).toLowerCase();
    const phone = clean(formData.get("phone"));
    const title = clean(formData.get("title"));
    const profilePhotoUrl = clean(formData.get("profile_photo_url"));
    const role = normalizeRole(clean(formData.get("role"), "recruiter"));
    const managerRecruiterId = clean(formData.get("manager_recruiter_id")) || null;
    const notes = clean(formData.get("notes"));
    const permissions = buildPermissions(formData, role);

    if (!name || !slug || !email) {
      return redirectToAdmin(request, { invite: "missing_required" });
    }

    const { data: existingActive, error: existingActiveError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("id,status,email")
      .or(`slug.eq.${slug},email.eq.${email}`)
      .eq("status", "active")
      .maybeSingle();

    if (existingActiveError) {
      console.error("Active recruiter check failed:", existingActiveError);
      return redirectToAdmin(request, { invite: "error" });
    }

    if (existingActive) {
      return redirectToAdmin(request, { invite: "already_active" });
    }

    const now = new Date().toISOString();

    const { data: recruiter, error: upsertError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .upsert(
        {
          name,
          slug,
          email,
          phone: phone || null,
          title: title || null,
          profile_photo_url: profilePhotoUrl || null,
          role,
          manager_recruiter_id: managerRecruiterId,
          notes: notes || null,
          permissions,
          status: "invited",
          is_active: false,
          invited_at: now,
          updated_at: now,
        },
        { onConflict: "slug" }
      )
      .select("*")
      .single();

    if (upsertError || !recruiter) {
      console.error("Recruiter invite upsert failed:", upsertError);
      return redirectToAdmin(request, { invite: "error" });
    }

    const token = createToken();
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .schema("nata")
      .from("recruiter_invites")
      .update({ status: "revoked", revoked_at: now, updated_at: now })
      .eq("recruiter_id", recruiter.id)
      .eq("status", "pending");

    const { error: inviteError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_invites")
      .insert({
        recruiter_id: recruiter.id,
        token_hash: tokenHash,
        status: "pending",
        expires_at: expiresAt,
        sent_to_email: email,
        sent_to_phone: phone || null,
      });

    if (inviteError) {
      console.error("Recruiter invite insert failed:", inviteError);
      return redirectToAdmin(request, { invite: "error" });
    }

    const inviteUrl = `${(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "")}/recruiter/invite/${token}`;

    const delivery = await sendRecruiterInvite({
      recruiterName: name,
      recruiterEmail: email,
      recruiterPhone: phone || null,
      role,
      inviteUrl,
    });

    console.log("Recruiter invite delivery:", delivery);

    return redirectToAdmin(request, { invite: "sent" });
  } catch (error) {
    console.error("POST /api/nata/recruiters/invite failed:", error);
    return redirectToAdmin(request, { invite: "error" });
  }
}
