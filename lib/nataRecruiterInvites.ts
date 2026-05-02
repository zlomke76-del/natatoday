import { randomUUID } from "crypto";
import { Resend } from "resend";

type RecruiterInvitePayload = {
  recruiterId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  title?: string | null;
  inviteToken: string;
};

type SendResult = {
  email: { sent: boolean; reason?: string; id?: string };
  sms: { sent: boolean; reason?: string; status?: number };
};

export function createInviteToken() {
  return randomUUID().replace(/-/g, "");
}

export function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function buildRecruiterInviteUrl(inviteToken: string) {
  return `${appUrl()}/recruiter/invite/${inviteToken}`;
}

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

async function sendRecruiterInviteEmail(payload: RecruiterInvitePayload) {
  if (!payload.email) return { sent: false, reason: "missing_email" };
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is missing. Recruiter invite email not sent.");
    return { sent: false, reason: "missing_resend_key" };
  }

  const inviteUrl = buildRecruiterInviteUrl(payload.inviteToken);
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: emailFrom(),
      to: payload.email,
      subject: "Your NATA Today recruiter workspace invite",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.55;color:#111827;max-width:620px;">
          <h2 style="margin:0 0 12px;">You have been invited to NATA Today.</h2>
          <p>Hi ${payload.name || "there"},</p>
          <p>
            Don has added you to the NATA Today recruiting platform as <strong>${payload.role}</strong>${
              payload.title ? ` (${payload.title})` : ""
            }.
          </p>
          <p>
            Use the secure invite link below to activate your workspace.
          </p>
          <p style="margin:22px 0;">
            <a href="${inviteUrl}"
              style="display:inline-block;background:#1473ff;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">
              Activate recruiter workspace
            </a>
          </p>
          <p style="color:#4b5563;">
            This invite gives you access only to the work assigned to you unless Don grants broader permissions.
          </p>
          <p style="color:#4b5563;">NATA Today</p>
        </div>
      `,
      text: `NATA Today: Don has invited you as ${payload.role}. Activate your recruiter workspace here: ${inviteUrl}`,
    });

    const id = typeof result === "object" && result && "data" in result
      ? (result.data as { id?: string } | null)?.id
      : undefined;

    console.log("Recruiter invite email sent:", result);
    return { sent: true, id };
  } catch (error) {
    console.error("Recruiter invite email failed:", error);
    return { sent: false, reason: "resend_error" };
  }
}

async function sendRecruiterInviteSms(payload: RecruiterInvitePayload) {
  const to = normalizePhone(payload.phone);
  if (!to) return { sent: false, reason: "missing_or_invalid_phone" };

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.warn("Twilio env vars are missing. Recruiter invite SMS not sent.");
    return { sent: false, reason: "missing_twilio_config" };
  }

  const inviteUrl = buildRecruiterInviteUrl(payload.inviteToken);
  const body = `NATA Today: Don invited you to activate your recruiter workspace. Open: ${inviteUrl}`;

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error("Recruiter invite SMS failed:", response.status, text);
    return { sent: false, reason: "twilio_error", status: response.status };
  }

  return { sent: true };
}

export async function sendRecruiterInvite(
  payload: RecruiterInvitePayload
): Promise<SendResult> {
  const [emailResult, smsResult] = await Promise.allSettled([
    sendRecruiterInviteEmail(payload),
    sendRecruiterInviteSms(payload),
  ]);

  return {
    email:
      emailResult.status === "fulfilled"
        ? emailResult.value
        : { sent: false, reason: "email_exception" },
    sms:
      smsResult.status === "fulfilled"
        ? smsResult.value
        : { sent: false, reason: "sms_exception" },
  };
}
