import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { hasDealerAccess } from "../../../../lib/dealerAccess";
import ActionNotice from "./ActionNotice";

type PageProps = {
  params: {
    dealerSlug: string;
  };
  searchParams?: {
    request?: string;
    role?: string;
    decision?: string;
    candidate?: string;
    schedule?: string;
    active?: string;
  };
};

type AnyRow = Record<string, any>;

type ManagerCandidate = {
  id: string;
  applicationId: string;
  jobId: string;
  name: string;
  role: string;
  status: string;
  dealerInterviewAt: string;
  summary: string;
  notes: string[];
  resumeUrl: string;
  photoUrl: string;
  nataNotes: string;
  interviewQuestions: string[];
  verificationItems: string[];
  fitScore: number | null;
};

type ReadyScheduleCandidate = {
  id: string;
  applicationId: string;
  jobId: string;
  name: string;
  role: string;
  status: string;
  summary: string;
  notes: string[];
  resumeUrl: string;
  photoUrl: string;
  nataNotes: string;
  interviewQuestions: string[];
  verificationItems: string[];
  fitScore: number | null;
};

const roleOptions = [
  "Sales Consultant",
  "Service Technician",
  "Service Advisor",
  "BDC Representative",
  "Parts Advisor",
  "Finance Manager",
];

const priorityOptions = ["Standard", "Urgent", "Pipeline build"];

const paySuggestions: Record<string, string> = {
  "Sales Consultant": "$45,000 - $95,000 per year",
  "Service Technician": "$28 - $45 per hour",
  "Service Advisor": "$55,000 - $95,000 per year",
  "BDC Representative": "$18 - $24 per hour + bonus",
  "Parts Advisor": "$20 - $30 per hour",
  "Finance Manager": "$95,000 - $180,000 per year",
};

const DEALER_SCHEDULE_REQUESTED_STATUS = "dealer_schedule_requested";

const MANAGER_VISIBLE_STATUSES = new Set([
  "dealer_interview_scheduled",
  "dealer_review",
]);

function formatDealerName(slug: string) {
  if (slug === "jersey-village-cdjr") {
    return "Jersey Village Chrysler Jeep Dodge Ram";
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDealerLocation(slug: string) {
  if (slug === "jersey-village-cdjr") return "Jersey Village, TX";
  return "Houston, TX Market";
}

function cleanFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getBaseUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function getApplicationStatus(application: AnyRow) {
  return String(
    application.screening_status ||
      application.status ||
      application.application_status ||
      "new",
  );
}

function getCandidateName(application: AnyRow) {
  return String(
    application.candidate_name ||
      application.full_name ||
      application.name ||
      application.applicant_name ||
      application.email ||
      "Candidate",
  );
}

function getCandidateEmail(application: AnyRow) {
  return String(application.email || application.candidate_email || "");
}

function getApplicationSummary(application: AnyRow) {
  return String(
    application.screening_summary ||
      application.summary ||
      application.decision_reason ||
      application.cover_note ||
      "Candidate packet is ready for manager review.",
  );
}

function getResumeUrl(application: AnyRow) {
  return String(
    application.resume_url ||
      application.resume_path ||
      application.resume_public_url ||
      "",
  );
}

function getCandidatePhotoUrl(application: AnyRow) {
  return String(
    application.profile_photo_url ||
      application.photo_url ||
      application.candidate_photo_url ||
      application.headshot_url ||
      "",
  );
}

function getDealerInterviewAt(application: AnyRow) {
  const value =
    application.dealer_interview_at ||
    application.manager_interview_at ||
    application.interview_at ||
    null;

  return typeof value === "string" && value.trim() ? value : null;
}

function hasReadyPacket(application: AnyRow) {
  const explicitReady =
    application.packet_ready === true ||
    application.interview_packet_ready === true ||
    application.packet_status === "ready" ||
    application.interview_packet_status === "ready";

  if (explicitReady) return true;

  const status = getApplicationStatus(application);
  const hasInterview = Boolean(getDealerInterviewAt(application));
  const hasSummary = Boolean(getApplicationSummary(application));
  const hasResume = Boolean(getResumeUrl(application));

  return (
    MANAGER_VISIBLE_STATUSES.has(status) &&
    hasInterview &&
    hasSummary &&
    hasResume
  );
}

function formatInterviewTime(value: string | null) {
  if (!value) return "Interview scheduled";

  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(value));
  } catch {
    return "Interview scheduled";
  }
}

function splitList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(String)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getCandidateTags(application: AnyRow) {
  const directTags = splitList(
    application.notes || application.tags || application.fit_signals,
  );

  if (directTags.length > 0) return directTags.slice(0, 4);

  const status = getApplicationStatus(application);
  const tags = ["Packet ready", "Interview scheduled"];

  if (application.fit_score || application.fitScore) {
    tags.push(`Fit score ${application.fit_score || application.fitScore}`);
  }

  if (status === "dealer_review") tags.push("Dealer review");

  return tags;
}

function getInterviewQuestions(role: string, application: AnyRow) {
  const existing = splitList(
    application.interview_questions ||
      application.manager_questions ||
      application.suggested_questions,
  );

  if (existing.length > 0) return existing.slice(0, 5);

  const lower = role.toLowerCase();

  if (lower.includes("technician")) {
    return [
      "Walk me through the repair or diagnostic work you are strongest in.",
      "What certifications, tools, or shop experience should we verify today?",
      "How do you communicate delays, findings, or additional repair needs to the advisor?",
      "What schedule and compensation structure are you looking for?",
    ];
  }

  if (lower.includes("advisor")) {
    return [
      "How do you handle a customer who is frustrated about cost or timing?",
      "How do you stay organized when multiple repair orders are moving at once?",
      "What service-lane metrics or processes have you worked with before?",
      "What would help you succeed quickly in this store?",
    ];
  }

  if (lower.includes("bdc")) {
    return [
      "How do you organize follow-up when several customers need contact the same day?",
      "What makes a phone or text follow-up feel helpful instead of pushy?",
      "Tell me about a time you turned a cold or stalled lead into an appointment.",
      "What schedule and call volume are you comfortable supporting?",
    ];
  }

  if (lower.includes("sales")) {
    return [
      "Walk me through how you follow up with a customer who is interested but not ready to buy today.",
      "Tell me about a time you had to explain a higher-priced product to a hesitant customer.",
      "How do you stay organized when multiple customers, calls, and appointments are in motion?",
      "What would help you ramp quickly in this dealership environment?",
    ];
  }

  return [
    "What about this role is the strongest fit for your background?",
    "What should we verify before making a hiring decision?",
    "What schedule, compensation, or start-date details matter for you?",
    "What would help you succeed quickly in this dealership environment?",
  ];
}

