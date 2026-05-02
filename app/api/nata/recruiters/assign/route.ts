import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeBoolean(value: string) {
  return value === "true";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const recruiterId = clean(formData.get("recruiterId"));
    const name = clean(formData.get("name"));
    const slug = normalizeSlug(clean(formData.get("slug")) || name);
    const email = clean(formData.get("email")) || null;
    const phone = clean(formData.get("phone")) || null;
    const title = clean(formData.get("title")) || null;
    const role = clean(formData.get("role")) || "recruiter";
    const managerRecruiterId = clean(formData.get("managerRecruiterId")) || null;
    const notes = clean(formData.get("notes")) || null;
    const isActive = normalizeBoolean(clean(formData.get("isActive")) || "true");

    if (!name) {
      return NextResponse.json({ error: "Recruiter name is required" }, { status: 400 });
    }

    if (!slug) {
      return NextResponse.json({ error: "Recruiter slug is required" }, { status: 400 });
    }

    if (![
      "admin",
      "recruiter",
      "agent",
      "system",
    ].includes(role)) {
      return NextResponse.json({ error: "Invalid recruiter role" }, { status: 400 });
    }

    const payload = {
      name,
      slug,
      email,
      phone,
      title,
      role,
      manager_recruiter_id: managerRecruiterId,
      notes,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    const query = recruiterId
      ? supabaseAdmin
          .schema("nata")
          .from("recruiters")
          .update(payload)
          .eq("id", recruiterId)
      : supabaseAdmin
          .schema("nata")
          .from("recruiters")
          .insert(payload);

    const { error } = await query;

    if (error) {
      console.error("Recruiter upsert failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL("/recruiter/admin", req.url), 303);
  } catch (error) {
    console.error("POST /api/nata/recruiters/upsert failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recruiter save failed" },
      { status: 500 }
    );
  }
}
