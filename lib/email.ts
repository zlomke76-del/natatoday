import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  try {
    const response = await resend.emails.send({
      from: "NATA Recruiting Team <team@natatoday.ai>",
      to,
      subject,
      html,
    });

    return response;
  } catch (error) {
    console.error("Email send error:", error);
    throw new Error("Failed to send email");
  }
}
