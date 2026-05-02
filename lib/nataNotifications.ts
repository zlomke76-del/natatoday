import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";

type InterviewInvitePayload = {
  applicationId: string;
  candidateName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  roleTitle: string;
  dealerName: string;
  recruiterName: string;
  bookingUrl: string;
};

type BookingConfirmationPayload = {
  applicationId?: string | null;
  candidateName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  roleTitle: string;
  dealerName: string;
  recruiterName: string;
  scheduledStartLabel: string;
  scheduledEndLabel: string;
  scheduledWindowLabel: string;
  meetingUrl: string;
};

type MessageContext = {
  applicationId?: string | null;
  dealerSlug?: string | null;
  recruiterId?: string | null;
  subject?: string | null;
};

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function emailFrom() {
  return process.env.NATA_EMAIL_FROM || "NATA Today <interviews@natatoday.ai>";
}

function normalizePhone(value?: string | null) {
  if (!value) return "";

  const trimmed = value.trim();

  if (trimmed.startsWith("+")) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return "";
}

function textFromHtml(html: string) {
  return html
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

async function getApplicationContext(applicationId?: string | null) {
  if (!applicationId) {
    return {
      dealerSlug: null as string | null,
      recruiterId: null as string | null,
    };
  }

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id,recruiter_id,job_id,jobs(dealer_slug)")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load application context for notification:", error);
  }

  const row = data as Record<string, any> | null;
  const joinedJob = Array.isArray(row?.jobs) ? row?.jobs[0] : row?.jobs;

  return {
    dealerSlug:
      typeof joinedJob?.dealer_slug === "string" ? joinedJob.dealer_slug : null,
    recruiterId:
      typeof row?.recruiter_id === "string" ? row.recruiter_id : null,
  };
}

async function logMessage(input: {
  channel: "email" | "sms";
  direction: "outbound" | "inbound";
  subject?: string | null;
  body?: string | null;
  html?: string | null;
  fromEmail?: string | null;
  toEmail?: string | null;
  fromPhone?: string | null;
  toPhone?: string | null;
  applicationId?: string | null;
  dealerSlug?: string | null;
  recruiterId?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  providerPayload?: unknown;
  status?: string | null;
}) {
  const context = await getApplicationContext(input.applicationId);

  const row = {
    channel: input.channel,
    direction: input.direction,
    subject: input.subject || null,
    body: input.body || null,
    html: input.html || null,
    from_email: input.fromEmail || null,
    to_email: input.toEmail || null,
    from_phone: input.fromPhone || null,
    to_phone: input.toPhone || null,
    application_id: input.applicationId || null,
    dealer_slug: input.dealerSlug || context.dealerSlug,
    recruiter_id: input.recruiterId || context.recruiterId,
    provider: input.provider || null,
    provider_message_id: input.providerMessageId || null,
    provider_payload: input.providerPayload
      ? JSON.parse(JSON.stringify(input.providerPayload))
      : {},
    status: input.status || "recorded",
  };

  const { error } = await supabaseAdmin.schema("nata").from("messages").insert(row);

  if (error) {
    console.error("Failed to log communication message:", error);
  }
}

async function sendEmail({
  to,
  subject,
  html,
  context,
}: {
  to?: string | null;
  subject: string;
  html: string;
  context?: MessageContext;
}) {
  if (!to) {
    return { sent: false, reason: "missing_email" };
  }

  const from = emailFrom();
  const bodyText = textFromHtml(html);

  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is missing. Email not sent.");

    await logMessage({
      channel: "email",
      direction: "outbound",
      subject,
      body: bodyText,
      html,
      fromEmail: from,
      toEmail: to,
      applicationId: context?.applicationId || null,
      dealerSlug: context?.dealerSlug || null,
      recruiterId: context?.recruiterId || null,
      provider: "resend",
      status: "failed",
      providerPayload: { reason: "missing_resend_key" },
    });

    return { sent: false, reason: "missing_resend_key" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
  });

  if (result.error) {
    await logMessage({
      channel: "email",
      direction: "outbound",
      subject,
      body: bodyText,
      html,
      fromEmail: from,
      toEmail: to,
      applicationId: context?.applicationId || null,
      dealerSlug: context?.dealerSlug || null,
      recruiterId: context?.recruiterId || null,
      provider: "resend",
      status: "failed",
      providerPayload: result.error,
    });

    console.error("Resend email failed:", result.error);
    return { sent: false, reason: "resend_error" };
  }

  await logMessage({
    channel: "email",
    direction: "outbound",
    subject,
    body: bodyText,
    html,
    fromEmail: from,
    toEmail: to,
    applicationId: context?.applicationId || null,
    dealerSlug: context?.dealerSlug || null,
    recruiterId: context?.recruiterId || null,
    provider: "resend",
    providerMessageId: result.data?.id || null,
    status: "sent",
    providerPayload: result.data || {},
  });

  return { sent: true, providerMessageId: result.data?.id || null };
}

