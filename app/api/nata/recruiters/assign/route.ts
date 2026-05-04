import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AssignmentMode = "manual" | "suggest" | "auto" | "auto_one" | "auto_all" | "rebalance_one";

type RecruiterRow = {
  id: string;
  name: string | null;
  slug: string | null;
  role: string | null;
  status: string | null;
  is_active: boolean | null;
  permissions?: Record<string, unknown> | null;
};

type ApplicationRow = {
  id: string;
  name: string | null;
  status: string | null;
  screening_status: string | null;
  recruiter_id: string | null;
  assigned_recruiter: string | null;
  fit_score: number | null;
  created_at: string | null;
  virtual_interview_status: string | null;
  job_id: string | null;
  jobs?: {
    id?: string | null;
    dealer_id?: string | null;
    title?: string | null;
    public_dealer_name?: string | null;
    dealer_slug?: string | null;
  } | null;
  dealer_assigned_recruiter_id?: string | null;
};

type DealerRow = {
  id: string;
  name: string | null;
  slug: string | null;
  assigned_recruiter_id: string | null;
  multi_store_group: string | null;
};

type BookingRow = {
  id: string;
  recruiter_id: string | null;
  status: string | null;
  starts_at: string | null;
};

type LoadSnapshot = {
  recruiter: RecruiterRow;
  assignedCount: number;
  interviewCount: number;
  completedRecentCount: number;
  loadScore: number;
};

const BACKLOG_THRESHOLD = 10;
const LOAD_VARIANCE_THRESHOLD = 6;
const DON_OVERLOAD_THRESHOLD = 15;
const MAX_AUTO_ASSIGNMENTS_PER_RUN = 12;

const TERMINAL_APPLICATION_STATUSES = new Set([
  "archived",
  "closed",
  "completed_placement",
  "dealer_hired",
  "dealer_rejected",
  "hired",
  "not_fit",
  "not_hired",
  "not_selected",
  "no_show",
  "pass",
  "passed",
  "placed",
  "placement_complete",
  "rejected",
  "withdrawn",
]);

function clean(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

async function readRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return {
      applicationId: clean(body.applicationId),
      recruiterId: clean(body.recruiterId),
      mode: clean(body.mode || body.intent || "manual") as AssignmentMode,
      wantsJson: true,
    };
  }

  const formData = await request.formData();
  return {
    applicationId: clean(formData.get("applicationId")),
    recruiterId: clean(formData.get("recruiterId")),
    mode: clean(formData.get("mode") || formData.get("intent") || "manual") as AssignmentMode,
    wantsJson: false,
  };
}

function redirectToAdmin(request: NextRequest, params?: Record<string, string | number | null | undefined>) {
  const url = new URL("/recruiter/admin", request.url);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return NextResponse.redirect(url, { status: 303 });
}

function respond(
  request: NextRequest,
  wantsJson: boolean,
  payload: Record<string, unknown>,
  params?: Record<string, string | number | null | undefined>,
  status = 200,
) {
  if (wantsJson) return NextResponse.json(payload, { status });
  if (status >= 400) return redirectToAdmin(request, { assign: "error", ...params });
  return redirectToAdmin(request, params || { assign: "updated" });
}

function isTerminalApplication(application: Pick<ApplicationRow, "status" | "screening_status" | "virtual_interview_status">) {
  const statuses = [
    application.status,
    application.screening_status,
    application.virtual_interview_status,
  ].map(normalize);

  return statuses.some((status) => TERMINAL_APPLICATION_STATUSES.has(status));
}

function isActiveRecruiter(recruiter: RecruiterRow) {
  const status = normalize(recruiter.status);
  const role = normalize(recruiter.role);
  const permissions = recruiter.permissions || {};

  if (recruiter.is_active === false) return false;
  if (["suspended", "inactive", "invited"].includes(status)) return false;
  if (role === "agent" && permissions.can_interview !== true) return false;

  return role === "admin" || role === "recruiter" || permissions.can_interview === true;
}

function isInterviewBacklog(application: ApplicationRow) {
  const status = normalize(application.status);
  const screening = normalize(application.screening_status);
  const virtualStatus = normalize(application.virtual_interview_status);

  if (isTerminalApplication(application)) return false;
  if (virtualStatus === "completed" || status === "virtual_completed") return false;

  return (
    status === "virtual_invited" ||
    status === "virtual_scheduled" ||
    status === "needs_review" ||
    screening === "virtual_invited" ||
    screening === "needs_review" ||
    (typeof application.fit_score === "number" && application.fit_score >= 70)
  );
}

