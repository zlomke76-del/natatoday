import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AnyRecord = Record<string, any>;

const ATTACHMENT_BUCKET =
  process.env.NATA_MESSAGE_ATTACHMENT_BUCKET || "nata-message-attachments";

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();

    if (Array.isArray(value)) {
      for (const item of value) {
        const nested = firstString(item);
        if (nested) return nested;
      }
    }

    if (value && typeof value === "object") {
      const record = value as AnyRecord;
      const nested = firstString(
        record.email,
        record.address,
        record.value,
        record.text,
        record.name
      );
      if (nested) return nested;
    }
  }

  return "";
}

function emailAddressOnly(value: string | undefined | null) {
  if (!value) return "";

  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim().toLowerCase().replace(/^mailto:/, "");
}

function normalizedEmail(value: string | undefined | null) {
  const email = emailAddressOnly(value);
  if (!email.includes("@")) return email;

  const [local, domain] = email.split("@");
  if (!local || !domain) return email;

  return `${local.replace(/\+.*/, "")}@${domain}`;
}

function localPart(email: string) {
  return email.split("@")[0]?.toLowerCase() || "";
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^\w.\-() ]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 120) || "attachment"
  );
}

function extractAttachments(raw: AnyRecord): AnyRecord[] {
  const possible = [
    raw.attachments,
    raw.attachment,
    raw.files,
    raw.data?.attachments,
    raw.email?.attachments,
  ];

  for (const value of possible) {
    if (Array.isArray(value)) return value as AnyRecord[];
  }

  return [];
}

function attachmentFileName(attachment: AnyRecord, index: number) {
  return firstString(
    attachment.filename,
    attachment.file_name,
    attachment.name,
    attachment.content_disposition?.filename,
    `attachment-${index + 1}`
  );
}

function attachmentContentType(attachment: AnyRecord) {
  return firstString(
    attachment.content_type,
    attachment.contentType,
    attachment.mime_type,
    attachment.mimeType,
    attachment.type,
    "application/octet-stream"
  ).toLowerCase();
}

function attachmentSize(attachment: AnyRecord) {
  const value =
    attachment.size ||
    attachment.file_size ||
    attachment.size_bytes ||
    attachment.length;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function attachmentProviderId(attachment: AnyRecord) {
  return firstString(
    attachment.id,
    attachment.attachment_id,
    attachment.attachmentId,
    attachment.content_id,
    attachment.contentId
  );
}

function attachmentBase64Content(attachment: AnyRecord) {
  const content = firstString(
    attachment.content,
    attachment.data,
    attachment.body,
    attachment.base64,
    attachment.content_base64
  );

  if (!content) return "";

  const commaIndex = content.indexOf(",");
  if (content.startsWith("data:") && commaIndex >= 0) {
    return content.slice(commaIndex + 1);
  }

  return content;
}

async function findRecruiterForInbound(toEmail: string) {
  const alias = normalizedEmail(toEmail);
  const slug = localPart(alias);

  if (!alias) return null;

  const { data: byAlias, error: aliasError } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("email_alias", alias)
    .maybeSingle();

  if (aliasError) console.error("Inbound recruiter alias lookup failed:", aliasError);
  if (byAlias) return byAlias as AnyRecord;

  const { data: bySlug, error: slugError } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (slugError) console.error("Inbound recruiter slug lookup failed:", slugError);

  return (bySlug || null) as AnyRecord | null;
}

async function findApplicationForInbound(fromEmail: string, recruiterId?: string | null) {
  if (!fromEmail) return null;

  let query = supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .ilike("email", fromEmail);

  if (recruiterId) query = query.eq("recruiter_id", recruiterId);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Inbound application lookup failed:", error);
    return null;
  }

  return data?.[0] || null;
}

async function findExistingMessage(providerMessageId: string) {
  if (!providerMessageId) return null;

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("messages")
    .select("id")
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (error) {
    console.error("Inbound dedupe lookup failed:", error);
    return null;
  }

  return data;
}

