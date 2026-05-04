import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  markCandidatePlacedFromApplication,
  returnApplicationToCandidatePool,
} from "../../../../lib/nataCandidatePool";

const POOL_STATUSES = [
  "not_hired",
  "rejected",
  "not_selected",
  "no_show",
];

const PLACED_STATUSES = [
  "hired",
  "placed",
  "dealer_hired",
];

const KEEP_WARM_STATUSES = [
  "keep_warm",
  "needs_followup",
];

type AnyRow = Record<string, any>;

function normalize(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

async function safeUpdateApplication(applicationId: string, payload: AnyRow) {
  const attempts: AnyRow[] = [
    payload,
    Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          ![
            "packet_status",
            "interview_packet_status",
            "packet_closed_at",
            "archived_at",
            "placement_completed_at",
            "placed_at",
          ].includes(key),
      ),
    ),
    Object.fromEntries(
      Object.entries(payload).filter(
        ([key]) =>
          ![
            "packet_status",
            "interview_packet_status",
            "packet_closed_at",
            "archived_at",
            "placement_completed_at",
            "placed_at",
            "dealer_hired_at",
            "last_rejected_at",
          ].includes(key),
      ),
    ),
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update(attempt)
      .eq("id", applicationId);

    if (!error) return null;
    lastError = error;

    const message = String(error.message || "").toLowerCase();
    if (!message.includes("column") && !message.includes("schema cache")) {
      break;
    }
  }

  return lastError;
}

async function safeCloseJob(jobId: string, applicationId: string, decisionReason: string, now: string) {
  const attempts: AnyRow[] = [
    {
      is_active: false,
      publish_status: "filled",
      filled_at: now,
      filled_by_application_id: applicationId,
      filled_note: decisionReason,
      closed_reason: "filled",
      updated_at: now,
    },
    {
      is_active: false,
      publish_status: "filled",
      filled_at: now,
      filled_note: decisionReason,
      closed_reason: "filled",
      updated_at: now,
    },
    {
      is_active: false,
      publish_status: "filled",
      filled_at: now,
      updated_at: now,
    },
  ];

  for (const attempt of attempts) {
    const { error } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .update(attempt)
      .eq("id", jobId);

    if (!error) return;

    const message = String(error.message || "").toLowerCase();
    if (!message.includes("column") && !message.includes("schema cache")) {
      console.error("Failed to close filled job:", error);
      return;
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      job_id,
      application_id,
      outcome,
      decision_reason,
      interviewer_name,
      interview_type,
      interview_stage,
      strengths,
      concerns,
      verification_flags,
      compensation_alignment,
      availability_alignment,
    } = body;

    if (!job_id || !application_id) {
      return NextResponse.json(
        { error: "Missing job_id or application_id" },
        { status: 400 },
      );
    }

    if (!decision_reason || !String(decision_reason).trim()) {
      return NextResponse.json(
        { error: "Decision reason is required." },
        { status: 400 },
      );
    }

    const normalizedOutcome = normalize(outcome);

    const { data: application, error: applicationError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (applicationError || !application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    const decisionPayload: AnyRow = {
      status: normalizedOutcome,
      decision_reason,
      updated_at: now,
    };

    if (interviewer_name !== undefined) {
      decisionPayload.dealer_interviewer_name = interviewer_name || null;
    }

    if (interview_type !== undefined) {
      decisionPayload.dealer_interview_type = interview_type || null;
    }

    if (interview_stage !== undefined) {
      decisionPayload.dealer_interview_stage = interview_stage || null;
    }

    if (strengths !== undefined) {
      decisionPayload.dealer_interview_strengths = strengths;
    }

    if (concerns !== undefined) {
      decisionPayload.dealer_interview_concerns = concerns;
    }

    if (verification_flags !== undefined) {
      decisionPayload.dealer_verification_flags = verification_flags;
    }

    if (compensation_alignment !== undefined) {
      decisionPayload.compensation_alignment = compensation_alignment || null;
    }

    if (availability_alignment !== undefined) {
      decisionPayload.availability_alignment = availability_alignment || null;
    }

    if (PLACED_STATUSES.includes(normalizedOutcome)) {
      decisionPayload.status = "placed";
      decisionPayload.screening_status = "placed";
      decisionPayload.dealer_hired_at = now;
      decisionPayload.placed_at = now;
      decisionPayload.placement_completed_at = now;
      decisionPayload.packet_status = "closed";
      decisionPayload.interview_packet_status = "closed";
      decisionPayload.packet_closed_at = now;
      decisionPayload.archived_at = now;
    }

    if (POOL_STATUSES.includes(normalizedOutcome)) {
      decisionPayload.last_rejected_at = now;
    }

    const updateError = await safeUpdateApplication(application_id, decisionPayload);

    if (updateError) {
      console.error("Failed to update application decision:", updateError);
      return NextResponse.json(
        { error: "Decision could not be recorded." },
        { status: 500 },
      );
    }

    if (PLACED_STATUSES.includes(normalizedOutcome)) {
      await markCandidatePlacedFromApplication(application_id);
      await safeCloseJob(job_id, application_id, decision_reason, now);

      return NextResponse.json({
        ok: true,
        job_closed: true,
        packet_closed: true,
        archived: true,
      });
    }

    let returnedCandidate = null;

    if (POOL_STATUSES.includes(normalizedOutcome)) {
      returnedCandidate = await returnApplicationToCandidatePool({
        applicationId: application_id,
        source: "dealer_rejected",
        reason: decision_reason,
      });
    }

    if (KEEP_WARM_STATUSES.includes(normalizedOutcome)) {
      const email = String(application.email || application.candidate_email || "")
        .trim()
        .toLowerCase();

      if (email) {
        const { error: warmError } = await supabaseAdmin
          .schema("nata")
          .from("candidates")
          .update({
            availability_status: "warm",
            updated_at: now,
          })
          .eq("email", email);

        if (warmError) {
          console.error("Failed to mark candidate warm:", warmError);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      job_closed: false,
      returned_to_pool: Boolean(returnedCandidate),
      candidate_id: returnedCandidate?.id || null,
    });
  } catch (error) {
    console.error("Decision failed:", error);

    return NextResponse.json(
      { error: "Decision failed" },
      { status: 500 },
    );
  }
}