function isOpenAssignedWork(application: ApplicationRow) {
  if (!application.recruiter_id) return false;
  if (isTerminalApplication(application)) return false;

  const status = normalize(application.status);
  const virtualStatus = normalize(application.virtual_interview_status);

  if (virtualStatus === "completed" || status === "virtual_completed") return false;
  return true;
}

function isActiveBooking(booking: BookingRow) {
  const status = normalize(booking.status);
  return !!booking.recruiter_id && !["cancelled", "canceled", "completed", "no_show"].includes(status);
}

function isCompletedRecently(application: ApplicationRow) {
  if (isTerminalApplication(application)) return false;

  const status = normalize(application.status);
  const virtualStatus = normalize(application.virtual_interview_status);
  const createdAt = application.created_at ? new Date(application.created_at).getTime() : 0;
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return (status === "virtual_completed" || virtualStatus === "completed") && createdAt >= oneDayAgo;
}

function findDon(recruiters: RecruiterRow[]) {
  return recruiters.find((recruiter) => normalize(recruiter.name).includes("don"));
}

function dealerPreferredRecruiterId(application: ApplicationRow) {
  return application.dealer_assigned_recruiter_id || null;
}

function buildLoadSnapshots(input: {
  recruiters: RecruiterRow[];
  applications: ApplicationRow[];
  bookings: BookingRow[];
}) {
  const activeRecruiters = input.recruiters.filter(isActiveRecruiter);
  const snapshots = new Map<string, LoadSnapshot>();

  for (const recruiter of activeRecruiters) {
    snapshots.set(recruiter.id, {
      recruiter,
      assignedCount: 0,
      interviewCount: 0,
      completedRecentCount: 0,
      loadScore: 0,
    });
  }

  for (const application of input.applications) {
    if (!application.recruiter_id) continue;
    const snapshot = snapshots.get(application.recruiter_id);
    if (!snapshot) continue;

    if (isOpenAssignedWork(application)) snapshot.assignedCount += 1;
    if (isCompletedRecently(application)) snapshot.completedRecentCount += 1;
  }

  for (const booking of input.bookings) {
    if (!booking.recruiter_id || !isActiveBooking(booking)) continue;
    const snapshot = snapshots.get(booking.recruiter_id);
    if (!snapshot) continue;
    snapshot.interviewCount += 1;
  }

  for (const snapshot of snapshots.values()) {
    snapshot.loadScore = snapshot.assignedCount + snapshot.interviewCount * 3 - snapshot.completedRecentCount * 2;
  }

  return Array.from(snapshots.values()).sort((a, b) => a.loadScore - b.loadScore);
}

function chooseRecruiter(input: {
  application: ApplicationRow;
  snapshots: LoadSnapshot[];
  don?: RecruiterRow;
  allowDealerDefault: boolean;
  forceOverflow: boolean;
}) {
  if (isTerminalApplication(input.application)) return null;

  const preferredId = dealerPreferredRecruiterId(input.application);
  const preferred = preferredId ? input.snapshots.find((item) => item.recruiter.id === preferredId) : undefined;

  if (input.allowDealerDefault && preferred && !input.forceOverflow) {
    return { snapshot: preferred, reason: "dealer_default" };
  }

  const eligible = input.snapshots.filter((snapshot) => {
    if (!snapshot.recruiter.id) return false;
    if (input.don && snapshot.recruiter.id === input.don.id && snapshot.loadScore >= DON_OVERLOAD_THRESHOLD) {
      return false;
    }
    return true;
  });

  const fallback = eligible[0] || input.snapshots[0];
  if (!fallback) return null;

  return {
    snapshot: fallback,
    reason: preferred && input.forceOverflow ? "overflow_from_dealer_default" : "lowest_load",
  };
}