async function ensureThread(input: {
  recruiterId: string;
  applicationId?: string | null;
  candidateEmail?: string | null;
  subject?: string | null;
}) {
  if (input.applicationId) {
    const { data: existing, error } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("recruiter_id", input.recruiterId)
      .eq("application_id", input.applicationId)
      .maybeSingle();

    if (error) console.error("Inbound application thread lookup failed:", error);
    if (existing?.id) return String(existing.id);
  }

  if (input.candidateEmail) {
    const { data: existing, error } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("recruiter_id", input.recruiterId)
      .eq("candidate_email", input.candidateEmail)
      .maybeSingle();

    if (error) console.error("Inbound candidate thread lookup failed:", error);
    if (existing?.id) return String(existing.id);
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("message_threads")
    .insert({
      recruiter_id: input.recruiterId,
      application_id: input.applicationId || null,
      candidate_email: input.candidateEmail || null,
      subject: input.subject || "Inbound message",
      status: "open",
      last_message_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create inbound message thread:", error);
    return null;
  }

  return String(data.id);
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return ((await request.json().catch(() => ({}))) || {}) as AnyRecord;
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries()) as AnyRecord;
}

async function storeInboundAttachments(input: {
  attachments: AnyRecord[];
  messageId: string;
  threadId: string;
  recruiterId: string;
  applicationId?: string | null;
}) {
  const saved: string[] = [];
  const skipped: string[] = [];

  for (let index = 0; index < input.attachments.length; index++) {
    const attachment = input.attachments[index];
    const fileName = safeFileName(attachmentFileName(attachment, index));
    const fileType = attachmentContentType(attachment);
    const fileSize = attachmentSize(attachment);
    const providerAttachmentId = attachmentProviderId(attachment);

    if (!ALLOWED_ATTACHMENT_TYPES.has(fileType)) {
      skipped.push(`${fileName}: unsupported type ${fileType}`);
      continue;
    }

    if (fileSize && fileSize > MAX_ATTACHMENT_BYTES) {
      skipped.push(`${fileName}: exceeds size limit`);
      continue;
    }

    const base64 = attachmentBase64Content(attachment);

    if (!base64) {
      skipped.push(`${fileName}: no file content in webhook payload`);
      continue;
    }

    let buffer: Buffer;

    try {
      buffer = Buffer.from(base64, "base64");
    } catch {
      skipped.push(`${fileName}: invalid base64 content`);
      continue;
    }

    if (!buffer.length) {
      skipped.push(`${fileName}: empty file`);
      continue;
    }

    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      skipped.push(`${fileName}: exceeds size limit`);
      continue;
    }

    const storagePath = `inbound/${input.threadId}/${input.messageId}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload inbound attachment:", uploadError);
      skipped.push(`${fileName}: upload failed`);
      continue;
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("message_attachments")
      .insert({
        message_id: input.messageId,
        thread_id: input.threadId,
        recruiter_id: input.recruiterId,
        application_id: input.applicationId || null,
        file_name: fileName,
        file_type: fileType,
        file_size: buffer.length,
        storage_bucket: ATTACHMENT_BUCKET,
        storage_path: storagePath,
        direction: "inbound",
        provider: "inbound-webhook",
        provider_attachment_id: providerAttachmentId || null,
        provider_payload: attachment || {},
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to store inbound attachment record:", insertError);
      skipped.push(`${fileName}: metadata insert failed`);
      continue;
    }

    saved.push(String(inserted.id));
  }

  return { saved, skipped };
}

export async function POST(request: NextRequest) {
  const payload = await parsePayload(request);
  const raw =
    payload.data && typeof payload.data === "object"
      ? (payload.data as AnyRecord)
      : payload;

  const fromEmail = normalizedEmail(
    firstString(raw.from, raw.from_email, raw.sender, raw.headers?.from)
  );

  const toEmail = normalizedEmail(
    firstString(raw.to, raw.to_email, raw.recipient, raw.headers?.to)
  );

  const subject = firstString(raw.subject, raw.headers?.subject, "Inbound message");

  const text = firstString(raw.text, raw.text_body, raw.plain, raw.body_text);
  const html = firstString(raw.html, raw.html_body, raw.body_html);

  const providerMessageId = firstString(
    raw.id,
    raw.message_id,
    raw.email_id,
    raw.headers?.["message-id"],
    raw.headers?.messageId
  );

  if (!fromEmail || !toEmail) {
    return NextResponse.json(
      { ok: false, error: "Inbound message missing from_email or to_email." },
      { status: 400 }
    );
  }

  const recruiter = await findRecruiterForInbound(toEmail);

  if (!recruiter?.id) {
    console.warn("Inbound message rejected. No recruiter matched:", {
      toEmail,
      fromEmail,
      subject,
    });

    return NextResponse.json(
      { ok: false, error: "No recruiter matched inbound recipient." },
      { status: 400 }
    );
  }

  if (providerMessageId) {
    const existing = await findExistingMessage(providerMessageId);

    if (existing?.id) {
      return NextResponse.json({
        ok: true,
        deduped: true,
        messageId: existing.id,
      });
    }
  }

  const application = await findApplicationForInbound(fromEmail, recruiter.id);

  const threadId = await ensureThread({
    recruiterId: recruiter.id,
    applicationId: application?.id || null,
    candidateEmail: fromEmail,
    subject,
  });

  if (!threadId) {
    return NextResponse.json(
      { ok: false, error: "Unable to create or resolve message thread." },
      { status: 500 }
    );
  }

  const now = new Date().toISOString();

  const { data: message, error } = await supabaseAdmin
    .schema("nata")
    .from("messages")
    .insert({
      thread_id: threadId,
      recruiter_id: recruiter.id,
      application_id: application?.id || null,
      direction: "inbound",
      channel: "email",
      status: "received",
      subject,
      body_text: text || null,
      body_html: html || null,
      from_email: fromEmail,
      to_email: toEmail,
      provider: "inbound-webhook",
      provider_message_id: providerMessageId || null,
      provider_payload: payload || {},
      received_at: now,
      created_at: now,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to store inbound message:", error);

    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  await supabaseAdmin
    .schema("nata")
    .from("message_threads")
    .update({
      last_message_at: now,
      updated_at: now,
    })
    .eq("id", threadId);

  const attachments = extractAttachments(raw);

  const attachmentResult = await storeInboundAttachments({
    attachments,
    messageId: String(message.id),
    threadId,
    recruiterId: recruiter.id,
    applicationId: application?.id || null,
  });

  return NextResponse.json({
    ok: true,
    messageId: message?.id || null,
    threadId,
    attachmentsSaved: attachmentResult.saved.length,
    attachmentsSkipped: attachmentResult.skipped,
  });
}