function getVerificationItems(role: string, application: AnyRow) {
  const existing = splitList(
    application.verification_items ||
      application.verification_flags ||
      application.remaining_verification_flags,
  );

  if (existing.length > 0) return existing.slice(0, 5);

  const lower = role.toLowerCase();
  const defaults = [
    "Confirm schedule",
    "Confirm start date",
    "Confirm compensation alignment",
  ];

  if (lower.includes("technician")) {
    return [
      "Confirm certifications",
      "Confirm tool availability",
      ...defaults,
    ].slice(0, 5);
  }

  if (lower.includes("sales") || lower.includes("bdc")) {
    return [
      "Confirm weekend availability",
      "Confirm follow-up expectations",
      ...defaults,
    ].slice(0, 5);
  }

  return defaults;
}

function buildNataNotes(application: AnyRow, role: string) {
  const existing = String(
    application.nata_notes ||
      application.packet_notes ||
      application.interview_packet_notes ||
      "",
  ).trim();

  if (existing) return existing;

  const summary = getApplicationSummary(application);
  const fitScore = application.fit_score || application.fitScore;
  const fitScoreLine = fitScore ? ` Fit score: ${fitScore}.` : "";

  return `NATA review: ${summary}${fitScoreLine} Use the manager interview to verify role fit, availability, compensation alignment, and any remaining concerns before a final hiring decision.`;
}

function toReadyScheduleCandidate(
  application: AnyRow,
  job: AnyRow | undefined,
): ReadyScheduleCandidate | null {
  const status = getApplicationStatus(application);

  if (status !== DEALER_SCHEDULE_REQUESTED_STATUS) return null;
  if (!hasReadyPacket(application)) return null;

  const role = String(
    job?.title || application.role || application.job_title || "Role",
  );

  return {
    id: String(application.id),
    applicationId: String(application.id),
    jobId: String(application.job_id || job?.id || ""),
    name: getCandidateName(application),
    role,
    status,
    summary: getApplicationSummary(application),
    notes: getCandidateTags(application),
    resumeUrl: getResumeUrl(application),
    photoUrl: getCandidatePhotoUrl(application),
    nataNotes: buildNataNotes(application, role),
    interviewQuestions: getInterviewQuestions(role, application),
    verificationItems: getVerificationItems(role, application),
    fitScore:
      typeof application.fit_score === "number" ? application.fit_score : null,
  };
}

function toManagerCandidate(
  application: AnyRow,
  job: AnyRow | undefined,
): ManagerCandidate | null {
  const status = getApplicationStatus(application);
  const dealerInterviewAt = getDealerInterviewAt(application);

  if (!MANAGER_VISIBLE_STATUSES.has(status)) return null;
  if (!dealerInterviewAt) return null;
  if (!hasReadyPacket(application)) return null;

  const role = String(
    job?.title || application.role || application.job_title || "Role",
  );

  return {
    id: String(application.id),
    applicationId: String(application.id),
    jobId: String(application.job_id || job?.id || ""),
    name: getCandidateName(application),
    role,
    status,
    dealerInterviewAt,
    summary: getApplicationSummary(application),
    notes: getCandidateTags(application),
    resumeUrl: getResumeUrl(application),
    photoUrl: getCandidatePhotoUrl(application),
    nataNotes: buildNataNotes(application, role),
    interviewQuestions: getInterviewQuestions(role, application),
    verificationItems: getVerificationItems(role, application),
    fitScore:
      typeof application.fit_score === "number" ? application.fit_score : null,
  };
}

function getDecisionStatusFromOutcome(outcome: string) {
  if (outcome === "hired") return "placed";
  if (outcome === "not_hired") return "not_hired";
  if (outcome === "keep_warm") return "keep_warm";
  if (outcome === "no_show") return "no_show";
  if (outcome === "needs_followup") return "needs_followup";
  return "dealer_review";
}

