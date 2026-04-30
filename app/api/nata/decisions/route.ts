import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type DecisionOutcome =
  | "hired"
  | "not_hired"
  | "keep_warm"
  | "no_show"
  | "needs_followup";

const OUTCOMES = new Set<DecisionOutcome>([
  "hired",
  "not_hired",
  "keep_warm",
  "no_show",
  "needs_followup",
]);

const APPLICATION_STATUS_BY_OUTCOME: Record<DecisionOutcome, string> = {
  hired: "placed",
  not_hired: "not_hired",
  keep_warm: "keep_warm",
  no_show: "no_show",
  needs_followup: "needs_followup",
};

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => clean(item))
    .filter(Boolean);
}

function isDecisionOutcome(value: string): value is DecisionOutcome {
  return OUTCOMES.has(value as DecisionOutcome);
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");

    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const jobId = clean(body.job_id);
    const applicationId = clean(body.application_id);
    const interviewerName = clean(body.interviewer_name);
    const outcome = clean(body.outcome);
    const decisionReason = clean(body.decision_reason);

    if (!jobId) {
      return NextResponse.json({ error: "job_id is required" }, { status: 400 });
    }

    if (!applicationId) {
      return NextResponse.json(
        { error: "application_id is required" },
        { status: 400 }
      );
    }

    if (!isDecisionOutcome(outcome)) {
      return NextResponse.json(
        {
          error:
            "Outcome must be hired, not_hired, keep_warm, no_show, or needs_followup.",
        },
        { status: 400 }
      );
    }

    if (!decisionReason) {
      return NextResponse.json(
        { error: "A decision reason is required." },
        { status: 400 }
      );
    }

    const decisionPayload = {
      job_id: jobId,
      application_id: applicationId,
      interviewer_name: interviewerName || null,
      interview_type: clean(body.interview_type, "dealer"),
      interview_stage: clean(body.interview_stage, "2"),
      outcome,
      decision_reason: decisionReason,
      strengths: cleanArray(body.strengths),
      concerns: cleanArray(body.concerns),
      verification_flags: cleanArray(body.verification_flags),
      compensation_alignment: clean(body.compensation_alignment) || null,
      availability_alignment: clean(body.availability_alignment) || null,
    };

    const { data: decisionRecord, error: decisionError } = await supabaseAdmin
      .schema("nata")
      .from("decision_records")
      .insert(decisionPayload)
      .select("*")
      .single();

    if (decisionError) {
      console.error("Decision record insert failed:", decisionError);
      return NextResponse.json(
        { error: decisionError.message || "Decision record could not be created." },
        { status: 500 }
      );
    }

    const applicationStatus = APPLICATION_STATUS_BY_OUTCOME[outcome];

    const { error: applicationError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        screening_status: applicationStatus,
        decision_reason: decisionReason,
      })
      .eq("id", applicationId);

    if (applicationError) {
      console.error("Application status update failed:", applicationError);
      return NextResponse.json(
        {
          error:
            applicationError.message ||
            "Decision was recorded, but application status could not be updated.",
        },
        { status: 500 }
      );
    }

    if (outcome === "hired") {
      const { error: jobError } = await supabaseAdmin
        .schema("nata")
        .from("jobs")
        .update({
          publish_status: "filled",
          is_active: false,
        })
        .eq("id", jobId);

      if (jobError) {
        console.error("Job close update failed:", jobError);
        return NextResponse.json(
          {
            error:
              jobError.message ||
              "Decision was recorded, but the public listing could not be closed.",
          },
          { status: 500 }
        );
      }

      await supabaseAdmin
        .schema("nata")
        .from("candidate_outreach")
        .update({ outreach_status: "suppressed" })
        .eq("job_id", jobId)
        .in("outreach_status", ["pending", "approved"]);
    }

    return NextResponse.json({
      decision_record: decisionRecord,
      application_status: applicationStatus,
      job_closed: outcome === "hired",
    });
  } catch (error) {
    console.error("Decision submission failed:", error);
    return NextResponse.json(
      { error: "Decision submission failed." },
      { status: 500 }
    );
  }
}
