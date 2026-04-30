import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendEmail } from "../../../../../lib/email";

const HARD_STOP_STATUSES = new Set([
  "hired",
  "placed",
  "withdrawn",
  "do_not_contact",
  "disqualified",
]);

function getAppUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function buildOutreachEmail({
  candidateName,
  jobTitle,
  matchReason,
  recommendedNextStep,
  roleUrl,
}: {
  candidateName: string;
  jobTitle: string;
  matchReason: string;
  recommendedNextStep: string;
  roleUrl: string;
}) {
  const safeName = escapeHtml(candidateName || "there");
  const safeTitle = escapeHtml(jobTitle || "a new role");
  const safeReason = escapeHtml(matchReason || "your background appears aligned with this opportunity");
  const safeNextStep = escapeHtml(recommendedNextStep || "Reply to this email if you would like to be considered.");

  const text = `Hi ${candidateName || "there"},\n\nWe reviewed your profile again while preparing a new ${jobTitle || "role"} opportunity.\n\nBased on your background and prior notes, this role may be a stronger fit than the position you previously considered.\n\nWhy this matched: ${matchReason || "your background appears aligned with this opportunity"}\n\nNext step: ${recommendedNextStep || "Reply to this email if you would like to be considered."}\n\nView role: ${roleUrl}\n\n- NATA Recruiting Team`;

  const html = `
    <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
        <div style="background:#ffffff;border:1px solid #dbe4f0;border-radius:22px;overflow:hidden;box-shadow:0 16px 45px rgba(15,23,42,0.08);">
          <div style="padding:24px 26px;background:#06111f;color:#ffffff;">
            <div style="font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#60a5fa;">NATA Recruiting Team</div>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.1;">A new role may be a stronger fit</h1>
          </div>

          <div style="padding:26px;line-height:1.58;font-size:15px;">
            <p style="margin:0 0 16px;">Hi ${safeName},</p>

            <p style="margin:0 0 16px;">
              We reviewed your profile again while preparing a new <strong>${safeTitle}</strong> opportunity.
            </p>

            <p style="margin:0 0 16px;">
              Based on your background and prior notes, this role may be a stronger fit than the position you previously considered.
            </p>

            <div style="margin:20px 0;padding:16px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;">
              <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#1d4ed8;margin-bottom:6px;">Why this matched</div>
              <div style="color:#1f2937;">${safeReason}</div>
            </div>

            <div style="margin:20px 0;padding:16px;border-radius:16px;background:#f8fafc;border:1px solid #e5e7eb;">
              <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#475569;margin-bottom:6px;">Recommended next step</div>
              <div style="color:#1f2937;">${safeNextStep}</div>
            </div>

            <p style="margin:22px 0;">
              <a href="${roleUrl}" style="display:inline-block;background:#1473ff;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:13px 18px;">View role</a>
            </p>

            <p style="margin:0;color:#475569;">
              If you are still open to opportunities, our team can move you forward without asking you to restart the full process.
            </p>

            <p style="margin:24px 0 0;">– NATA Recruiting Team</p>
          </div>
        </div>
      </div>
    </div>
  `;

  return { html, text };
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");

    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const outreachId = clean(body.outreach_id || body.id);

    if (!outreachId) {
      return NextResponse.json({ error: "Missing outreach_id" }, { status: 400 });
    }

    const { data: outreach, error: outreachError } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .select("*")
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

    if (!outreach.candidate_email) {
      return NextResponse.json({ error: "Outreach is missing candidate email." }, { status: 400 });
    }

    const { data: application } = outreach.application_id
      ? await supabaseAdmin
          .schema("nata")
          .from("applications")
          .select("id,screening_status,candidate_pool_status")
          .eq("id", outreach.application_id)
          .maybeSingle()
      : { data: null };

    const poolStatus = clean(application?.candidate_pool_status || application?.screening_status).toLowerCase();

    if (poolStatus && HARD_STOP_STATUSES.has(poolStatus)) {
      await supabaseAdmin
        .schema("nata")
        .from("candidate_outreach")
        .update({ outreach_status: "suppressed" })
        .eq("id", outreachId);

      return NextResponse.json(
        { error: "Candidate is not eligible for outreach.", suppressed: true },
        { status: 409 }
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("id,title,slug,publish_status,is_active")
      .eq("id", outreach.job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (!job.is_active || job.publish_status !== "published") {
      await supabaseAdmin
        .schema("nata")
        .from("candidate_outreach")
        .update({ outreach_status: "suppressed" })
        .eq("id", outreachId);

      return NextResponse.json(
        { error: "Job is no longer active for outreach.", suppressed: true },
        { status: 409 }
      );
    }

    const appUrl = getAppUrl();
    const roleUrl = `${appUrl}/careers/${job.slug}`;
    const subject = clean(
      outreach.message_subject,
      `${job.title || "A new role"} may be a strong fit`
    );

    const { html, text } = buildOutreachEmail({
      candidateName: outreach.candidate_name || "there",
      jobTitle: job.title || "a new role",
      matchReason: outreach.match_reason || "",
      recommendedNextStep:
        outreach.recommended_next_step || "Reply to this email if you would like to be considered.",
      roleUrl,
    });

    const sent = await sendEmail({
      to: outreach.candidate_email,
      subject,
      html,
      text,
    });

    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .update({
        outreach_status: "sent",
        message_subject: subject,
        message_body: text,
        sent_at: new Date().toISOString(),
      })
      .eq("id", outreachId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, email: sent });
  } catch (error) {
    console.error("Outreach send error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Outreach send failed." },
      { status: 500 }
    );
  }
}
