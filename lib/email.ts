import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
  recruiterId?: string | null;
  applicationId?: string | null;
  dealerId?: string | null;
  threadId?: string | null;
  status?: "queued" | "sent" | "failed";
};

function normalizeRecipient(value: string | string[]) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function emailAddressOnly(value: string | undefined | null) {
  if (!value) return "";
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

async function ensureThread(input: {
  threadId?: string | null;
  recruiterId?: string | null;
  applicationId?: string | null;
  candidateEmail?: string | null;
  dealerId?: string | null;
  subject?: string | null;
}) {
  if (input.threadId) return input.threadId;

  const candidateEmail = input.candidateEmail || null;

  if (input.applicationId) {
    const { data: existing } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("application_id", input.applicationId)
      .maybeSingle();

    if (existing?.id) return String(existing.id);
  }

  if (input.recruiterId && candidateEmail) {
    const { data: existing } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("recruiter_id", input.recruiterId)
      .eq("candidate_email", candidateEmail)
      .maybeSingle();

    if (existing?.id) return String(existing.id);
  }

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("message_threads")
    .insert({
      recruiter_id: input.recruiterId || null,
      application_id: input.applicationId || null,
      candidate_email: candidateEmail,
      dealer_id: input.dealerId || null,
      subject: input.subject || null,
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create message thread:", error);
    return null;
  }

  return String(data.id);
}

async function logOutboundEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from: string;
  replyTo?: string;
  recruiterId?: string | null;
  applicationId?: string | null;
  dealerId?: string | null;
  threadId?: string | null;
  status: "sent" | "failed";
  providerMessageId?: string | null;
  providerPayload?: unknown;
}) {
  try {
    const toEmail = normalizeRecipient(input.to);
    const threadId = await ensureThread({
      threadId: input.threadId,
      recruiterId: input.recruiterId,
      applicationId: input.applicationId,
      candidateEmail: toEmail,
      dealerId: input.dealerId,
      subject: input.subject,
    });

    const { error } = await supabaseAdmin.schema("nata").from("messages").insert({
      thread_id: threadId,
      recruiter_id: input.recruiterId || null,
      application_id: input.applicationId || null,
      dealer_id: input.dealerId || null,
      direction: "outbound",
      channel: "email",
      status: input.status,
      subject: input.subject,
      body_text: input.text || null,
      body_html: input.html,
      from_email: emailAddressOnly(input.from),
      to_email: toEmail,
      provider: "resend",
      provider_message_id: input.providerMessageId || null,
      provider_payload: input.providerPayload || {},
      sent_at: input.status === "sent" ? new Date().toISOString() : null,
    });

    if (error) {
      console.error("Failed to log outbound email:", error);
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
  } catch (error) {
    console.error("Outbound email logging failed:", error);
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
  from,
  recruiterId,
  applicationId,
  dealerId,
  threadId,
}: SendEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const resolvedFrom =
    from ||
    process.env.NATA_EMAIL_FROM ||
    "NATA Recruiting Team <team@natatoday.ai>";

  const result = await resend.emails.send({
    from: resolvedFrom,
    to,
    subject,
    html,
    text,
    replyTo: replyTo || process.env.NATA_EMAIL_REPLY_TO || undefined,
  });

  if (result.error) {
    console.error("Resend email error:", result.error);
    await logOutboundEmail({
      to,
      subject,
      html,
      text,
      from: resolvedFrom,
      replyTo,
      recruiterId,
      applicationId,
      dealerId,
      threadId,
      status: "failed",
      providerPayload: { error: result.error },
    });
    throw new Error(result.error.message || "Failed to send email");
  }

  await logOutboundEmail({
    to,
    subject,
    html,
    text,
    from: resolvedFrom,
    replyTo,
    recruiterId,
    applicationId,
    dealerId,
    threadId,
    status: "sent",
    providerMessageId: result.data?.id || null,
    providerPayload: result.data ? JSON.parse(JSON.stringify(result.data)) : {},
  });

  return result.data;
}