async function loadAssignmentContext() {
  const [recruitersResult, applicationsResult, bookingsResult, dealersResult] = await Promise.all([
    supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("id,name,slug,role,status,is_active,permissions"),
    supabaseAdmin
      .schema("nata")
      .from("applications")
      .select(
        "id,name,status,screening_status,recruiter_id,assigned_recruiter,fit_score,created_at,virtual_interview_status,job_id,jobs(id,dealer_id,title,public_dealer_name,dealer_slug)",
      )
      .order("created_at", { ascending: true })
      .limit(500),
    supabaseAdmin
      .schema("nata")
      .from("interview_bookings")
      .select("id,recruiter_id,status,starts_at")
      .gte("starts_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500),
    supabaseAdmin
      .schema("nata")
      .from("dealers")
      .select("id,name,slug,assigned_recruiter_id,multi_store_group")
      .limit(500),
  ]);

  if (recruitersResult.error) throw new Error(recruitersResult.error.message);
  if (applicationsResult.error) throw new Error(applicationsResult.error.message);
  if (bookingsResult.error) throw new Error(bookingsResult.error.message);
  if (dealersResult.error) throw new Error(dealersResult.error.message);

  const recruiters = (recruitersResult.data || []) as RecruiterRow[];
  const dealerMap = new Map((dealersResult.data || []).map((dealer: DealerRow) => [dealer.id, dealer]));
  const applications = ((applicationsResult.data || []) as ApplicationRow[]).map((application) => {
    const dealerId = application.jobs?.dealer_id || null;
    const dealer = dealerId ? dealerMap.get(dealerId) : undefined;
    return {
      ...application,
      dealer_assigned_recruiter_id: dealer?.assigned_recruiter_id || null,
    };
  });

  const activeApplications = applications.filter((application) => !isTerminalApplication(application));
  const bookings = (bookingsResult.data || []) as BookingRow[];
  const snapshots = buildLoadSnapshots({ recruiters, applications: activeApplications, bookings });
  const backlog = activeApplications.filter(isInterviewBacklog);
  const unassignedBacklog = backlog.filter((application) => !application.recruiter_id);
  const don = findDon(recruiters);
  const donSnapshot = don ? snapshots.find((snapshot) => snapshot.recruiter.id === don.id) : undefined;
  const highest = snapshots.length ? Math.max(...snapshots.map((item) => item.loadScore)) : 0;
  const lowest = snapshots.length ? Math.min(...snapshots.map((item) => item.loadScore)) : 0;
  const loadVariance = highest - lowest;

  const pressureActive =
    backlog.length >= BACKLOG_THRESHOLD ||
    loadVariance >= LOAD_VARIANCE_THRESHOLD ||
    (donSnapshot?.loadScore || 0) >= DON_OVERLOAD_THRESHOLD;

  return {
    recruiters,
    applications: activeApplications,
    bookings,
    snapshots,
    backlog,
    unassignedBacklog,
    don,
    donSnapshot,
    loadVariance,
    pressureActive,
  };
}

async function loadApplicationForAssignment(applicationId: string) {
  const { data: application, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id,status,screening_status,virtual_interview_status")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!application) throw new Error("Application not found");
  return application as Pick<ApplicationRow, "status" | "screening_status" | "virtual_interview_status">;
}

async function updateApplicationAssignment(applicationId: string, recruiter: RecruiterRow | null) {
  if (recruiter) {
    const application = await loadApplicationForAssignment(applicationId);
    if (isTerminalApplication(application)) {
      throw new Error("Terminal candidates cannot be assigned or reactivated.");
    }
  }

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .update({
      recruiter_id: recruiter?.id || null,
      assigned_recruiter: recruiter?.name || null,
    })
    .eq("id", applicationId);

  if (error) throw new Error(error.message);
}

async function validateRecruiter(recruiterId: string) {
  const { data: recruiter, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,name,slug,role,status,is_active,permissions")
    .eq("id", recruiterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!recruiter) throw new Error("Recruiter not found");
  if (!isActiveRecruiter(recruiter as RecruiterRow)) {
    throw new Error("Cannot assign work to inactive, invited, suspended, or non-interview recruiter");
  }

  return recruiter as RecruiterRow;
}

export async function POST(request: NextRequest) {
  const input = await readRequest(request);
  const mode = input.mode || "manual";

  try {
    if (mode === "manual") {
      if (!input.applicationId) {
        return respond(request, input.wantsJson, { error: "Missing applicationId" }, { assign: "missing_application" }, 400);
      }

      const recruiter = input.recruiterId ? await validateRecruiter(input.recruiterId) : null;
      await updateApplicationAssignment(input.applicationId, recruiter);

      return respond(
        request,
        input.wantsJson,
        { success: true, mode: "manual", assignedTo: recruiter?.name || null },
        { assign: recruiter ? "manual" : "cleared" },
      );
    }

    const context = await loadAssignmentContext();

    if (mode === "suggest") {
      const targetApplication = input.applicationId
        ? context.applications.find((application) => application.id === input.applicationId && isInterviewBacklog(application))
        : context.unassignedBacklog[0];

      if (!targetApplication) {
        return respond(
          request,
          input.wantsJson,
          { success: true, mode: "suggest", message: "No eligible backlog candidates" },
          { assign: "no_eligible" },
        );
      }

      const selected = chooseRecruiter({
        application: targetApplication,
        snapshots: context.snapshots,
        don: context.don,
        allowDealerDefault: true,
        forceOverflow: context.pressureActive,
      });

      return respond(
        request,
        input.wantsJson,
        {
          success: true,
          mode: "suggest",
          pressureActive: context.pressureActive,
          applicationId: targetApplication.id,
          candidateName: targetApplication.name,
          suggestedRecruiterId: selected?.snapshot.recruiter.id || null,
          suggestedRecruiterName: selected?.snapshot.recruiter.name || null,
          reason: selected?.reason || null,
          backlogCount: context.backlog.length,
          loadVariance: context.loadVariance,
          donLoad: context.donSnapshot?.loadScore || 0,
        },
        {
          assign: selected?.snapshot.recruiter.name ? "suggested" : "no_suggestion",
          suggested: selected?.snapshot.recruiter.name || null,
        },
      );
    }

    if (!context.pressureActive && ["auto", "auto_one", "auto_all", "rebalance_one"].includes(mode)) {
      return respond(
        request,
        input.wantsJson,
        {
          success: true,
          mode: "no_auto",
          message: "Auto assignment held because workload pressure is below threshold.",
          backlogCount: context.backlog.length,
          loadVariance: context.loadVariance,
          donLoad: context.donSnapshot?.loadScore || 0,
        },
        { assign: "held", backlog: context.backlog.length },
      );
    }

    if (mode === "rebalance_one") {
      const overloaded = [...context.snapshots].sort((a, b) => b.loadScore - a.loadScore)[0];
      const underloaded = context.snapshots[0];

      if (!overloaded || !underloaded || overloaded.recruiter.id === underloaded.recruiter.id) {
        return respond(request, input.wantsJson, { success: false, error: "No rebalance target available" }, { assign: "no_rebalance" }, 400);
      }

      const candidate = context.backlog.find((application) => application.recruiter_id === overloaded.recruiter.id);
      if (!candidate) {
        return respond(request, input.wantsJson, { success: false, error: "No candidate available to rebalance" }, { assign: "no_rebalance" }, 400);
      }

      await updateApplicationAssignment(candidate.id, underloaded.recruiter);

      return respond(
        request,
        input.wantsJson,
        {
          success: true,
          mode: "rebalance_one",
          applicationId: candidate.id,
          from: overloaded.recruiter.name,
          assignedTo: underloaded.recruiter.name,
        },
        { assign: "rebalanced", to: underloaded.recruiter.name },
      );
    }

    const maxAssignments = mode === "auto_all" ? MAX_AUTO_ASSIGNMENTS_PER_RUN : 1;
    const eligibleApplications = input.applicationId
      ? context.applications.filter((application) => application.id === input.applicationId && isInterviewBacklog(application))
      : context.unassignedBacklog.slice(0, maxAssignments);

    if (eligibleApplications.length === 0) {
      return respond(request, input.wantsJson, { success: true, mode, assigned: 0 }, { assign: "no_eligible" });
    }

    const assigned: Array<{ applicationId: string; candidateName: string | null; recruiterName: string | null; reason: string }> = [];
    let liveSnapshots = [...context.snapshots];

    for (const application of eligibleApplications.slice(0, maxAssignments)) {
      if (application.recruiter_id && !input.applicationId) continue;
      if (isTerminalApplication(application)) continue;

      const selected = chooseRecruiter({
        application,
        snapshots: liveSnapshots,
        don: context.don,
        allowDealerDefault: true,
        forceOverflow: context.pressureActive,
      });

      if (!selected) continue;

      await updateApplicationAssignment(application.id, selected.snapshot.recruiter);
      assigned.push({
        applicationId: application.id,
        candidateName: application.name,
        recruiterName: selected.snapshot.recruiter.name,
        reason: selected.reason,
      });

      liveSnapshots = liveSnapshots
        .map((snapshot) =>
          snapshot.recruiter.id === selected.snapshot.recruiter.id
            ? { ...snapshot, assignedCount: snapshot.assignedCount + 1, loadScore: snapshot.loadScore + 1 }
            : snapshot,
        )
        .sort((a, b) => a.loadScore - b.loadScore);
    }

    return respond(
      request,
      input.wantsJson,
      {
        success: true,
        mode,
        assignedCount: assigned.length,
        assigned,
        backlogCount: context.backlog.length,
        loadVariance: context.loadVariance,
        donLoad: context.donSnapshot?.loadScore || 0,
      },
      { assign: assigned.length ? "auto" : "no_eligible", count: assigned.length },
    );
  } catch (error) {
    console.error("POST /api/nata/recruiters/assign failed:", error);

    return respond(
      request,
      input.wantsJson,
      { error: error instanceof Error ? error.message : "Recruiter assignment failed" },
      { assign: "error" },
      500,
    );
  }
}
