import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type SendEmailInput = {
  to: string | string[];
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
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const result = await resend.emails.send({
    from:
      process.env.NATA_EMAIL_FROM ||
      "NATA Recruiting Team <team@natatoday.ai>",
    to,
    subject,
    html,
    text,
    replyTo: replyTo || process.env.NATA_EMAIL_REPLY_TO || undefined,
  });

  if (result.error) {
    console.error("Resend email error:", result.error);
    throw new Error(result.error.message || "Failed to send email");
  }

  return result.data;
}
