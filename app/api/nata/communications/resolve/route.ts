import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function clean(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function redirectToDashboard(request: NextRequest, recruiterSlug: string) {
  const slug = recruiterSlug || "don";
  const url = new URL(`/recruiter/${slug}/dashboard`, request.url);
  url.hash = "communications";
  return NextResponse.redirect(url, { status: 303 });
}

function normalizeStatus(value: string) {
  const normalized = value.trim().toLowerCase();
  if (["resolved", "ignored", "closed", "archived"].includes(normalized)) {
    return normalized;
  }
  return "resolved";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const messageId = clean(formData.get("message_id"));
  const recruiterId = clean(formData.get("recruiter_id"));
  const recruiterSlug = clean(formData.get("recruiter_slug"));
  const status = normalizeStatus(clean(formData.get("status")));

  if (!messageId || !recruiterId) {
    return redirectToDashboard(request, recruiterSlug);
  }

  const now = new Date().toISOString();

  const richUpdate = await supabaseAdmin
    .schema("nata")
    .from("messages")
    .update({
      status,
      message_status: status,
      resolved_at: status === "resolved" ? now : null,
      updated_at: now,
    })
    .eq("id", messageId)
    .eq("recruiter_id", recruiterId);

  if (richUpdate.error) {
    const fallbackUpdate = await supabaseAdmin
      .schema("nata")
      .from("messages")
      .update({ status })
      .eq("id", messageId)
      .eq("recruiter_id", recruiterId);

    if (fallbackUpdate.error) {
      console.error("POST /api/nata/communications/resolve failed:", fallbackUpdate.error);
    }
  }

  return redirectToDashboard(request, recruiterSlug);
}
