import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeRole(value: string) {
  const role = value.toLowerCase();

  if (role === "admin") return "admin";
  if (role === "agent") return "agent";
  if (role === "system") return "system";
  return "recruiter";
}

function normalizeStatus(value: string) {
  const status = value.toLowerCase();

  if (status === "active") return "active";
  if (status === "suspended") return "suspended";
  if (status === "inactive") return "inactive";
  return "invited";
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on";
}

function defaultPermissions(role: string) {
  if (role === "admin" || role === "system") {
    return {
      can_assign: true,
      can_interview: true,
      can_approve: true,
      can_view_all: true,
    };
  }

  if (role === "recruiter") {
    return {
      can_assign: false,
      can_interview: true,
      can_approve: true,
      can_view_all: false,
    };
  }

  return {
    can_assign: false,
    can_interview: false,
    can_approve: false,
    can_view_all: false,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const id = clean(formData.get("id"));
    const name = clean(formData.get("name"));
    const rawSlug = clean(formData.get("slug"));
    const email = clean(formData.get("email"));
    const phone = clean(formData.get("phone"));
    const title = clean(formData.get("title"));
    const role = normalizeRole(clean(formData.get("role")) || "recruiter");
    const status = normalizeStatus(clean(formData.get("status")) || "invited");
    const managerRecruiterId = clean(formData.get("manager_recruiter_id"));
    const notes = clean(formData.get("notes"));
    const slug = slugify(rawSlug || name);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const basePermissions = defaultPermissions(role);
    const permissions = {
      can_view_all: checked(formData, "can_view_all") || basePermissions.can_view_all,
      can_assign: checked(formData, "can_assign") || basePermissions.can_assign,
      can_approve: checked(formData, "can_approve") || basePermissions.can_approve,
      can_interview: checked(formData, "can_interview") || basePermissions.can_interview,
    };

    const isActive = status === "active";
    const now = new Date().toISOString();

    const payload = {
      name,
      slug,
      email: email || null,
      phone: phone || null,
      title: title || null,
      role,
      status,
      is_active: isActive,
      manager_recruiter_id: managerRecruiterId || null,
      notes: notes || null,
      permissions,
      invited_at: status === "invited" ? now : null,
      activated_at: status === "active" ? now : null,
      updated_at: now,
    };

    const query = supabaseAdmin.schema("nata").from("recruiters");

    const { error } = id
      ? await query.update(payload).eq("id", id)
      : await query.upsert(payload, { onConflict: "slug" });

    if (error) {
      console.error("Recruiter upsert failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL("/recruiter/admin", request.url), 303);
  } catch (error) {
    console.error("POST /api/nata/recruiters/upsert failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Recruiter onboarding failed",
      },
      { status: 500 }
    );
  }
}