async function loadDashboardData(dealerSlug: string) {
  noStore();

  const { data: jobsData, error: jobsError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("dealer_slug", dealerSlug)
    .order("created_at", { ascending: false });

  if (jobsError) {
    console.error("Failed to load dealer jobs:", jobsError);
  }

  const jobs = (jobsData || []) as AnyRow[];
  const jobIds = jobs.map((job) => String(job.id)).filter(Boolean);

  let applications: AnyRow[] = [];
  let decisions: AnyRow[] = [];

  if (jobIds.length > 0) {
    const { data: applicationsData, error: applicationsError } =
      await supabaseAdmin
        .schema("nata")
        .from("applications")
        .select("*")
        .in("job_id", jobIds)
        .order("created_at", { ascending: false });

    if (applicationsError) {
      console.error("Failed to load dealer applications:", applicationsError);
    } else {
      applications = (applicationsData || []) as AnyRow[];
    }

    const { data: decisionsData, error: decisionsError } = await supabaseAdmin
      .schema("nata")
      .from("decision_records")
      .select("*")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    if (decisionsError) {
      console.error("Failed to load decision records:", decisionsError);
    } else {
      decisions = (decisionsData || []) as AnyRow[];
    }
  }

  const jobById = new Map(jobs.map((job) => [String(job.id), job]));

  const readyScheduleCandidates = applications
    .map((application) =>
      toReadyScheduleCandidate(
        application,
        jobById.get(String(application.job_id)),
      ),
    )
    .filter((candidate): candidate is ReadyScheduleCandidate =>
      Boolean(candidate),
    );

  const managerCandidates = applications
    .map((application) =>
      toManagerCandidate(application, jobById.get(String(application.job_id))),
    )
    .filter((candidate): candidate is ManagerCandidate => Boolean(candidate));

  const openJobs = jobs.filter(
    (job) => job.is_active !== false && job.publish_status !== "filled",
  );

  const filledJobs = jobs.filter(
    (job) => job.publish_status === "filled" || job.is_active === false,
  );

  return {
    jobs,
    applications,
    decisions,
    readyScheduleCandidates,
    managerCandidates,
    openJobs,
    filledJobs,
  };
}

function findActiveAction(
  activeId: string,
  readyScheduleCandidates: ReadyScheduleCandidate[],
  managerCandidates: ManagerCandidate[],
) {
  const activeReady = readyScheduleCandidates.find(
    (candidate) => candidate.applicationId === activeId || candidate.id === activeId,
  );

  if (activeReady) {
    return {
      type: "schedule" as const,
      candidate: activeReady,
      index: readyScheduleCandidates.findIndex(
        (candidate) => candidate.applicationId === activeReady.applicationId,
      ),
      total: readyScheduleCandidates.length + managerCandidates.length,
    };
  }

  const activeManager = managerCandidates.find(
    (candidate) => candidate.applicationId === activeId || candidate.id === activeId,
  );

  if (activeManager) {
    return {
      type: "decision" as const,
      candidate: activeManager,
      index:
        readyScheduleCandidates.length +
        managerCandidates.findIndex(
          (candidate) => candidate.applicationId === activeManager.applicationId,
        ),
      total: readyScheduleCandidates.length + managerCandidates.length,
    };
  }

  const firstReady = readyScheduleCandidates[0];

  if (firstReady) {
    return {
      type: "schedule" as const,
      candidate: firstReady,
      index: 0,
      total: readyScheduleCandidates.length + managerCandidates.length,
    };
  }

  const firstManager = managerCandidates[0];

  if (firstManager) {
    return {
      type: "decision" as const,
      candidate: firstManager,
      index: readyScheduleCandidates.length,
      total: readyScheduleCandidates.length + managerCandidates.length,
    };
  }

  return null;
}

export default async function DealerDashboardPage({
  params,
  searchParams,
}: PageProps) {
  const dealerName = formatDealerName(params.dealerSlug);

  if (!hasDealerAccess(params.dealerSlug)) {
    return (
      <main className="shell">
        <Nav />
        <section className="wrap" style={{ padding: "70px 0 110px" }}>
          <div
            style={{
              maxWidth: 760,
              padding: 34,
              borderRadius: 30,
              border: "1px solid rgba(255,255,255,0.12)",
              background:
                "linear-gradient(145deg, rgba(20,115,255,0.13), rgba(255,255,255,0.045))",
            }}
          >
            <div className="eyebrow">Secure Dealer Access</div>
            <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>
              Access required.
            </h1>
            <p className="lede">
              This dealer workspace is protected. Complete enrollment through
              Stripe or use the secure access link issued after checkout.
            </p>
            <p style={{ color: "#9fb4d6", lineHeight: 1.6, marginTop: 18 }}>
              If your subscription is already active, contact NATA Today and we
              can resend the secure access link for this dealership.
            </p>
          </div>
        </section>
      </main>
    );
  }
  const dealerLocation = getDealerLocation(params.dealerSlug);
  const requestSubmitted = searchParams?.request === "submitted";
  const requestClosed = searchParams?.request === "closed";
  const decisionSaved = searchParams?.decision === "saved";
  const scheduleRequested = searchParams?.schedule === "requested";
  const scheduleConfirmed = searchParams?.schedule === "confirmed";
  const submittedRole = searchParams?.role
    ? decodeURIComponent(searchParams.role)
    : "Hiring request";
  const decisionCandidate = searchParams?.candidate
    ? decodeURIComponent(searchParams.candidate)
    : "Candidate";

  const {
    applications,
    decisions,
    readyScheduleCandidates,
    managerCandidates,
    openJobs,
    filledJobs,
  } = await loadDashboardData(params.dealerSlug);

  const activeAction = findActiveAction(
    searchParams?.active ? decodeURIComponent(searchParams.active) : "",
    readyScheduleCandidates,
    managerCandidates,
  );

  async function submitHiringRequest(formData: FormData) {
    "use server";

    const title = cleanFormValue(formData.get("role"));
    const priority = cleanFormValue(formData.get("priority")) || "Standard";
    const salary = cleanFormValue(formData.get("payRange"));
    const needBy = cleanFormValue(formData.get("needBy"));
    const notes = cleanFormValue(formData.get("notes"));
    const publishMode =
      cleanFormValue(formData.get("publish_mode")) || "public";
    const interviewPocName = cleanFormValue(formData.get("interview_poc_name"));
    const interviewPocTitle = cleanFormValue(formData.get("interview_poc_title"));
    const interviewPocPhone = cleanFormValue(formData.get("interview_poc_phone"));
    const interviewPocEmail = cleanFormValue(formData.get("interview_poc_email"));
    const backupInterviewPocName = cleanFormValue(
      formData.get("backup_interview_poc_name"),
    );
    const backupInterviewPocPhone = cleanFormValue(
      formData.get("backup_interview_poc_phone"),
    );
    const backupInterviewPocEmail = cleanFormValue(
      formData.get("backup_interview_poc_email"),
    );
    const preferredInterviewWindows = cleanFormValue(
      formData.get("preferred_interview_windows"),
    );

    if (!title) {
      throw new Error(
        "Role is required before a hiring request can be submitted.",
      );
    }

    const adminKey = process.env.NATA_ADMIN_KEY;
    if (!adminKey) {
      throw new Error(
        "Missing NATA_ADMIN_KEY. Add it to Vercel before submitting hiring requests.",
      );
    }

    const response = await fetch(`${getBaseUrl()}/api/nata/jobs`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-nata-admin-key": adminKey,
      },
      body: JSON.stringify({
        title,
        dealer_slug: params.dealerSlug,
        location: dealerLocation,
        public_location: dealerLocation,
        public_dealer_name: dealerName,
        type: "Full-time",
        salary,
        priority,
        need_by: needBy || null,
        notes,
        request_notes: notes,
        publish_mode: publishMode,
        publish_status: "published",
        is_active: true,
        interview_poc_name: interviewPocName || null,
        interview_poc_title: interviewPocTitle || null,
        interview_poc_phone: interviewPocPhone || null,
        interview_poc_email: interviewPocEmail || null,
        backup_interview_poc_name: backupInterviewPocName || null,
        backup_interview_poc_phone: backupInterviewPocPhone || null,
        backup_interview_poc_email: backupInterviewPocEmail || null,
        preferred_interview_windows: preferredInterviewWindows || null,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.error || "Hiring request could not be published.",
      );
    }

    redirect(
      `/dealer/${params.dealerSlug}/dashboard?request=submitted&role=${encodeURIComponent(
        title,
      )}`,
    );
  }

  async function closeHiringRequest(formData: FormData) {
    "use server";

    const jobId = cleanFormValue(formData.get("job_id"));
    const jobTitle =
      cleanFormValue(formData.get("job_title")) || "Hiring request";
    const closedReason =
      cleanFormValue(formData.get("closed_reason")) || "walk_in_candidate";
    const filledNote = cleanFormValue(formData.get("filled_note"));

    if (!jobId) {
      throw new Error("Job id is required before a request can be removed.");
    }

    const note =
      filledNote ||
      (closedReason === "walk_in_candidate"
        ? "Dealer removed request because the position was filled by a walk-in candidate."
        : "Dealer removed request from active board.");

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .update({
        publish_status: "filled",
        is_active: false,
        filled_at: new Date().toISOString(),
        filled_note: note,
        closed_reason: closedReason,
      })
      .eq("id", jobId)
      .eq("dealer_slug", params.dealerSlug);

    if (error) {
      console.error("Failed to remove dealer hiring request:", error);
      throw new Error("Hiring request could not be removed from the board.");
    }

    redirect(
      `/dealer/${params.dealerSlug}/dashboard?request=closed&role=${encodeURIComponent(
        jobTitle,
      )}`,
    );
  }

  async function submitInterviewDecision(formData: FormData) {
    "use server";

    const jobId = cleanFormValue(formData.get("job_id"));
    const applicationId = cleanFormValue(formData.get("application_id"));
    const interviewerName = cleanFormValue(formData.get("interviewer_name"));
    const outcome = cleanFormValue(formData.get("outcome"));
    const decisionReason = cleanFormValue(formData.get("decision_reason"));
    const candidateName = cleanFormValue(formData.get("candidate_name"));

    if (!jobId || !applicationId || !outcome || !decisionReason) {
      throw new Error(
        "Outcome and reason are required before saving a decision.",
      );
    }

    const { error: decisionError } = await supabaseAdmin
      .schema("nata")
      .from("decision_records")
      .insert({
        job_id: jobId,
        application_id: applicationId,
        interviewer_name: interviewerName || null,
        interview_type: "dealer",
        interview_stage: "2",
        outcome,
        decision_reason: decisionReason,
        strengths: [],
        concerns: [],
        verification_flags: [],
      });

    if (decisionError) {
      console.error("Failed to create decision record:", decisionError);
      throw new Error("Interview decision could not be saved.");
    }

    const nextApplicationStatus = getDecisionStatusFromOutcome(outcome);

    const { error: applicationError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        screening_status: nextApplicationStatus,
        decision_reason: decisionReason,
      })
      .eq("id", applicationId);

    if (applicationError) {
      console.error(
        "Failed to update application after decision:",
        applicationError,
      );
      throw new Error("Application status could not be updated.");
    }

    if (outcome === "hired") {
      const { error: jobError } = await supabaseAdmin
        .schema("nata")
        .from("jobs")
        .update({
          publish_status: "filled",
          is_active: false,
          filled_at: new Date().toISOString(),
          filled_by_application_id: applicationId,
          filled_note: decisionReason,
          closed_reason: "filled",
        })
        .eq("id", jobId);

      if (jobError) {
        console.error("Failed to close filled job:", jobError);
        throw new Error("Filled job could not be closed.");
      }
    }

    redirect(
      `/dealer/${params.dealerSlug}/dashboard?decision=saved&candidate=${encodeURIComponent(
        candidateName || "Candidate",
      )}`,
    );
  }

  return (
    <main className="shell">
      <Nav />

      <section className="wrap" style={{ padding: "46px 0 90px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 24,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 760 }}>
            <div className="eyebrow">Dealer Operating View</div>

            <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>
              {dealerName} hiring pipeline.
            </h1>

            <p className="lede">
              Submit hiring requests, track open roles, and act only when a
              manager interview is scheduled with a completed packet. Our team
              handles posting, screening, candidate routing, and interview
              packet preparation before anything lands on your board.
            </p>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 20,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              minWidth: 240,
            }}
          >
            <strong style={{ color: "#fff", display: "block" }}>
              {dealerName}
            </strong>
            <span style={{ color: "#9fb4d6", display: "block", marginTop: 6 }}>
              Monthly pipeline program active
            </span>
          </div>
        </div>

        {requestSubmitted ? (
          <ActionNotice
            title={`${submittedRole} request received.`}
            copy="NATA Today will handle posting, screening, routing, and packet preparation."
          />
        ) : null}

        {requestClosed ? (
          <ActionNotice
            title={`${submittedRole} request closed.`}
            copy="Removed from active hiring. Candidates remain archived."
          />
        ) : null}

        {decisionSaved ? (
          <ActionNotice
            title={`${decisionCandidate} decision saved.`}
            copy="The interview decision has been documented."
          />
        ) : null}

        {scheduleRequested ? (
          <ActionNotice
            title="Dealer scheduling request sent."
            copy="The dealer has been notified by dashboard alert, email, and SMS where available."
          />
        ) : null}

        {scheduleConfirmed ? (
          <ActionNotice
            title="Manager interview scheduled."
            copy="The candidate has been notified by email and SMS where available."
          />
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.95fr) minmax(360px, 0.75fr)",
            gap: 22,
            marginTop: 34,
            alignItems: "start",
          }}
        >
          <section
            style={{
              padding: 28,
              borderRadius: 26,
              background:
                "linear-gradient(145deg, rgba(20,115,255,0.14), rgba(255,255,255,0.045))",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              New hiring request
            </div>

            <h2
              style={{
                margin: 0,
                color: "#fff",
                fontSize: 34,
                lineHeight: 1,
                letterSpacing: "-0.045em",
              }}
            >
              Tell us what you need filled.
            </h2>

            <p style={{ color: "#bfd6f5", lineHeight: 1.6, marginTop: 12 }}>
              Submit the role, pay range, urgency, visibility preference, and
              notes. NATA Today formats the post, handles publication, and opens
              the candidate pipeline.
            </p>

            <form action={submitHiringRequest} style={{ marginTop: 24 }}>
              <div className="grid-2" style={{ gap: 16 }}>
                <Field label="Role needed">
                  <select
                    name="role"
                    defaultValue=""
                    required
                    style={inputStyle}
                  >
                    <option value="" disabled>
                      Select role
                    </option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority">
                  <select
                    name="priority"
                    defaultValue="Standard"
                    style={inputStyle}
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Target pay range">
                  <input
                    name="payRange"
                    placeholder="Example: $55,000 - $95,000 per year"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Need by">
                  <input name="needBy" type="date" style={inputStyle} />
                </Field>

                <Field label="Publishing mode">
                  <select
                    name="publish_mode"
                    defaultValue="public"
                    style={inputStyle}
                  >
                    <option value="public">Public dealership posting</option>
                    <option value="confidential">Confidential search</option>
                  </select>
                </Field>
              </div>

              <details style={drawerStyle}>
                <summary style={drawerSummaryStyle}>
                  Interview POC and preferred windows
                </summary>

                <p style={{ color: "#bfd6f5", lineHeight: 1.5, margin: "12px 0 0" }}>
                  Add the manager contact now so scheduling is fast when a
                  recommendation packet is ready.
                </p>

                <div className="grid-2" style={{ gap: 16, marginTop: 14 }}>
                  <Field label="Primary interview POC">
                    <input
                      name="interview_poc_name"
                      placeholder="Example: Sales Manager"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="POC title">
                    <input
                      name="interview_poc_title"
                      placeholder="Example: General Sales Manager"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="POC phone">
                    <input
                      name="interview_poc_phone"
                      placeholder="+1..."
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="POC email">
                    <input
                      name="interview_poc_email"
                      type="email"
                      placeholder="manager@dealer.com"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Backup POC">
                    <input
                      name="backup_interview_poc_name"
                      placeholder="Optional backup contact"
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Backup phone">
                    <input
                      name="backup_interview_poc_phone"
                      placeholder="+1..."
                      style={inputStyle}
                    />
                  </Field>

                  <Field label="Backup email">
                    <input
                      name="backup_interview_poc_email"
                      type="email"
                      placeholder="backup@dealer.com"
                      style={inputStyle}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 14 }}>
                  <Field label="Preferred interview windows">
                    <textarea
                      name="preferred_interview_windows"
                      rows={3}
                      placeholder="Example: Tuesdays and Thursdays, 2–5 PM. Saturdays before noon if urgent."
                      style={inputStyle}
                    />
                  </Field>
                </div>
              </details>

              <details style={drawerStyle}>
                <summary style={drawerSummaryStyle}>Suggested pay ranges</summary>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    marginTop: 12,
                    color: "#cfe2ff",
                    lineHeight: 1.55,
                    fontSize: 14,
                  }}
                >
                  {Object.entries(paySuggestions).map(([role, pay]) => (
                    <span key={role}>
                      {role}: <strong style={{ color: "#fff" }}>{pay}</strong>
                    </span>
                  ))}
                </div>
              </details>

              <div style={{ marginTop: 18 }}>
                <Field label="Notes for this request">
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Example: Need strong closers, Saturday availability, Spanish preferred, dealership experience helpful."
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button className="btn btn-primary" type="submit">
                  Send request to NATA team
                </button>

                <span style={{ color: "#9fb4d6", fontSize: 14 }}>
                  Your team does not need to build or review the public post.
                </span>
              </div>
            </form>
          </section>

          <InterviewCoordinationPanel
            dealerSlug={params.dealerSlug}
            readyScheduleCandidates={readyScheduleCandidates}
            managerCandidates={managerCandidates}
            activeApplicationId={activeAction?.candidate.applicationId || ""}
          />
        </div>

        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Open requests</div>

          {openJobs.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              {openJobs.map((job) => {
                const jobApplications = applications.filter(
                  (application) =>
                    String(application.job_id) === String(job.id),
                );
                const readyCount = jobApplications.filter((application) =>
                  MANAGER_VISIBLE_STATUSES.has(
                    getApplicationStatus(application),
                  ),
                ).length;

                return (
                  <details
                    key={job.id}
                    style={{
                      padding: 18,
                      borderRadius: 24,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <summary
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 14,
                        alignItems: "flex-start",
                        cursor: "pointer",
                        listStyle: "none",
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin: 0,
                            color: "#fff",
                            fontSize: 24,
                            lineHeight: 1,
                            letterSpacing: "-0.035em",
                          }}
                        >
                          {job.title || "Open role"}
                        </h3>
                        <p style={{ margin: "8px 0 0", color: "#bfd6f5" }}>
                          {job.salary || "Compensation reviewed by NATA"}
                        </p>
                      </div>

                      <span
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          background: "rgba(251,191,36,0.14)",
                          color: "#fbbf24",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {job.priority || "Active"}
                      </span>
                    </summary>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 10,
                        marginTop: 18,
                      }}
                    >
                      <Metric
                        label="Candidates"
                        value={jobApplications.length}
                      />
                      <Metric label="Ready" value={readyCount} />
                      <Metric
                        label="Status"
                        value={job.publish_status || "published"}
                      />
                    </div>

                    <p style={{ color: "#9fb4d6", margin: "16px 0 0" }}>
                      {readyCount > 0
                        ? "Manager-ready candidates are shown below."
                        : "NATA Today is screening and preparing candidates before handoff."}
                    </p>

                    <form
                      action={closeHiringRequest}
                      style={{
                        marginTop: 18,
                        paddingTop: 16,
                        borderTop: "1px solid rgba(255,255,255,0.09)",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <input
                        type="hidden"
                        name="job_id"
                        value={String(job.id)}
                      />
                      <input
                        type="hidden"
                        name="job_title"
                        value={String(job.title || "Hiring request")}
                      />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "minmax(0, 0.72fr) minmax(0, 1fr)",
                          gap: 10,
                          alignItems: "start",
                        }}
                      >
                        <Field label="Remove reason">
                          <select
                            name="closed_reason"
                            defaultValue="walk_in_candidate"
                            style={inputStyle}
                          >
                            <option value="walk_in_candidate">
                              Filled by walk-in candidate
                            </option>
                            <option value="internal_hire">
                              Filled internally
                            </option>
                            <option value="role_paused">Role paused</option>
                            <option value="no_longer_needed">
                              No longer needed
                            </option>
                          </select>
                        </Field>

                        <Field label="Optional note">
                          <input
                            name="filled_note"
                            placeholder="Example: Walk-in candidate accepted offer today."
                            style={inputStyle}
                          />
                        </Field>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ color: "#9fb4d6", fontSize: 13 }}>
                          Removes this request from the open board and records
                          the closure.
                        </span>
                        <button
                          className="btn btn-secondary"
                          type="submit"
                          style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                        >
                          Remove request
                        </button>
                      </div>
                    </form>
                  </details>
                );
              })}
            </div>
          ) : (
            <EmptyState copy="No open requests are active for this dealership yet." />
          )}
        </section>

        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Filled requests</div>

          {filledJobs.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 16,
                marginTop: 16,
              }}
            >
              {filledJobs.map((job) => {
                const hiredDecision = decisions.find(
                  (decision) =>
                    String(decision.job_id) === String(job.id) &&
                    String(decision.outcome) === "hired",
                );
                const application = applications.find(
                  (item) =>
                    String(item.id) === String(hiredDecision?.application_id),
                );

                return (
                  <article
                    key={job.id}
                    style={{
                      padding: 22,
                      borderRadius: 24,
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.18)",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "7px 10px",
                        borderRadius: 999,
                        background: "rgba(34,197,94,0.14)",
                        color: "#86efac",
                        fontSize: 12,
                        fontWeight: 950,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Filled
                    </span>

                    <h3
                      style={{
                        margin: "16px 0 0",
                        color: "#fff",
                        fontSize: 24,
                        lineHeight: 1,
                        letterSpacing: "-0.035em",
                      }}
                    >
                      {job.title || "Filled role"}
                    </h3>

                    <p style={{ margin: "10px 0 0", color: "#cfe2ff" }}>
                      Filled by{" "}
                      <strong style={{ color: "#fff" }}>
                        {application
                          ? getCandidateName(application)
                          : "documented hire"}
                      </strong>
                    </p>

                    <p style={{ color: "#9fb4d6", lineHeight: 1.55 }}>
                      {hiredDecision?.decision_reason ||
                        job.filled_note ||
                        "Decision documented."}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState copy="No filled requests have been documented yet." />
          )}
        </section>

        <section id="next-action" style={{ marginTop: 40, scrollMarginTop: 120 }}>
          <div className="eyebrow">Next action workspace</div>

          {activeAction ? (
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 18,
                  background: "rgba(20,115,255,0.08)",
                  border: "1px solid rgba(96,165,250,0.16)",
                  color: "#bfd6f5",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ color: "#fff" }}>
                  Action {activeAction.index + 1} of {activeAction.total}
                </strong>
                <span>
                  One action is open at a time. Use the queue above to switch
                  candidates.
                </span>
              </div>

              {activeAction.type === "schedule" ? (
                <ScheduleCandidateCard
                  candidate={activeAction.candidate}
                  dealerSlug={params.dealerSlug}
                />
              ) : (
                <DecisionCandidateCard
                  candidate={activeAction.candidate}
                  submitInterviewDecision={submitInterviewDecision}
                />
              )}
            </div>
          ) : (
            <div
              style={{
                marginTop: 16,
                padding: 28,
                borderRadius: 24,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#cfe2ff",
              }}
            >
              <h3 style={{ margin: 0, color: "#fff", fontSize: 24 }}>
                No action cards are ready.
              </h3>
              <p style={{ margin: "10px 0 0", lineHeight: 1.6 }}>
                NATA Today is still screening candidates, completing virtual
                interviews, requesting a manager interview time, or preparing
                interview packets. Candidates appear here only when dealer
                action is required.
              </p>
            </div>
          )}
        </section>

      </section>
    </main>
  );
}

