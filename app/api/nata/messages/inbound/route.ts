import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRecord = Record<string, any>;

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function emailAddressOnly(value: string | undefined | null) {
  if (!value) return "";
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim().toLowerCase();
}

function localPart(email: string) {
  return email.split("@")[0]?.toLowerCase() || "";
}

async function findRecruiterForInbound(toEmail: string) {
  const alias = emailAddressOnly(toEmail);
  const slug = localPart(alias);

  const { data: byAlias } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("email_alias", alias)
    .maybeSingle();

  if (byAlias) return byAlias as AnyRecord;

  const { data: bySlug } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return (bySlug || null) as AnyRecord | null;
}

async function findApplicationForInbound(fromEmail: string, recruiterId?: string | null) {
  let query = supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .ilike("email", fromEmail);

  if (recruiterId) {
    query = query.eq("recruiter_id", recruiterId);
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(1);
  return data?.[0] || null;
}

async function ensureThread(input: {
  recruiterId?: string | null;
  applicationId?: string | null;
  candidateEmail?: string | null;
  subject?: string | null;
}) {
  if (input.applicationId) {
    const { data: existing } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("application_id", input.applicationId)
      .maybeSingle();

    if (existing?.id) return String(existing.id);
  }

  if (input.recruiterId && input.candidateEmail) {
    const { data: existing } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("recruiter_id", input.recruiterId)
      .eq("candidate_email", input.candidateEmail)
      .maybeSingle();

    if (existing?.id) return String(existing.id);
  }

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("message_threads")
    .insert({
      recruiter_id: input.recruiterId || null,
      application_id: input.applicationId || null,
      candidate_email: input.candidateEmail || null,
      subject: input.subject || null,
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create inbound message thread:", error);
    return null;
  }

  return String(data.id);
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  let payload: AnyRecord = {};

  if (contentType.includes("application/json")) {
    payload = await request.json();
  } else {
    const formData = await request.formData();
    payload = Object.fromEntries(formData.entries());
  }

  const raw = payload.data && typeof payload.data === "object" ? payload.data : payload;

  const fromEmail = emailAddressOnly(
    firstString(raw.from, raw.from_email, raw.sender, raw.headers?.from)
  );
  const toEmail = emailAddressOnly(
    firstString(raw.to, raw.to_email, raw.recipient, raw.headers?.to)
  );
  const subject = firstString(raw.subject, raw.headers?.subject, "Inbound message");
  const text = firstString(raw.text, raw.text_body, raw.plain, raw.body_text);
  const html = firstString(raw.html, raw.html_body, raw.body_html);
  const providerMessageId = firstString(raw.id, raw.message_id, raw.email_id);

  const recruiter = await findRecruiterForInbound(toEmail);
  const application = await findApplicationForInbound(fromEmail, recruiter?.id || null);
  const threadId = await ensureThread({
    recruiterId: recruiter?.id || null,
    applicationId: application?.id || null,
    candidateEmail: fromEmail || null,
    subject,
  });

  const { error } = await supabaseAdmin.schema("nata").from("messages").insert({
    thread_id: threadId,
    recruiter_id: recruiter?.id || null,
    application_id: application?.id || null,
    direction: "inbound",
    channel: "email",
    status: "received",
    subject,
    body_text: text || null,
    body_html: html || null,
    from_email: fromEmail || null,
    to_email: toEmail || null,
    provider: "inbound-webhook",
    provider_message_id: providerMessageId || null,
    provider_payload: payload || {},
    received_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Failed to store inbound message:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (threadId) {
    await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);
  }

  return NextResponse.json({ ok: true });
}
