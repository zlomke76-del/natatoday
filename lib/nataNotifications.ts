import { Resend } from "resend";

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
  candidateName: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  roleTitle: string;
  dealerName: string;
  recruiterName: string;
  scheduledLabel: string;
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

async function sendEmail({
  to,
  subject,
  html,
}: {
  to?: string | null;
  subject: string;
  html: string;
}) {
  if (!to) {
    return { sent: false, reason: "missing_email" };
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is missing. Email not sent.");
    return { sent: false, reason: "missing_resend_key" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: emailFrom(),
    to,
    subject,
    html,
  });

  return { sent: true };
}

async function sendSms({
  to,
  body,
}: {
  to?: string | null;
  body: string;
}) {
  const normalizedTo = normalizePhone(to);

  if (!normalizedTo) {
    return { sent: false, reason: "missing_or_invalid_phone" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.warn("Twilio env vars are missing. SMS not sent.");
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

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Twilio SMS failed:", response.status, text);
    return { sent: false, reason: "twilio_error", status: response.status };
  }

  return { sent: true };
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

  const results = await Promise.allSettled([
    sendEmail({ to: payload.candidateEmail, subject, html: emailHtml }),
    sendSms({ to: payload.candidatePhone, body: smsBody }),
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
      <p style="font-size:18px;font-weight:700;">${payload.scheduledLabel}</p>
      <p style="color:#4b5563;">
        Please be ready to discuss your experience, availability, follow-up discipline,
        and why this dealership role fits your background.
      </p>
      <p style="color:#4b5563;">NATA Today</p>
    </div>
  `;

  const smsBody = `NATA Today: Your ${payload.roleTitle} interview is confirmed for ${payload.scheduledLabel}.`;

  const results = await Promise.allSettled([
    sendEmail({ to: payload.candidateEmail, subject, html: emailHtml }),
    sendSms({ to: payload.candidatePhone, body: smsBody }),
  ]);

  return results;
}

export function buildCandidateScheduleUrl(applicationId: string) {
  return `${appUrl()}/candidate/schedule/${applicationId}`;
}
