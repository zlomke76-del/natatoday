import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RouteProps = {
  params: {
    applicationId: string;
  };
};

type AnyRow = Record<string, any>;

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getBaseUrl(request: NextRequest) {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  return request.nextUrl.origin.replace(/\/$/, "");
}

function getCandidateName(application: AnyRow) {
  return String(application.name || application.candidate_name || application.email || "Candidate");
}

function getCandidateRole(application: AnyRow) {
  const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
  return String(jobs?.title || application.role || application.job_title || "open role");
}

function getDealerSlug(application: AnyRow) {
  const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
  return String(jobs?.dealer_slug || "");
}

function getDealerName(application: AnyRow, dealer?: AnyRow | null) {
  const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
  return String(dealer?.name || jobs?.public_dealer_name || jobs?.dealer_slug || "your dealership");
}

async function sendEmail(input: { to?: string | null; subject: string; html: string }) {
  if (!input.to || !process.env.RESEND_API_KEY) {
    return { skipped: true };
  }

  const from = process.env.NATA_EMAIL_FROM || "NATA Today <noreply@natatoday.com>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Dealer schedule email failed:", body);
    return { skipped: false, error: body || "Email failed" };
  }

  return { skipped: false };
}

async function sendSms(input: { to?: string | null; body: string }) {
  if (
    !input.to ||
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_PHONE_NUMBER
  ) {
    return { skipped: true };
  }

  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
  ).toString("base64");

  const params = new URLSearchParams();
  params.set("To", input.to);
  params.set("From", process.env.TWILIO_PHONE_NUMBER);
  params.set("Body", input.body);

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Dealer schedule SMS failed:", body);
    return { skipped: false, error: body || "SMS failed" };
  }

  return { skipped: false };
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  try {
    const formData = await request.formData().catch(() => null);
    const body = formData ? null : await request.json().catch(() => ({}));

    const dealerSlugFromInput = formData
      ? clean(formData.get("dealer_slug"))
      : clean(body?.dealer_slug);

    const applicationId = params.applicationId;

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
    }

    const { data: application, error: applicationError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("*, jobs(id,title,dealer_id,dealer_slug,public_dealer_name)")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    if (application.interview_packet_ready !== true) {
      return NextResponse.json(
        { error: "Interview packet must be ready before dealer scheduling can be requested." },
        { status: 400 },
      );
    }

    const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const dealerSlug = dealerSlugFromInput || getDealerSlug(application);

    let dealer: AnyRow | null = null;

    if (jobs?.dealer_id) {
      const { data } = await supabaseAdmin
        .schema("nata")
        .from("dealers")
        .select("id,name,slug,contact_email,contact_phone")
        .eq("id", jobs.dealer_id)
        .maybeSingle();

      dealer = data || null;
    }

    if (!dealer && dealerSlug) {
      const { data } = await supabaseAdmin
        .schema("nata")
        .from("dealers")
        .select("id,name,slug,contact_email,contact_phone")
        .eq("slug", dealerSlug)
        .maybeSingle();

      dealer = data || null;
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "dealer_schedule_requested",
        screening_status: "dealer_schedule_requested",
        updated_at: now,
      })
      .eq("id", applicationId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Application could not be updated." },
        { status: 500 },
      );
    }

    const candidateName = getCandidateName(application);
    const role = getCandidateRole(application);
    const dealerName = getDealerName(application, dealer);
    const dashboardUrl = `${getBaseUrl(request)}/dealer/${dealerSlug}/dashboard`;

    await sendEmail({
      to: dealer?.contact_email,
      subject: `Candidate ready for interview: ${candidateName}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>${candidateName} is ready for a manager interview</h2>
          <p>NATA Today has completed the virtual interview and prepared the recommendation packet for <strong>${role}</strong>.</p>
          <p>Please open your dealer dashboard and select the optimal manager interview time.</p>
          <p><a href="${dashboardUrl}">Open dealer dashboard</a></p>
        </div>
      `,
    });

    await sendSms({
      to: dealer?.contact_phone,
      body: `NATA Today: ${candidateName} is ready for a manager interview for ${role}. Please select the optimal time: ${dashboardUrl}`,
    });

    return NextResponse.redirect(
      new URL(`/dealer/${dealerSlug}/dashboard?schedule=requested`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("Request dealer schedule failed:", error);
    return NextResponse.json({ error: "Dealer scheduling request failed." }, { status: 500 });
  }
}