function ScheduleCandidateCard({
  candidate,
  dealerSlug,
}: {
  candidate: ReadyScheduleCandidate;
  dealerSlug: string;
}) {
  return (
    <article
      id={`schedule-${candidate.applicationId}`}
      style={{
        padding: 22,
        borderRadius: 24,
        background:
          "linear-gradient(145deg, rgba(251,191,36,0.105), rgba(255,255,255,0.035))",
        border: "1px solid rgba(251,191,36,0.22)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "96px minmax(0, 1fr) auto",
          gap: 18,
          alignItems: "center",
        }}
      >
        <CandidatePhoto url={candidate.photoUrl} name={candidate.name} />

        <div>
          <h3
            style={{
              margin: 0,
              color: "#fff",
              fontSize: 28,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {candidate.name}
          </h3>

          <p style={{ margin: "8px 0 0", color: "#bfd6f5" }}>
            {candidate.role} · Ready for manager interview time
          </p>

          <p
            style={{
              color: "#9fb4d6",
              lineHeight: 1.55,
              margin: "10px 0 0",
            }}
          >
            {candidate.summary}
          </p>
        </div>

        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <StatusBadge status="Packet ready · schedule needed" />
          {candidate.fitScore !== null ? (
            <span
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                background: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.22)",
                color: "#fbbf24",
                fontSize: 12,
                fontWeight: 950,
              }}
            >
              Fit score {candidate.fitScore}
            </span>
          ) : null}
        </div>
      </div>

      <details
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 18,
          background: "rgba(255,255,255,0.045)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <summary
          style={{
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          View recommendation packet
        </summary>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "160px minmax(0, 0.75fr) minmax(0, 1.15fr)",
            gap: 12,
            marginTop: 14,
            alignItems: "stretch",
          }}
        >
          <PacketIdentityBlock
            name={candidate.name}
            role={candidate.role}
            photoUrl={candidate.photoUrl}
            fitScore={candidate.fitScore}
          />
          <ResumeBlock url={candidate.resumeUrl} />
          <QuestionBlock questions={candidate.interviewQuestions} />
        </div>

        <div style={{ marginTop: 12 }}>
          <PacketBlock title="NATA recommendation" copy={candidate.nataNotes} />
        </div>
      </details>

      <form
        method="POST"
        action={`/api/nata/applications/${candidate.applicationId}/schedule-dealer-interview`}
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <input type="hidden" name="dealer_slug" value={dealerSlug} />

        <h4 style={{ margin: "0 0 12px", color: "#fff", fontSize: 18 }}>
          Select optimal manager interview time
        </h4>

        <div className="grid-2" style={{ gap: 14 }}>
          <Field label="Interview date">
            <input name="interview_date" type="date" required style={inputStyle} />
          </Field>

          <Field label="Interview time">
            <input name="interview_time" type="time" required style={inputStyle} />
          </Field>

          <Field label="Manager / interviewer">
            <input
              name="manager_name"
              placeholder="Example: Sales Manager"
              required
              style={inputStyle}
            />
          </Field>

          <Field label="Interview location">
            <input
              name="interview_location"
              placeholder="Example: Sales office"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Optional note for candidate">
            <textarea
              name="dealer_schedule_note"
              rows={3}
              placeholder="Example: Please arrive 10 minutes early and ask for the sales manager."
              style={inputStyle}
            />
          </Field>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#9fb4d6", fontSize: 13 }}>
            Confirming a time moves this candidate into the decision workspace
            and notifies the candidate.
          </span>
          <button className="btn btn-primary" type="submit">
            Confirm interview time
          </button>
        </div>
      </form>
    </article>
  );
}

