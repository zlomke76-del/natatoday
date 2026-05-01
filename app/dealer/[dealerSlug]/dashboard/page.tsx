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
      "new"
  );
}

function getCandidateName(application: AnyRow) {
  return String(
    application.candidate_name ||
      application.full_name ||
      application.name ||
      application.applicant_name ||
      application.email ||
      "Candidate"
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
      "Candidate packet is ready for manager review."
  );
}

function getResumeUrl(application: AnyRow) {
  return String(
    application.resume_url ||
      application.resume_path ||
      application.resume_public_url ||
      ""
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

  return MANAGER_VISIBLE_STATUSES.has(status) && hasInterview && hasSummary && hasResume;
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
    return value.map(String).map((item) => item.trim()).filter(Boolean);
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
  const directTags = splitList(application.notes || application.tags || application.fit_signals);

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
      application.suggested_questions
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
      application.remaining_verification_flags
  );

  if (existing.length > 0) return existing.slice(0, 5);

  const lower = role.toLowerCase();
  const defaults = ["Confirm schedule", "Confirm start date", "Confirm compensation alignment"];

  if (lower.includes("technician")) {
    return ["Confirm certifications", "Confirm tool availability", ...defaults].slice(0, 5);
  }

  if (lower.includes("sales") || lower.includes("bdc")) {
    return ["Confirm weekend availability", "Confirm follow-up expectations", ...defaults].slice(0, 5);
  }

  return defaults;
}

function buildNataNotes(application: AnyRow, role: string) {
  const existing = String(
    application.nata_notes ||
      application.packet_notes ||
      application.interview_packet_notes ||
      ""
  ).trim();

  if (existing) return existing;

  const summary = getApplicationSummary(application);
  const fitScore = application.fit_score || application.fitScore;
  const fitScoreLine = fitScore ? ` Fit score: ${fitScore}.` : "";

  return `NATA review: ${summary}${fitScoreLine} Use the manager interview to verify role fit, availability, compensation alignment, and any remaining concerns before a final hiring decision.`;
}

