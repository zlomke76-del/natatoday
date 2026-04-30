import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");

    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const outreachId = clean(body.outreach_id);

    if (!outreachId) {
      return NextResponse.json(
        { error: "outreach_id is required" },
        { status: 400 }
      );
    }

    const { data: outreach, error: outreachError } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .select(
        `
          *,
          jobs:job_id (
            id,
            title,
            slug,
            publish_status,
            is_active
          )
        `
      )
      .eq("id", outreachId)
      .single();

    if (outreachError || !outreach) {
      return NextResponse.json({ error: "Outreach not found" }, { status: 404 });
    }

    if (outreach.outreach_status !== "approved") {
      return NextResponse.json(
        { error: "Outreach must be approved before sending." },
        { status: 400 }
      );
    }

    const job = Array.isArray(outreach.jobs) ? outreach.jobs[0] : outreach.jobs;

    if (!job || job.publish_status !== "published" || job.is_active === false) {
      return NextResponse.json(
        { error: "This job is not active. Outreach was not sent." },
        { status: 400 }
      );
    }

    if (!outreach.candidate_email) {
      return NextResponse.json(
        { error: "Candidate email is missing." },
        { status: 400 }
      );
    }

    const candidateName = clean(outreach.candidate_name, "there");
    const jobTitle = clean(job.title, "role");
    const roleUrl = `${appBaseUrl()}/careers/${job.slug}`;

    const subject =
      clean(outreach.message_subject) || "A new role may be a stronger fit";

    const messageBody =
      clean(outreach.message_body) ||
      `We reviewed your profile again while preparing a new ${jobTitle} opportunity. Based on your background and prior notes, this role may be a stronger fit than the position you previously considered.`;

    const html = `
      <div style="margin:0;padding:0;background:#f5f7fb;">
        <div style="max-width:640px;margin:0 auto;padding:28px 18px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:22px;padding:28px;box-shadow:0 18px 60px rgba(15,23,42,0.08);">
            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">Hi ${candidateName},</p>

            <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">
              ${messageBody}
            </p>

            <p style="margin:0 0 18px;font-size:16px;line-height:1.55;">
              If you're still open to opportunities, our team can move you forward without asking you to restart the full process.
            </p>

            <div style="margin:24px 0;">
              <a href="${roleUrl}" style="display:inline-block;background:#1473ff;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 18px;">
                View role
              </a>
            </div>

            <p style="margin:18px 0 0;font-size:15px;line-height:1.55;color:#4b5563;">
              — NATA Recruiting Team
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `Hi ${candidateName},

${messageBody}

If you're still open to opportunities, our team can move you forward without asking you to restart the full process.

View role: ${roleUrl}

- NATA Recruiting Team`;

    await sendEmail({
      to: outreach.candidate_email,
      subject,
      html,
      text,
    });

    const { data: updated, error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .update({
        outreach_status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", outreachId)
      .select("*")
      .single();

    if (updateError) {
      console.error("Outreach sent but status update failed:", updateError);
      return NextResponse.json(
        {
          error:
            "Email was sent, but outreach status could not be updated. Check the outreach record.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ outreach: updated });
  } catch (error) {
    console.error("Outreach send failed:", error);
    return NextResponse.json({ error: "Outreach send failed." }, { status: 500 });
  }
}
