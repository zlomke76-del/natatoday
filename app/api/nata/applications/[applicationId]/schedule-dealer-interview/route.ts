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

function getCandidateName(application: AnyRow) {
  return String(application.name || application.candidate_name || application.email || "Candidate");
}

function getCandidateEmail(application: AnyRow) {
  return String(application.email || application.candidate_email || "");
}

function getCandidatePhone(application: AnyRow) {
  return String(application.phone || application.candidate_phone || "");
}

function getCandidateRole(application: AnyRow) {
  const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
  return String(jobs?.title || application.role || application.job_title || "open role");
}

function getDealerName(application: AnyRow, dealer?: AnyRow | null) {
  const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
  return String(dealer?.name || jobs?.public_dealer_name || jobs?.dealer_slug || "the dealership");
}

function buildInterviewDate(interviewDate: string, interviewTime: string) {
  const raw = `${interviewDate}T${interviewTime}:00`;
  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function formatInterviewTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
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
    console.error("Candidate schedule email failed:", body);
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
    console.error("Candidate schedule SMS failed:", body);
    return { skipped: false, error: body || "SMS failed" };
  }

  return { skipped: false };
}

export async function POST(request: NextRequest, { params }: RouteProps) {
  try {
    const formData = await request.formData();

    const applicationId = params.applicationId;
    const dealerSlug = clean(formData.get("dealer_slug"));
    const interviewDate = clean(formData.get("interview_date"));
    const interviewTime = clean(formData.get("interview_time"));
    const managerName = clean(formData.get("manager_name"));
    const interviewLocation = clean(formData.get("interview_location"));
    const dealerScheduleNote = clean(formData.get("dealer_schedule_note"));

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
    }

    if (!dealerSlug) {
      return NextResponse.json({ error: "dealer_slug is required" }, { status: 400 });
    }

    if (!interviewDate || !interviewTime) {
      return NextResponse.json({ error: "Interview date and time are required." }, { status: 400 });
    }

    const dealerInterviewAt = buildInterviewDate(interviewDate, interviewTime);

    if (!dealerInterviewAt) {
      return NextResponse.json({ error: "Interview date or time is invalid." }, { status: 400 });
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

    const jobs = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;

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

    const noteParts = [
      managerName ? `Manager/interviewer: ${managerName}` : "",
      interviewLocation ? `Location: ${interviewLocation}` : "",
      dealerScheduleNote ? `Dealer note: ${dealerScheduleNote}` : "",
    ].filter(Boolean);

    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        dealer_interview_at: dealerInterviewAt,
        status: "dealer_interview_scheduled",
        screening_status: "dealer_interview_scheduled",
        decision_reason: noteParts.length ? noteParts.join("\n") : application.decision_reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Dealer interview could not be scheduled." },
        { status: 500 },
      );
    }

    const candidateName = getCandidateName(application);
    const candidateEmail = getCandidateEmail(application);
    const candidatePhone = getCandidatePhone(application);
    const role = getCandidateRole(application);
    const dealerName = getDealerName(application, dealer);
    const formattedTime = formatInterviewTime(dealerInterviewAt);
    const noteLine = dealerScheduleNote ? `<p><strong>Note:</strong> ${dealerScheduleNote}</p>` : "";

    await sendEmail({
      to: candidateEmail,
      subject: `Interview scheduled with ${dealerName}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
          <h2>Your manager interview is scheduled</h2>
          <p>${candidateName}, your interview with <strong>${dealerName}</strong> for <strong>${role}</strong> is scheduled for:</p>
          <p style="font-size:18px"><strong>${formattedTime}</strong></p>
          ${interviewLocation ? `<p><strong>Location:</strong> ${interviewLocation}</p>` : ""}
          ${managerName ? `<p><strong>Ask for:</strong> ${managerName}</p>` : ""}
          ${noteLine}
          <p>NATA Today will send a reminder before your interview.</p>
        </div>
      `,
    });

    await sendSms({
      to: candidatePhone,
      body: `NATA Today: Your interview with ${dealerName} for ${role} is scheduled for ${formattedTime}.${managerName ? ` Ask for ${managerName}.` : ""}${interviewLocation ? ` Location: ${interviewLocation}.` : ""}`,
    });

    return NextResponse.redirect(
      new URL(`/dealer/${dealerSlug}/dashboard?schedule=confirmed`, request.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("Schedule dealer interview failed:", error);
    return NextResponse.json({ error: "Dealer interview scheduling failed." }, { status: 500 });
  }
}