function DecisionCandidateCard({
  candidate,
  submitInterviewDecision,
}: {
  candidate: ManagerCandidate;
  submitInterviewDecision: (formData: FormData) => Promise<void>;
}) {
  return (
    <article
      id={`interview-${candidate.applicationId}`}
      style={{
        padding: 22,
        borderRadius: 24,
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "96px minmax(0, 1fr) auto",
          gap: 18,
          alignItems: "center",
        }}
      >
        <CandidatePhoto url={candidate.photoUrl} name={candidate.name} />

        <div>
          <h3
            style={{
              margin: 0,
              color: "#fff",
              fontSize: 28,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {candidate.name}
          </h3>

          <p style={{ margin: "8px 0 0", color: "#bfd6f5" }}>
            {candidate.role} · {formatInterviewTime(candidate.dealerInterviewAt)}
          </p>

          <p
            style={{
              color: "#9fb4d6",
              lineHeight: 1.55,
              margin: "10px 0 0",
            }}
          >
            {candidate.summary}
          </p>
        </div>

        <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
          <StatusBadge status="Packet ready · interview scheduled" />
          {candidate.fitScore !== null ? (
            <span
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                background: "rgba(251,191,36,0.12)",
                border: "1px solid rgba(251,191,36,0.22)",
                color: "#fbbf24",
                fontSize: 12,
                fontWeight: 950,
              }}
            >
              Fit score {candidate.fitScore}
            </span>
          ) : null}
        </div>
      </div>

      <details
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 18,
          background: "rgba(255,255,255,0.045)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        <summary
          style={{
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          View interview packet
        </summary>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "160px minmax(0, 0.75fr) minmax(0, 1.15fr)",
            gap: 12,
            marginTop: 14,
            alignItems: "stretch",
          }}
        >
          <PacketIdentityBlock
            name={candidate.name}
            role={candidate.role}
            photoUrl={candidate.photoUrl}
            fitScore={candidate.fitScore}
          />
          <ResumeBlock url={candidate.resumeUrl} />
          <QuestionBlock questions={candidate.interviewQuestions} />
        </div>

        <div style={{ marginTop: 12 }}>
          <PacketBlock title="NATA notes" copy={candidate.nataNotes} />
        </div>
      </details>

      <form
        action={submitInterviewDecision}
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 18,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <input type="hidden" name="job_id" value={candidate.jobId} />
        <input
          type="hidden"
          name="application_id"
          value={candidate.applicationId}
        />
        <input type="hidden" name="candidate_name" value={candidate.name} />

        <h4 style={{ margin: "0 0 12px", color: "#fff", fontSize: 18 }}>
          Interview outcome
        </h4>

        <div className="grid-2" style={{ gap: 14 }}>
          <Field label="Outcome">
            <select name="outcome" required defaultValue="" style={inputStyle}>
              <option value="" disabled>
                Select outcome
              </option>
              <option value="hired">Hired</option>
              <option value="not_hired">Not hired</option>
              <option value="keep_warm">Keep warm</option>
              <option value="no_show">No-show</option>
              <option value="needs_followup">Needs follow-up</option>
            </select>
          </Field>

          <Field label="Manager / interviewer">
            <input
              name="interviewer_name"
              placeholder="Example: Sales Manager"
              required
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field label="Why?">
            <textarea
              name="decision_reason"
              rows={3}
              placeholder="Required. Briefly document the reason for the decision."
              required
              style={inputStyle}
            />
          </Field>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span style={{ color: "#9fb4d6", fontSize: 13 }}>
            Hired closes the public listing. Other outcomes keep the role open.
          </span>
          <button className="btn btn-primary" type="submit">
            Save decision
          </button>
        </div>
      </form>
    </article>
  );
}

