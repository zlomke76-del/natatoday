import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type ScreenDecision =
  | "not_fit"
  | "virtual_invited"
  | "needs_review";

function scoreApplication(input: {
  jobTitle: string;
  coverNote: string;
  linkedin: string;
  resumeUrl: string;
}) {
  const text = `${input.jobTitle} ${input.coverNote} ${input.linkedin} ${input.resumeUrl}`.toLowerCase();

  let score = 50;
  const strengths: string[] = [];
  const gaps: string[] = [];

  if (text.includes("dealership") || text.includes("automotive")) {
    score += 15;
    strengths.push("Automotive or dealership experience indicated.");
  }

  if (text.includes("sales") || text.includes("customer")) {
    score += 10;
    strengths.push("Customer-facing or sales-related signal present.");
  }

  if (text.includes("technician") || text.includes("ase") || text.includes("diagnostic")) {
    score += 15;
    strengths.push("Technical/service experience signal present.");
  }

  if (text.includes("available") || text.includes("weekend") || text.includes("full-time")) {
    score += 8;
    strengths.push("Availability signal present.");
  }

  if (!input.coverNote && !input.resumeUrl && !input.linkedin) {
    score -= 25;
    gaps.push("Limited supporting information provided.");
  }

  if (!input.resumeUrl) {
    gaps.push("Resume not provided.");
  }

  const fitScore = Math.max(0, Math.min(100, score));

  let decision: ScreenDecision = "needs_review";

  if (fitScore >= 70) {
    decision = "virtual_invited";
  } else if (fitScore < 45) {
    decision = "not_fit";
  }

  return {
    fitScore,
    decision,
    strengths,
    gaps,
    screeningSummary:
      decision === "virtual_invited"
        ? "Candidate appears ready for a virtual screening interview based on available application signals."
        : decision === "not_fit"
          ? "Candidate does not appear to match the current role based on available information."
          : "Candidate may be viable, but additional review is needed before interview invitation.",
    decisionReason:
      decision === "virtual_invited"
        ? "Sufficient fit signals to invite candidate to virtual screening."
        : decision === "not_fit"
          ? "Insufficient fit signals for this role at this time."
          : "Application requires human review before next step.",
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
          salary
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
      jobTitle: job?.title || "",
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

    const { data: updated, error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: nextStatus,
        screening_status: nextStatus,
        fit_score: result.fitScore,
        screening_summary: result.screeningSummary,
        decision_reason: result.decisionReason,
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
          ? "Send candidate virtual interview invite."
          : result.decision === "not_fit"
            ? "Send candidate not-fit response."
            : "Route candidate for human review.",
    });
  } catch (error) {
    console.error("Application screening error:", error);
    return NextResponse.json(
      { error: "Application screening failed." },
      { status: 500 }
    );
  }
}
