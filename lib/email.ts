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
  signatureName?: string | null;
  signatureTitle?: string | null;
  signatureEmail?: string | null;
  signaturePhone?: string | null;
};

function normalizeRecipient(value: string | string[]) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function emailAddressOnly(value: string | undefined | null) {
  if (!value) return "";
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] || value).trim();
}

function displayNameOnly(value: string | undefined | null) {
  if (!value) return "";
  const match = value.match(/^([^<]+)</);
  return (match?.[1] || "").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function plainTextToParagraphHtml(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      return `<p style="margin:0 0 14px;color:#1f2937;font-size:15px;line-height:1.65;">${escapeHtml(
        paragraph,
      ).replace(/\n/g, "<br />")}</p>`;
    })
    .join("");
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildProfessionalEmailHtml(input: {
  subject: string;
  html: string;
  text?: string;
  from: string;
  replyTo?: string | null;
  signatureName?: string | null;
  signatureTitle?: string | null;
  signatureEmail?: string | null;
  signaturePhone?: string | null;
}) {
  const fromName = displayNameOnly(input.from);
  const fromEmail = emailAddressOnly(input.replyTo || input.from);
  const signatureName =
    input.signatureName ||
    fromName ||
    process.env.NATA_EMAIL_SIGNATURE_NAME ||
    "NATA Recruiting Team";
  const signatureTitle =
    input.signatureTitle ||
    process.env.NATA_EMAIL_SIGNATURE_TITLE ||
    "Recruiting Operations";
  const signatureEmail =
    input.signatureEmail ||
    fromEmail ||
    process.env.NATA_EMAIL_REPLY_TO ||
    "team@natatoday.ai";
  const signaturePhone =
    input.signaturePhone || process.env.NATA_EMAIL_SIGNATURE_PHONE || "";

  const bodyHtml =
    input.html && /<\/?[a-z][\s\S]*>/i.test(input.html)
      ? input.html
      : plainTextToParagraphHtml(input.text || input.html || "");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(stripHtml(input.text || input.html || input.subject)).slice(0, 120)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dfe7f2;border-radius:18px;overflow:hidden;box-shadow:0 18px 48px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#07101f;padding:22px 28px;border-bottom:4px solid #1473ff;">
                <div style="font-size:20px;line-height:1;font-weight:800;color:#ffffff;letter-spacing:-0.02em;">
                  NATA Today
                </div>
                <div style="margin-top:7px;font-size:12px;line-height:1.4;color:#bfdbfe;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;">
                  Automotive recruiting, structured
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:30px 30px 12px;">
                <h1 style="margin:0 0 18px;color:#0f172a;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.03em;">
                  ${escapeHtml(input.subject)}
                </h1>

                <div style="color:#1f2937;font-size:15px;line-height:1.65;">
                  ${bodyHtml}
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:8px 30px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e5edf7;margin-top:14px;padding-top:22px;">
                  <tr>
                    <td style="vertical-align:top;">
                      <div style="font-size:15px;font-weight:800;color:#0f172a;">${escapeHtml(signatureName)}</div>
                      <div style="margin-top:4px;font-size:13px;color:#475569;">${escapeHtml(signatureTitle)}</div>
                      <div style="margin-top:10px;font-size:13px;color:#2563eb;">
                        ${escapeHtml(signatureEmail)}
                      </div>
                      ${
                        signaturePhone
                          ? `<div style="margin-top:4px;font-size:13px;color:#475569;">${escapeHtml(signaturePhone)}</div>`
                          : ""
                      }
                    </td>
                    <td align="right" style="vertical-align:top;">
                      <div style="display:inline-block;padding:10px 12px;border-radius:12px;background:#eef5ff;border:1px solid #d7e7ff;color:#0757c9;font-size:12px;font-weight:800;">
                        NATA Today
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="margin-top:22px;font-size:11px;line-height:1.5;color:#94a3b8;">
                  This message was sent through NATA Today’s hiring communication system.
                </div>
              </td>
            </tr>
          </table>

          <div style="max-width:640px;margin:14px auto 0;text-align:center;color:#94a3b8;font-size:11px;line-height:1.5;">
            NATA Today · Hiring, structured
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
  rawHtml: string;
  sentHtml: string;
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
      body: input.text || stripHtml(input.rawHtml),
      body_text: input.text || stripHtml(input.rawHtml),
      body_html: input.sentHtml,
      html: input.sentHtml,
      from_email: emailAddressOnly(input.from),
      to_email: toEmail,
      provider: "resend",
      provider_message_id: input.providerMessageId || null,
      provider_payload: input.providerPayload
        ? JSON.parse(JSON.stringify(input.providerPayload))
        : {},
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
  signatureName,
  signatureTitle,
  signatureEmail,
  signaturePhone,
}: SendEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const resolvedFrom =
    from ||
    process.env.NATA_EMAIL_FROM ||
    "NATA Recruiting Team <team@natatoday.ai>";

  const plainText = text || stripHtml(html);
  const professionalHtml = buildProfessionalEmailHtml({
    subject,
    html,
    text: plainText,
    from: resolvedFrom,
    replyTo,
    signatureName,
    signatureTitle,
    signatureEmail,
    signaturePhone,
  });

  const result = await resend.emails.send({
    from: resolvedFrom,
    to,
    subject,
    html: professionalHtml,
    text: plainText,
    replyTo: replyTo || process.env.NATA_EMAIL_REPLY_TO || undefined,
  });

  if (result.error) {
    console.error("Resend email error:", result.error);
    await logOutboundEmail({
      to,
      subject,
      rawHtml: html,
      sentHtml: professionalHtml,
      text: plainText,
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
    rawHtml: html,
    sentHtml: professionalHtml,
    text: plainText,
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