function toManagerCandidate(application: AnyRow, job: AnyRow | undefined): ManagerCandidate | null {
  const status = getApplicationStatus(application);
  const dealerInterviewAt = getDealerInterviewAt(application);

  if (!MANAGER_VISIBLE_STATUSES.has(status)) return null;
  if (!dealerInterviewAt) return null;
  if (!hasReadyPacket(application)) return null;

  const role = String(job?.title || application.role || application.job_title || "Role");

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
    nataNotes: buildNataNotes(application, role),
    interviewQuestions: getInterviewQuestions(role, application),
    verificationItems: getVerificationItems(role, application),
    fitScore: typeof application.fit_score === "number" ? application.fit_score : null,
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
    const { data: applicationsData, error: applicationsError } = await supabaseAdmin
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

  const managerCandidates = applications
    .map((application) => toManagerCandidate(application, jobById.get(String(application.job_id))))
    .filter((candidate): candidate is ManagerCandidate => Boolean(candidate));

  const openJobs = jobs.filter(
    (job) => job.is_active !== false && job.publish_status !== "filled"
  );

  const filledJobs = jobs.filter(
    (job) => job.publish_status === "filled" || job.is_active === false
  );

  return {
    jobs,
    applications,
    decisions,
    managerCandidates,
    openJobs,
    filledJobs,
  };
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
              This dealer workspace is protected. Complete enrollment through Stripe
              or use the secure access link issued after checkout.
            </p>
            <p style={{ color: "#9fb4d6", lineHeight: 1.6, marginTop: 18 }}>
              If your subscription is already active, contact NATA Today and we can
              resend the secure access link for this dealership.
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
  const submittedRole = searchParams?.role
    ? decodeURIComponent(searchParams.role)
    : "Hiring request";
  const decisionCandidate = searchParams?.candidate
    ? decodeURIComponent(searchParams.candidate)
    : "Candidate";

  const { applications, decisions, managerCandidates, openJobs, filledJobs } =
    await loadDashboardData(params.dealerSlug);

  async function submitHiringRequest(formData: FormData) {
    "use server";

    const title = cleanFormValue(formData.get("role"));
    const priority = cleanFormValue(formData.get("priority")) || "Standard";
    const salary = cleanFormValue(formData.get("payRange"));
    const needBy = cleanFormValue(formData.get("needBy"));
    const notes = cleanFormValue(formData.get("notes"));
    const publishMode = cleanFormValue(formData.get("publish_mode")) || "public";

    if (!title) {
      throw new Error("Role is required before a hiring request can be submitted.");
    }

    const adminKey = process.env.NATA_ADMIN_KEY;
    if (!adminKey) {
      throw new Error(
        "Missing NATA_ADMIN_KEY. Add it to Vercel before submitting hiring requests."
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
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Hiring request could not be published.");
    }

    redirect(
      `/dealer/${params.dealerSlug}/dashboard?request=submitted&role=${encodeURIComponent(
        title
      )}`
    );
  }

  async function closeHiringRequest(formData: FormData) {
    "use server";

    const jobId = cleanFormValue(formData.get("job_id"));
    const jobTitle = cleanFormValue(formData.get("job_title")) || "Hiring request";
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
        jobTitle
      )}`
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
      throw new Error("Outcome and reason are required before saving a decision.");
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
      console.error("Failed to update application after decision:", applicationError);
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
        candidateName || "Candidate"
      )}`
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
              handles posting, screening, candidate routing, and interview packet
              preparation before anything lands on your board.
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
            <strong style={{ color: "#fff", display: "block" }}>{dealerName}</strong>
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(360px, 0.7fr)",
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
              Submit the role, pay range, urgency, visibility preference, and notes.
              NATA Today formats the post, handles publication, and opens the candidate pipeline.
            </p>

            <form action={submitHiringRequest} style={{ marginTop: 24 }}>
              <div className="grid-2" style={{ gap: 16 }}>
                <Field label="Role needed">
                  <select name="role" defaultValue="" required style={inputStyle}>
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
                  <select name="priority" defaultValue="Standard" style={inputStyle}>
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
                  <select name="publish_mode" defaultValue="public" style={inputStyle}>
                    <option value="public">Public dealership posting</option>
                    <option value="confidential">Confidential search</option>
                  </select>
                </Field>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#cfe2ff",
                  lineHeight: 1.55,
                  fontSize: 14,
                }}
              >
                <strong style={{ color: "#fff" }}>Suggested pay ranges:</strong>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {Object.entries(paySuggestions).map(([role, pay]) => (
                    <span key={role}>
                      {role}: <strong style={{ color: "#fff" }}>{pay}</strong>
                    </span>
                  ))}
                </div>
              </div>

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

          <aside
            style={{
              padding: 24,
              borderRadius: 26,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Manager board rule
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
              You only see candidates when it is time to act.
            </h2>

            <p style={{ color: "#cfe2ff", lineHeight: 1.6 }}>
              Candidates do not appear on the dealer board while NATA Today is still
              screening, completing the virtual interview, scheduling the manager
              interview, or preparing the packet.
            </p>

            <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
              <ReviewPill
                title="Packet ready"
                copy="Resume, NATA notes, suggested manager questions, and verification items are prepared."
              />
              <ReviewPill
                title="Interview scheduled"
                copy="A manager interview time exists before the candidate appears here."
              />
              <ReviewPill
                title="Human decision required"
                copy="The manager submits outcome and why after the interview."
              />
            </div>
          </aside>
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
                  (application) => String(application.job_id) === String(job.id)
                );
                const readyCount = jobApplications.filter((application) =>
                  MANAGER_VISIBLE_STATUSES.has(getApplicationStatus(application))
                ).length;

                return (
                  <article
                    key={job.id}
                    style={{
                      padding: 22,
                      borderRadius: 24,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 14,
                        alignItems: "flex-start",
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
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 10,
                        marginTop: 18,
                      }}
                    >
                      <Metric label="Candidates" value={jobApplications.length} />
                      <Metric label="Ready" value={readyCount} />
                      <Metric label="Status" value={job.publish_status || "published"} />
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
                      <input type="hidden" name="job_id" value={String(job.id)} />
                      <input
                        type="hidden"
                        name="job_title"
                        value={String(job.title || "Hiring request")}
                      />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 0.72fr) minmax(0, 1fr)",
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
                            <option value="walk_in_candidate">Filled by walk-in candidate</option>
                            <option value="internal_hire">Filled internally</option>
                            <option value="role_paused">Role paused</option>
                            <option value="no_longer_needed">No longer needed</option>
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
                          Removes this request from the open board and records the closure.
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
                  </article>
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
                    String(decision.outcome) === "hired"
                );
                const application = applications.find(
                  (item) => String(item.id) === String(hiredDecision?.application_id)
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
                        {application ? getCandidateName(application) : "documented hire"}
                      </strong>
                    </p>

                    <p style={{ color: "#9fb4d6", lineHeight: 1.55 }}>
                      {hiredDecision?.decision_reason || job.filled_note || "Decision documented."}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState copy="No filled requests have been documented yet." />
          )}
        </section>

        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Manager interview board</div>

          {managerCandidates.length > 0 ? (
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {managerCandidates.map((candidate) => (
                <article
                  key={candidate.id}
                  style={{
                    padding: 22,
                    borderRadius: 24,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 18,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                          color: "#fff",
                          fontSize: 24,
                          letterSpacing: "-0.035em",
                        }}
                      >
                        {candidate.name}
                      </h3>

                      <p style={{ margin: "6px 0 0", color: "#bfd6f5" }}>
                        {candidate.role} · {formatInterviewTime(candidate.dealerInterviewAt)}
                      </p>
                    </div>

                    <StatusBadge status="Packet ready · interview scheduled" />
                  </div>

                  <p style={{ color: "#9fb4d6", lineHeight: 1.55, marginTop: 14 }}>
                    {candidate.summary}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    {candidate.notes.map((note) => (
                      <span
                        key={note}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.055)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          color: "#d7e8ff",
                          fontSize: 13,
                        }}
                      >
                        {note}
                      </span>
                    ))}
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
                        gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1.15fr)",
                        gap: 12,
                        marginTop: 14,
                      }}
                    >
                      <ResumeBlock url={candidate.resumeUrl} />
                      <QuestionBlock questions={candidate.interviewQuestions} />
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <PacketBlock title="NATA notes" copy={candidate.nataNotes} />
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <strong style={{ color: "#fff" }}>Verify during interview</strong>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginTop: 10,
                        }}
                      >
                        {candidate.verificationItems.map((item) => (
                          <span
                            key={item}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 999,
                              background: "rgba(255,255,255,0.055)",
                              border: "1px solid rgba(255,255,255,0.09)",
                              color: "#d7e8ff",
                              fontSize: 13,
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
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
              ))}
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
                No manager interviews are ready yet.
              </h3>
              <p style={{ margin: "10px 0 0", lineHeight: 1.6 }}>
                NATA Today is still screening candidates, completing virtual interviews,
                scheduling manager interviews, or preparing interview packets. Candidates
                appear here only when the packet is ready and the interview is scheduled.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
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
          Resume is not attached. Candidate remains off the board until packet is ready.
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
