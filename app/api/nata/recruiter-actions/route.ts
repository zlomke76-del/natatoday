import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCandidateScheduleUrl, sendInterviewInvite } from "@/lib/nataNotifications";
import { returnApplicationToCandidatePool } from "@/lib/nataCandidatePool";

type AnyRow = Record<string, any>;

const WAITING_STATUSES = new Set(["virtual_invited", "invited"]);
const TERMINAL_STATUSES = new Set([
  "placed",
  "hired",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
  "archived",
  "closed",
  "not_hired",
  "not_selected",
  "dealer_rejected",
  "no_show",
  "withdrawn",
  "candidate_unresponsive",
  "invite_expired",
  "not_fit",
  "passed",
  "pass",
  "rejected",
]);

function clean(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function label(value: unknown, fallback = "Candidate") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function redirectToDashboard(request: NextRequest, recruiterSlug: string, params?: Record<string, string>) {
  const slug = recruiterSlug || "don";
  const url = new URL(`/recruiter/${slug}/dashboard`, request.url);

  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value);
  }

  if (params?.anchor) {
    url.hash = params.anchor;
    url.searchParams.delete("anchor");
  }

  return NextResponse.redirect(url, { status: 303 });
}

function hasAnyTerminalState(application: AnyRow) {
  return [application.status, application.screening_status, application.virtual_interview_status]
    .map(normalize)
    .some((status) => TERMINAL_STATUSES.has(status));
}

function isWaitingOnCandidate(application: AnyRow) {
  if (hasAnyTerminalState(application)) return false;
  if (application.virtual_interview_completed_at) return false;

  return [application.status, application.screening_status, application.virtual_interview_status]
    .map(normalize)
    .some((status) => WAITING_STATUSES.has(status));
}

async function loadApplication(applicationId: string, recruiterId: string) {
  const { data: application, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("recruiter_id", recruiterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!application) throw new Error("Application not found for this recruiter.");

  return application as AnyRow;
}

async function loadRecruiter(recruiterId: string) {
  const { data: recruiter, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,name,slug")
    .eq("id", recruiterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!recruiter) throw new Error("Recruiter not found.");

  return recruiter as AnyRow;
}

async function loadJob(jobId: string | null | undefined) {
  if (!jobId) return null;

  const { data: job, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load job for recruiter action:", error);
    return null;
  }

  return (job || null) as AnyRow | null;
}

async function sendInviteSafely(input: {
  application: AnyRow;
  job: AnyRow | null;
  recruiter: AnyRow;
  bookingUrl: string;
}) {
  try {
    await sendInterviewInvite({
      applicationId: String(input.application.id),
      candidateName: label(input.application.name || input.application.email, "Candidate"),
      candidateEmail: input.application.email || null,
      candidatePhone: input.application.phone || null,
      roleTitle: label(input.job?.title || input.application.role, "Candidate"),
      dealerName: label(input.job?.public_dealer_name || input.job?.dealer_slug, "Dealer"),
      recruiterName: label(input.recruiter.name, "your recruiter"),
      bookingUrl: input.bookingUrl,
    });
  } catch (notificationError) {
    console.error("Recruiter action notification failed:", notificationError);
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const action = clean(formData.get("action"));
  const applicationId = clean(formData.get("application_id"));
  const recruiterId = clean(formData.get("recruiter_id"));
  const recruiterSlug = clean(formData.get("recruiter_slug"));
  const reason = clean(formData.get("reason"));

  try {
    if (!action || !applicationId || !recruiterId) {
      return redirectToDashboard(request, recruiterSlug, { action: "missing" });
    }

    const [application, recruiter] = await Promise.all([
      loadApplication(applicationId, recruiterId),
      loadRecruiter(recruiterId),
    ]);

    if (hasAnyTerminalState(application) && action !== "reengage_waiting") {
      return redirectToDashboard(request, recruiterSlug || String(recruiter.slug || "don"), {
        action: "terminal_blocked",
      });
    }

    const now = new Date().toISOString();
    const job = await loadJob(application.job_id);
    const safeRecruiterSlug = recruiterSlug || String(recruiter.slug || "don");
    const previousReason = label(application.decision_reason, "");

    if (action === "approve_interview") {
      const bookingUrl = buildCandidateScheduleUrl(applicationId);
      const note = reason || "Recruiter approved candidate for virtual interview after review.";

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "virtual_invited",
          screening_status: "virtual_invited",
          virtual_interview_status: "invited",
          virtual_interview_url: bookingUrl,
          decision_reason: note,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await sendInviteSafely({ application, job, recruiter, bookingUrl });

      return redirectToDashboard(request, safeRecruiterSlug, { action: "invited" });
    }

    if (action === "reengage_waiting") {
      if (!isWaitingOnCandidate(application)) {
        return redirectToDashboard(request, safeRecruiterSlug, {
          action: "not_waiting",
          anchor: "candidate-scheduling-pending",
        });
      }

      const bookingUrl = buildCandidateScheduleUrl(applicationId);
      const note = `[Candidate re-engaged ${now}] ${reason || "Recruiter re-engaged candidate after schedule invite went stale."}`;

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "virtual_invited",
          screening_status: "virtual_invited",
          virtual_interview_status: "invited",
          virtual_interview_url: bookingUrl,
          decision_reason: previousReason ? `${previousReason}\n${note}` : note,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await sendInviteSafely({ application, job, recruiter, bookingUrl });

      return redirectToDashboard(request, safeRecruiterSlug, {
        action: "reengaged",
        anchor: "candidate-scheduling-pending",
      });
    }

    if (action === "remove_waiting") {
      if (!isWaitingOnCandidate(application)) {
        return redirectToDashboard(request, safeRecruiterSlug, {
          action: "not_waiting",
          anchor: "candidate-scheduling-pending",
        });
      }

      const note = `[Scheduling queue removal ${now}] ${reason || "Candidate removed from scheduling queue after stale or inactive response state."}`;

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "withdrawn",
          screening_status: "withdrawn",
          virtual_interview_status: "withdrawn",
          decision_reason: previousReason ? `${previousReason}\n${note}` : note,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await returnApplicationToCandidatePool({
        applicationId,
        source: "withdrawn",
        reason: reason || "Removed from stale scheduling queue.",
      });

      return redirectToDashboard(request, safeRecruiterSlug, {
        action: "removed",
        anchor: "candidate-scheduling-pending",
      });
    }

    if (action === "hold_candidate") {
      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "needs_review",
          screening_status: "needs_review",
          decision_reason: reason || "Recruiter hold: more candidate proof required before interview.",
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      return redirectToDashboard(request, safeRecruiterSlug, { action: "held" });
    }

    if (action === "pass_candidate") {
      const passReason = reason || "Recruiter passed candidate after role-specific review.";

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "not_fit",
          screening_status: "not_fit",
          decision_reason: passReason,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await returnApplicationToCandidatePool({
        applicationId,
        source: "recruiter_rejected",
        reason: passReason,
      });

      return redirectToDashboard(request, safeRecruiterSlug, { action: "passed" });
    }

    return redirectToDashboard(request, safeRecruiterSlug, { action: "unknown" });
  } catch (error) {
    console.error("POST /api/nata/recruiter-actions failed:", error);
    return redirectToDashboard(request, recruiterSlug || "don", { action: "error" });
  }
}