function InterviewCoordinationPanel({
  dealerSlug,
  readyScheduleCandidates,
  managerCandidates,
  activeApplicationId,
}: {
  dealerSlug: string;
  readyScheduleCandidates: ReadyScheduleCandidate[];
  managerCandidates: ManagerCandidate[];
  activeApplicationId: string;
}) {
  const upcoming = managerCandidates.slice(0, 4);
  const ready = readyScheduleCandidates.slice(0, 4);
  const totalActions = ready.length + upcoming.length;

  return (
    <aside
      style={{
        padding: 24,
        borderRadius: 26,
        background:
          "linear-gradient(145deg, rgba(251,191,36,0.105), rgba(20,115,255,0.075))",
        border: "1px solid rgba(251,191,36,0.2)",
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 12 }}>
        Interview coordination
      </div>

      <h2
        style={{
          margin: 0,
          color: "#fff",
          fontSize: 30,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        {totalActions > 0
          ? `${totalActions} interview action${totalActions === 1 ? "" : "s"} need attention.`
          : "No interview actions pending."}
      </h2>

      <p style={{ color: "#cfe2ff", lineHeight: 1.6, marginTop: 12 }}>
        This is your next-action queue. Click a card to load exactly one
        action below: schedule the interview or record the manager decision.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {ready.length > 0 ? (
          <>
            <div style={miniSectionTitleStyle}>Ready to schedule</div>
            {ready.map((candidate) => (
              <MiniCandidateCard
                key={candidate.id}
                name={candidate.name}
                role={candidate.role}
                photoUrl={candidate.photoUrl}
                meta="Packet ready · select manager time"
                tone="schedule"
                href={`/dealer/${dealerSlug}/dashboard?active=${encodeURIComponent(
                  candidate.applicationId,
                )}#next-action`}
                active={activeApplicationId === candidate.applicationId}
              />
            ))}
          </>
        ) : null}

        {upcoming.length > 0 ? (
          <>
            <div style={miniSectionTitleStyle}>Upcoming interviews</div>
            {upcoming.map((candidate) => (
              <MiniCandidateCard
                key={candidate.id}
                name={candidate.name}
                role={candidate.role}
                photoUrl={candidate.photoUrl}
                meta={formatInterviewTime(candidate.dealerInterviewAt)}
                tone="scheduled"
                href={`/dealer/${dealerSlug}/dashboard?active=${encodeURIComponent(
                  candidate.applicationId,
                )}#next-action`}
                active={activeApplicationId === candidate.applicationId}
              />
            ))}
          </>
        ) : null}

        {totalActions === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 18,
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#bfd6f5",
              lineHeight: 1.5,
            }}
          >
            No candidate is currently waiting on dealer scheduling or manager
            decision.
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function MiniCandidateCard({
  name,
  role,
  photoUrl,
  meta,
  tone,
  href,
  active,
}: {
  name: string;
  role: string;
  photoUrl: string;
  meta: string;
  tone: "schedule" | "scheduled";
  href: string;
  active: boolean;
}) {
  return (
    <a
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "56px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: 12,
        borderRadius: 18,
        background:
          tone === "schedule"
            ? "rgba(251,191,36,0.12)"
            : "rgba(34,197,94,0.10)",
        border: active
          ? "1px solid rgba(147,197,253,0.72)"
          : tone === "schedule"
            ? "1px solid rgba(251,191,36,0.22)"
            : "1px solid rgba(34,197,94,0.18)",
        boxShadow: active ? "0 0 0 3px rgba(59,130,246,0.18)" : "none",
        textDecoration: "none",
      }}
    >
      <CandidatePhoto url={photoUrl} name={name} size={56} radius={16} />
      <div>
        <strong style={{ color: "#fff", display: "block" }}>{name}</strong>
        <span
          style={{
            color: "#bfd6f5",
            display: "block",
            marginTop: 3,
            fontSize: 13,
          }}
        >
          {role}
        </span>
        <span
          style={{
            color: tone === "schedule" ? "#fde68a" : "#86efac",
            display: "block",
            marginTop: 5,
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          {meta}
        </span>
      </div>
      <span style={{ color: "#93c5fd", fontWeight: 950 }}>
        {active ? "Active" : "Open →"}
      </span>
    </a>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span style={{ color: "#d7e8ff", fontWeight: 800 }}>{label}</span>
      {children}
    </label>
  );
}

function ReviewPill({ title, copy }: { title: string; copy: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <strong style={{ color: "#fff", display: "block" }}>{title}</strong>
      <span
        style={{
          color: "#bfd6f5",
          display: "block",
          marginTop: 4,
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {copy}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <strong style={{ display: "block", color: "#fff", fontSize: 20 }}>
        {value}
      </strong>
      <span style={{ display: "block", color: "#9fb4d6", fontSize: 12 }}>
        {label}
      </span>
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return (
    <div
      style={{
        marginTop: 16,
        padding: 24,
        borderRadius: 22,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "#cfe2ff",
      }}
    >
      {copy}
    </div>
  );
}

function CandidatePhoto({
  url,
  name,
  size = 92,
  radius = 24,
}: {
  url: string;
  name: string;
  size?: number;
  radius?: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: "hidden",
        background: "rgba(20,115,255,0.14)",
        border: "1px solid rgba(147,197,253,0.24)",
        display: "grid",
        placeItems: "center",
        color: "#dbeafe",
        fontSize: Math.max(16, Math.round(size * 0.28)),
        fontWeight: 950,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${name} profile photo`}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials || "NA"
      )}
    </div>
  );
}

function PacketIdentityBlock({
  name,
  role,
  photoUrl,
  fitScore,
}: {
  name: string;
  role: string;
  photoUrl: string;
  fitScore: number | null;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(5,10,18,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        display: "grid",
        gap: 10,
        justifyItems: "center",
        textAlign: "center",
      }}
    >
      <CandidatePhoto url={photoUrl} name={name} />
      <div>
        <strong style={{ color: "#fff", display: "block" }}>{name}</strong>
        <span
          style={{
            color: "#bfd6f5",
            display: "block",
            marginTop: 4,
            fontSize: 12,
          }}
        >
          {role}
        </span>
        {fitScore !== null ? (
          <span
            style={{
              color: "#fbbf24",
              display: "block",
              marginTop: 6,
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            Fit score {fitScore}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ResumeBlock({ url }: { url: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(5,10,18,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <strong style={{ color: "#fff", display: "block" }}>Resume</strong>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            marginTop: 10,
            color: "#93c5fd",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          Open resume →
        </a>
      ) : (
        <span
          style={{
            color: "#bfd6f5",
            display: "block",
            marginTop: 6,
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          Resume is not attached. Candidate remains off the board until packet
          is ready.
        </span>
      )}
    </div>
  );
}

function QuestionBlock({ questions }: { questions: string[] }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(5,10,18,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <strong style={{ color: "#fff", display: "block" }}>
        Suggested manager questions
      </strong>
      <ol
        style={{
          margin: "8px 0 0",
          paddingLeft: 18,
          color: "#bfd6f5",
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {questions.map((question) => (
          <li key={question} style={{ marginTop: 6 }}>
            {question}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PacketBlock({ title, copy }: { title: string; copy: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(5,10,18,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <strong style={{ color: "#fff", display: "block" }}>{title}</strong>
      <span
        style={{
          color: "#bfd6f5",
          display: "block",
          marginTop: 6,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        {copy}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 174,
        minHeight: 42,
        padding: "0 14px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        letterSpacing: "0.04em",
        textAlign: "center",
        background: "rgba(34,197,94,0.14)",
        border: "1px solid rgba(34,197,94,0.28)",
        color: "#86efac",
      }}
    >
      {status}
    </span>
  );
}

const drawerStyle = {
  marginTop: 16,
  padding: 14,
  borderRadius: 18,
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;

const drawerSummaryStyle = {
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
  listStyle: "none",
} as const;

const miniSectionTitleStyle = {
  color: "#facc15",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  marginTop: 4,
} as const;

const inputStyle = {
  width: "100%",
  marginTop: 7,
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(5,10,18,0.88)",
  color: "#fff",
  outline: "none",
} as const;
