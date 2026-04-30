import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailInput) {
  if (!resend) {
    throw new Error("Missing RESEND_API_KEY.");
  }

  if (!to || !subject || !html) {
    throw new Error("Email requires to, subject, and html.");
  }

  const from = process.env.NATA_EMAIL_FROM || "NATA Recruiting Team <team@natatoday.ai>";

  const result = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
    reply_to: replyTo || process.env.NATA_EMAIL_REPLY_TO || undefined,
  });

  if (result.error) {
    console.error("Resend email error:", result.error);
    throw new Error(result.error.message || "Failed to send email.");
  }

  return result.data;
}
