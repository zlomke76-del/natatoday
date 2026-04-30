import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type ScreenDecision = "not_fit" | "virtual_invited" | "needs_review";

function scoreApplication(input: {
  job: any;
  candidateName: string;
  coverNote: string;
  linkedin: string;
  resumeUrl: string;
}) {
  const jobText = [
    input.job?.title,
    input.job?.description,
    input.job?.requirements,
    input.job?.role_hook,
    ...(input.job?.responsibilities || []),
    ...(input.job?.fit_signals || []),
    input.job?.process_note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const candidateText = [
    input.candidateName,
    input.coverNote,
    input.linkedin,
    input.resumeUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 45;
  const strengths: string[] = [];
  const gaps: string[] = [];

  const keywords = Array.from(
    new Set(
      jobText
        .split(/\s+/)
        .map((word) => word.replace(/[^a-z0-9]/g, ""))
        .filter((word) => word.length > 5)
    )
  ).slice(0, 60);

  const matches = keywords.filter((word) => candidateText.includes(word)).length;

  if (matches >= 10) {
    score += 20;
    strengths.push("Strong overlap with role-specific requirements.");
  } else if (matches >= 5) {
    score += 12;
    strengths.push("Some overlap with role-specific requirements.");
  } else {
    score -= 8;
    gaps.push("Limited visible overlap with role-specific requirements.");
  }

  if (candidateText.includes("automotive") || candidateText.includes("dealership")) {
    score += 12;
    strengths.push("Automotive or dealership experience indicated.");
  }

  if (candidateText.includes("sales") || candidateText.includes("customer")) {
    score += 8;
    strengths.push("Customer-facing or sales-related signal present.");
  }

  if (candidateText.includes("technician") || candidateText.includes("ase") || candidateText.includes("diagnostic")) {
    score += 12;
    strengths.push("Technical or certification-related signal present.");
  }

  if (candidateText.includes("available") || candidateText.includes("weekend") || candidateText.includes("full-time")) {
    score += 6;
    strengths.push("Availability signal present.");
  }

  if (!input.resumeUrl) {
    score -= 15;
    gaps.push("Resume was not provided.");
  }

  if (!input.coverNote && !input.linkedin && !input.resumeUrl) {
    score -= 20;
    gaps.push("Limited supporting information provided.");
  }

  const fitScore = Math.max(0, Math.min(100, score));
  let decision: ScreenDecision = "needs_review";

  if (fitScore >= 70) decision = "virtual_invited";
  if (fitScore < 45) decision = "not_fit";

  return {
    fitScore,
    decision,
    strengths,
    gaps,
    screeningSummary:
      decision === "virtual_invited"
        ? "Candidate appears aligned with the job post and is ready for a virtual screening interview."
        : decision === "not_fit"
          ? "Candidate does not appear to match the current role based on available application information."
          : "Candidate shows partial alignment and should be reviewed before an interview invitation.",
    decisionReason:
      decision === "virtual_invited"
        ? "Sufficient application signals matched the stored job post."
        : decision === "not_fit"
          ? "Insufficient fit signals for the current role."
          : "Borderline fit requiring human review.",
  };
}

function buildVirtualInterviewLink(applicationId: string) {
  const base = process.env.NATA_VIRTUAL_INTERVIEW_URL || process.env.NEXT_PUBLIC_APP_URL || "https://natatoday.vercel.app";
  if (base.includes("?")) return `${base}&application=${applicationId}`;
  return `${base}?application=${applicationId}`;
}

async function sendCandidateEmail(input: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NATA_FROM_EMAIL || "Solace Recruiting <no-reply@natatoday.com>";

  if (!apiKey) {
    console.log("RESEND_API_KEY not set. Candidate email skipped:", input.subject);
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Candidate email failed:", detail);
    return { skipped: false, error: detail };
  }

  return { skipped: false };
}

function buildEmail(input: {
  candidateName: string;
  candidateEmail: string;
  job: any;
  decision: ScreenDecision;
  virtualInterviewUrl: string | null;
}) {
  const firstName = input.candidateName.split(" ")[0] || "there";
  const title = input.job?.title || "the role";
  const dealer = input.job?.publish_mode === "confidential"
    ? "a confidential dealership"
    : input.job?.public_dealer_name || "the dealership";

  if (input.decision === "virtual_invited") {
    return {
      to: input.candidateEmail,
      subject: `Next step for ${title}`,
      body: `Hi ${firstName},\n\nThanks for applying for the ${title} role with ${dealer}.\n\nYour application looks like a potential fit, and we would like to invite you to complete a virtual screening interview.\n\nStart here:\n${input.virtualInterviewUrl}\n\nThank you,\nSolace Recruiting`,
    };
  }

  if (input.decision === "not_fit") {
    return {
      to: input.candidateEmail,
      subject: `Update on your ${title} application`,
      body: `Hi ${firstName},\n\nThank you for applying for the ${title} role. After reviewing the information provided, this role does not appear to be the strongest fit at this time.\n\nWe appreciate your interest and may keep your information in mind for future opportunities that better match your background.\n\nThank you,\nSolace Recruiting`,
    };
  }

  return {
    to: input.candidateEmail,
    subject: `Application received for ${title}`,
    body: `Hi ${firstName},\n\nThanks for applying for the ${title} role. Your application has been received and is being reviewed.\n\nIf your background matches the next step, you’ll hear from us with additional instructions.\n\nThank you,\nSolace Recruiting`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");

    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const applicationId = String(body.application_id || "").trim();

    if (!applicationId) {
      return NextResponse.json(
        { error: "application_id is required" },
        { status: 400 }
      );
    }

    const { data: application, error: appError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select(
        `
        id,
        job_id,
        name,
        email,
        phone,
        linkedin,
        resume_url,
        cover_note,
        status,
        jobs (
          id,
          title,
          slug,
          dealer_slug,
          location,
          type,
          salary,
          description,
          requirements,
          role_hook,
          responsibilities,
          fit_signals,
          process_note,
          publish_mode,
          public_dealer_name,
          public_location,
          confidential_note
        )
      `
      )
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const job = Array.isArray(application.jobs)
      ? application.jobs[0]
      : application.jobs;

    const result = scoreApplication({
      job,
      candidateName: application.name || "",
      coverNote: application.cover_note || "",
      linkedin: application.linkedin || "",
      resumeUrl: application.resume_url || "",
    });

    const nextStatus =
      result.decision === "virtual_invited"
        ? "virtual_invited"
        : result.decision === "not_fit"
          ? "not_fit"
          : "needs_review";

    const virtualInterviewUrl =
      result.decision === "virtual_invited"
        ? buildVirtualInterviewLink(applicationId)
        : null;

    const { data: updated, error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: nextStatus,
        screening_status: nextStatus,
        fit_score: result.fitScore,
        screening_summary: result.screeningSummary,
        decision_reason: result.decisionReason,
        virtual_interview_url: virtualInterviewUrl,
      })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    if (application.email) {
      await sendCandidateEmail(
        buildEmail({
          candidateName: application.name || "",
          candidateEmail: application.email,
          job,
          decision: result.decision,
          virtualInterviewUrl,
        })
      );
    }

    return NextResponse.json({
      ok: true,
      application: updated,
      decision: result.decision,
      fit_score: result.fitScore,
      screening_summary: result.screeningSummary,
      decision_reason: result.decisionReason,
      strengths: result.strengths,
      gaps: result.gaps,
      next_action:
        result.decision === "virtual_invited"
          ? "Candidate virtual interview invite sent or queued."
          : result.decision === "not_fit"
            ? "Candidate not-fit response sent or queued."
            : "Candidate routed for human review.",
    });
  } catch (error) {
    console.error("Application screening error:", error);
    return NextResponse.json(
      { error: "Application screening failed." },
      { status: 500 }
    );
  }
}
