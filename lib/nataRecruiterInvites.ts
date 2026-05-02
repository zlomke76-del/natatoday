import { Resend } from "resend";

type InvitePayload = {
  recruiterName: string;
  recruiterEmail?: string | null;
  recruiterPhone?: string | null;
  role: string;
  inviteUrl: string;
};

function emailFrom() {
  return process.env.NATA_EMAIL_FROM || "NATA Today <interviews@natatoday.ai>";
}

function normalizePhone(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

async function sendEmail({ to, subject, html }: { to?: string | null; subject: string; html: string }) {
  if (!to) return { sent: false, reason: "missing_email" };
  if (!process.env.RESEND_API_KEY) return { sent: false, reason: "missing_resend_key" };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({ from: emailFrom(), to, subject, html });
    return { sent: true, result };
  } catch (error) {
    console.error("Recruiter invite email failed:", error);
    return { sent: false, reason: "resend_error" };
  }
}

async function sendSms({ to, body }: { to?: string | null; body: string }) {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) return { sent: false, reason: "missing_or_invalid_phone" };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return { sent: false, reason: "missing_twilio_config" };
  }

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: normalizedTo, From: from, Body: body }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Recruiter invite SMS failed:", response.status, text);
      return { sent: false, reason: "twilio_error", status: response.status };
    }

    return { sent: true };
  } catch (error) {
    console.error("Recruiter invite SMS request failed:", error);
    return { sent: false, reason: "twilio_request_error" };
  }
}

export async function sendRecruiterInvite(payload: InvitePayload) {
  const roleLabel = payload.role === "agent" ? "agent" : payload.role === "admin" ? "admin" : "recruiter";
  const subject = "You have been invited to NATA Today";

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;">
      <h2 style="margin:0 0 12px;">You have been invited to NATA Today.</h2>
      <p>Hi ${payload.recruiterName || "there"},</p>
      <p>You have been invited as a <strong>${roleLabel}</strong> on the NATA Today recruiting platform.</p>
      <p>This workspace is used to review assigned candidates, conduct interviews, and document hiring pipeline actions under NATA Today controls.</p>
      <p style="margin:22px 0;">
        <a href="${payload.inviteUrl}" style="display:inline-block;background:#1473ff;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">
          Accept invite
        </a>
      </p>
      <p style="color:#4b5563;">If you did not expect this invite, you can ignore this message.</p>
      <p style="color:#4b5563;">NATA Today</p>
    </div>
  `;

  const sms = `NATA Today: You have been invited as a ${roleLabel}. Accept your invite here: ${payload.inviteUrl}`;

  const [emailResult, smsResult] = await Promise.all([
    sendEmail({ to: payload.recruiterEmail, subject, html }),
    sendSms({ to: payload.recruiterPhone, body: sms }),
  ]);

  return { email: emailResult, sms: smsResult };
}