async function sendSms({
  to,
  body,
  context,
}: {
  to?: string | null;
  body: string;
  context?: MessageContext;
}) {
  const normalizedTo = normalizePhone(to);
  const from = process.env.TWILIO_PHONE_NUMBER || "";

  if (!normalizedTo) {
    return { sent: false, reason: "missing_or_invalid_phone" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || !from) {
    console.warn("Twilio env vars are missing. SMS not sent.");

    await logMessage({
      channel: "sms",
      direction: "outbound",
      body,
      fromPhone: from || null,
      toPhone: normalizedTo,
      applicationId: context?.applicationId || null,
      dealerSlug: context?.dealerSlug || null,
      recruiterId: context?.recruiterId || null,
      provider: "twilio",
      status: "failed",
      providerPayload: { reason: "missing_twilio_config" },
    });

    return { sent: false, reason: "missing_twilio_config" };
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizedTo,
        From: from,
        Body: body,
      }),
    }
  );

  const payload = await response
    .json()
    .catch(async () => ({ raw: await response.text().catch(() => "") }));

  await logMessage({
    channel: "sms",
    direction: "outbound",
    body,
    fromPhone: from,
    toPhone: normalizedTo,
    applicationId: context?.applicationId || null,
    dealerSlug: context?.dealerSlug || null,
    recruiterId: context?.recruiterId || null,
    provider: "twilio",
    providerMessageId:
      typeof payload?.sid === "string" ? payload.sid : null,
    status: response.ok ? "sent" : "failed",
    providerPayload: payload,
  });

  if (!response.ok) {
    console.error("Twilio SMS failed:", response.status, payload);
    return { sent: false, reason: "twilio_error", status: response.status };
  }

  return { sent: true, providerMessageId: payload?.sid || null };
}

export async function sendInterviewInvite(payload: InterviewInvitePayload) {
  const subject = `Schedule your NATA Today interview for ${payload.roleTitle}`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #111827;">
      <h2 style="margin: 0 0 12px;">You have advanced to the next step.</h2>
      <p>Hi ${payload.candidateName || "there"},</p>
      <p>
        Your application for the <strong>${payload.roleTitle}</strong> role with
        <strong>${payload.dealerName}</strong> has moved forward.
      </p>
      <p>
        Please choose a 15-minute virtual interview time with ${payload.recruiterName}.
      </p>
      <p style="margin: 22px 0;">
        <a href="${payload.bookingUrl}"
          style="display:inline-block;background:#1473ff;color:#ffffff;text-decoration:none;
          padding:12px 18px;border-radius:999px;font-weight:700;">
          Schedule interview
        </a>
      </p>
      <p style="color:#4b5563;">
        This short interview helps confirm role fit, availability, communication style,
        and next-step readiness before anything is sent to the dealership.
      </p>
      <p style="color:#4b5563;">NATA Today</p>
    </div>
  `;

  const smsBody = `NATA Today: You’ve advanced for ${payload.roleTitle}. Choose your 15-min virtual interview time here: ${payload.bookingUrl}`;

  const context = {
    applicationId: payload.applicationId,
    subject,
  };

  const results = await Promise.allSettled([
    sendEmail({
      to: payload.candidateEmail,
      subject,
      html: emailHtml,
      context,
    }),
    sendSms({
      to: payload.candidatePhone,
      body: smsBody,
      context,
    }),
  ]);

  return results;
}

export async function sendBookingConfirmation(payload: BookingConfirmationPayload) {
  const subject = `Interview confirmed: ${payload.roleTitle}`;

  const emailHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #111827;">
      <h2 style="margin: 0 0 12px;">Your interview is confirmed.</h2>
      <p>Hi ${payload.candidateName || "there"},</p>
      <p>
        Your 15-minute virtual interview with ${payload.recruiterName} for the
        <strong>${payload.roleTitle}</strong> role with <strong>${payload.dealerName}</strong>
        is confirmed for:
      </p>
      <p style="font-size:18px;font-weight:700;">${payload.scheduledWindowLabel}</p>
      <p style="color:#4b5563;">
        Start: <strong>${payload.scheduledStartLabel}</strong><br />
        End: <strong>${payload.scheduledEndLabel}</strong>
      </p>
      <p style="margin: 22px 0;">
        <a href="${payload.meetingUrl}"
          style="display:inline-block;background:#1473ff;color:#ffffff;text-decoration:none;
          padding:12px 18px;border-radius:999px;font-weight:700;">
          Join virtual interview
        </a>
      </p>
      <p style="color:#4b5563;">
        Meeting link:<br />
        <a href="${payload.meetingUrl}">${payload.meetingUrl}</a>
      </p>
      <p style="color:#4b5563;">
        Please be ready to discuss your experience, availability, follow-up discipline,
        and why this dealership role fits your background.
      </p>
      <p style="color:#4b5563;">NATA Today</p>
    </div>
  `;

  const smsBody = `NATA Today: Your ${payload.roleTitle} interview is confirmed for ${payload.scheduledWindowLabel}. Join here: ${payload.meetingUrl}`;

  const context = {
    applicationId: payload.applicationId || null,
    subject,
  };

  const results = await Promise.allSettled([
    sendEmail({
      to: payload.candidateEmail,
      subject,
      html: emailHtml,
      context,
    }),
    sendSms({
      to: payload.candidatePhone,
      body: smsBody,
      context,
    }),
  ]);

  return results;
}

export function buildCandidateScheduleUrl(applicationId: string) {
  return `${appUrl()}/candidate/schedule/${applicationId}`;
}
