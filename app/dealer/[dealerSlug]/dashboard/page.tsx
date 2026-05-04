import type { ReactNode, CSSProperties } from "react";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { hasDealerAccess } from "../../../../lib/dealerAccess";
import ActionNotice from "./ActionNotice";
import CommunicationsCenter from "./CommunicationsCenter";

type PageProps = {
  params: { dealerSlug: string };
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

type BaseCandidate = {
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

type ReadyScheduleCandidate = BaseCandidate;

type ManagerCandidate = BaseCandidate & {
  dealerInterviewAt: string;
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
const MIN_MATCH_SCORE = 70;
const MAX_MATCH_DISTANCE_MILES = 100;

const POOL_RETURN_OUTCOMES = new Set([
  "not_hired",
  "dealer_rejected",
  "not_selected",
  "interview_not_selected",
  "rejected",
  "withdrawn",
]);

const PLACED_OUTCOMES = new Set([
  "hired",
  "placed",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
]);

const MANAGER_VISIBLE_STATUSES = new Set([
  "dealer_interview_scheduled",
  "dealer_review",
]);

function formatDealerName(slug: string) {
  if (slug === "jersey-village-cdjr") return "Jersey Village Chrysler Jeep Dodge Ram";

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

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getBaseUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicitUrl) return explicitUrl.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/$/, "");

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
  const tags = ["Packet ready"];

  if (application.fit_score || application.fitScore) {
    tags.push(`Fit ${application.fit_score || application.fitScore}`);
  }

  if (status === "dealer_review") tags.push("Dealer review");
  if (status === DEALER_SCHEDULE_REQUESTED_STATUS) tags.push("Schedule needed");

  return tags;
}

function getInterviewQuestions(role: string, application: AnyRow) {
  const existing = splitList(
    application.interview_questions || application.manager_questions || application.suggested_questions,
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
    application.nata_notes || application.packet_notes || application.interview_packet_notes || "",
  ).trim();

  if (existing) return existing;

  const summary = getApplicationSummary(application);
  const fitScore = application.fit_score || application.fitScore;
  const fitScoreLine = fitScore ? ` Fit score: ${fitScore}.` : "";

  return `NATA review: ${summary}${fitScoreLine} Use the manager interview to verify role fit, availability, compensation alignment, and any remaining concerns before a final hiring decision.`;
}

function toReadyScheduleCandidate(application: AnyRow, job: AnyRow | undefined): ReadyScheduleCandidate | null {
  const status = getApplicationStatus(application);

  if (status !== DEALER_SCHEDULE_REQUESTED_STATUS) return null;
  if (!hasReadyPacket(application)) return null;

  const role = String(job?.title || application.role || application.job_title || "Role");

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
    fitScore: typeof application.fit_score === "number" ? application.fit_score : null,
  };
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
    photoUrl: getCandidatePhotoUrl(application),
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

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 3958.8;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistanceMiles(candidate: AnyRow, job: AnyRow) {
  const candidateLat = toNumber(candidate.latitude);
  const candidateLon = toNumber(candidate.longitude);
  const jobLat = toNumber(job.latitude);
  const jobLon = toNumber(job.longitude);

  if (candidateLat === null || candidateLon === null || jobLat === null || jobLon === null) return null;

  return haversineMiles(candidateLat, candidateLon, jobLat, jobLon);
}

function getCandidateTargetRoles(application: AnyRow, job: AnyRow | null) {
  if (Array.isArray(application.target_roles) && application.target_roles.length) {
    return application.target_roles.map((role) => normalize(role)).filter(Boolean);
  }

  const roleTitle = String(application.role || application.job_title || job?.title || "");
  if (!roleTitle.trim()) return [];

  const normalized = roleTitle.toLowerCase();

  if (normalized.includes("sales")) return ["sales consultant"];
  if (normalized.includes("service") && normalized.includes("advisor")) return ["service advisor"];
  if (normalized.includes("technician") || normalized.includes("tech")) return ["service technician"];
  if (normalized.includes("bdc")) return ["bdc representative"];
  if (normalized.includes("parts")) return ["parts advisor"];
  if (normalized.includes("finance") || normalized.includes("f&i")) return ["finance manager"];

  return [normalized];
}

function getCandidateSearchText(candidate: AnyRow) {
  return [
    candidate.name,
    candidate.email,
    candidate.location_text,
    candidate.linkedin,
    candidate.experience_summary,
    ...(Array.isArray(candidate.target_roles) ? candidate.target_roles : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getJobRoleKey(job: AnyRow) {
  const title = normalize(job.title);

  if (title.includes("sales")) return "sales consultant";
  if (title.includes("service") && title.includes("advisor")) return "service advisor";
  if (title.includes("technician") || title.includes("tech")) return "service technician";
  if (title.includes("bdc")) return "bdc representative";
  if (title.includes("parts")) return "parts advisor";
  if (title.includes("finance") || title.includes("f&i")) return "finance manager";

  return "general";
}

function scoreRoleFit(candidate: AnyRow, job: AnyRow) {
  const roleKey = getJobRoleKey(job);
  const text = getCandidateSearchText(candidate);
  const targetRoles = Array.isArray(candidate.target_roles)
    ? candidate.target_roles.map((role) => normalize(role)).filter(Boolean)
    : [];
  const reasons: string[] = [];

  let score = 0;

  if (targetRoles.some((role) => role.includes(roleKey) || roleKey.includes(role))) {
    score += 35;
    reasons.push(`Target role aligns with ${roleKey}.`);
  }

  if (roleKey === "sales consultant") {
    if (text.includes("sales")) score += 16;
    if (text.includes("closing") || text.includes("closer")) score += 10;
    if (text.includes("crm")) score += 8;
    if (text.includes("appointment")) score += 6;
    if (text.includes("units") || text.includes("close rate")) score += 8;
  }

  if (roleKey === "service advisor") {
    if (text.includes("service advisor")) score += 20;
    if (text.includes("repair order") || text.includes("ro ")) score += 10;
    if (text.includes("warranty")) score += 8;
    if (text.includes("service lane")) score += 8;
    if (text.includes("customer escalation")) score += 6;
  }

  if (roleKey === "service technician") {
    if (text.includes("technician") || text.includes("tech")) score += 18;
    if (text.includes("ase")) score += 12;
    if (text.includes("diagnostic")) score += 10;
    if (text.includes("electrical")) score += 8;
    if (text.includes("tools")) score += 6;
  }

  if (roleKey === "bdc representative") {
    if (text.includes("bdc")) score += 22;
    if (text.includes("calls")) score += 8;
    if (text.includes("appointment")) score += 8;
    if (text.includes("crm")) score += 8;
    if (text.includes("sms") || text.includes("email follow")) score += 6;
  }

  if (roleKey === "parts advisor") {
    if (text.includes("parts")) score += 22;
    if (text.includes("inventory")) score += 8;
    if (text.includes("catalog")) score += 8;
    if (text.includes("counter")) score += 6;
  }

  if (roleKey === "finance manager") {
    if (text.includes("finance") || text.includes("f&i")) score += 22;
    if (text.includes("lender")) score += 8;
    if (text.includes("compliance")) score += 8;
    if (text.includes("menu")) score += 6;
  }

  return { roleKey, score: Math.min(score, 45), reasons };
}

function computeCandidateMatch(candidate: AnyRow, job: AnyRow) {
  let score = 35;
  const reasons: string[] = [];

  const roleFit = scoreRoleFit(candidate, job);
  score += roleFit.score;
  reasons.push(...roleFit.reasons);

  const distance = getDistanceMiles(candidate, job);

  if (distance !== null) {
    if (distance <= MAX_MATCH_DISTANCE_MILES) {
      score += 12;
      reasons.push(`Candidate is within ${Math.round(distance)} miles.`);
    } else {
      score -= 35;
      reasons.push(`Candidate is ${Math.round(distance)} miles away, outside preferred radius.`);
    }
  } else if (candidate.location_text) {
    score += 6;
    reasons.push("Candidate provided a local market or ZIP.");
  }

  if (candidate.resume_url) {
    score += 8;
    reasons.push("Resume is available for review.");
  }

  if (candidate.profile_photo_url) {
    score += 2;
    reasons.push("Profile photo is available.");
  }

  if (candidate.linkedin) {
    score += 3;
    reasons.push("LinkedIn profile is available.");
  }

  if (job.publish_status === "published") {
    score += 2;
    reasons.push("Role is published.");
  }

  if (job.is_active !== false && !job.filled_at) {
    score += 2;
    reasons.push("Role is active and unfilled.");
  }

  if (roleFit.score < 15) {
    score -= 18;
    reasons.push(`Insufficient role-specific signal for ${roleFit.roleKey}.`);
  }

  const fitScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    distance_miles: distance === null ? null : Math.round(distance * 10) / 10,
    fit_score: fitScore,
    match_status: fitScore >= MIN_MATCH_SCORE ? "eligible" : "below_threshold",
    match_reason: reasons.join(" ") || "Candidate returned to pool after dealer decision.",
  };
}

function buildPoolExperienceSummary(application: AnyRow, job: AnyRow | null, decisionReason: string) {
  return String(
    application.experience_summary ||
      application.screening_summary ||
      application.summary ||
      application.cover_note ||
      decisionReason ||
      `Candidate previously interviewed for ${job?.title || application.role || "a dealership role"}.`,
  );
}

async function syncCandidateMatches(candidate: AnyRow) {
  const { data: jobs, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      "id,title,location,public_location,public_dealer_name,dealer_slug,is_active,publish_status,publish_mode,filled_at,latitude,longitude",
    )
    .eq("is_active", true)
    .eq("publish_status", "published")
    .is("filled_at", null);

  if (error) {
    console.error("Failed to load active jobs for candidate rematch:", error);
    return;
  }

  const rows = ((jobs || []) as AnyRow[]).map((job) => {
    const match = computeCandidateMatch(candidate, job);

    return {
      candidate_id: candidate.id,
      job_id: job.id,
      distance_miles: match.distance_miles,
      fit_score: match.fit_score,
      match_status: match.match_status,
      match_reason: match.match_reason,
      updated_at: new Date().toISOString(),
    };
  });

  if (!rows.length) return;

  const { error: matchError } = await supabaseAdmin
    .schema("nata")
    .from("candidate_matches")
    .upsert(rows, { onConflict: "candidate_id,job_id" });

  if (matchError) {
    console.error("Failed to rematch candidate after dealer decision:", matchError);
  }
}

async function upsertCandidateFromApplication(input: {
  applicationId: string;
  outcome: string;
  decisionReason: string;
}) {
  const { data: application, error: applicationError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", input.applicationId)
    .maybeSingle();

  if (applicationError) {
    console.error("Failed to load application for pool sync:", applicationError);
    return;
  }

  if (!application?.email) return;

  const { data: job } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", application.job_id)
    .maybeSingle();

  const email = String(application.email).trim().toLowerCase();
  const isPlaced = PLACED_OUTCOMES.has(input.outcome);
  const shouldReturnToPool = POOL_RETURN_OUTCOMES.has(input.outcome);

  if (!isPlaced && !shouldReturnToPool) return;

  const candidatePayload = {
    name: getCandidateName(application),
    email,
    phone: String(application.phone || application.candidate_phone || "Not provided"),
    linkedin: application.linkedin || null,
    location_text:
      application.location_text ||
      application.location ||
      application.city ||
      application.market ||
      job?.public_location ||
      job?.location ||
      null,
    resume_url: getResumeUrl(application) || null,
    profile_photo_url: getCandidatePhotoUrl(application) || null,
    target_roles: getCandidateTargetRoles(application, job),
    experience_summary: buildPoolExperienceSummary(application, job, input.decisionReason),
    status: isPlaced ? "placed" : "active",
    updated_at: new Date().toISOString(),
  };

  const { data: existingCandidate, error: existingError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check existing pool candidate:", existingError);
    return;
  }

  let candidate: AnyRow | null = null;

  if (existingCandidate?.id) {
    const { data: updatedCandidate, error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .update(candidatePayload)
      .eq("id", existingCandidate.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Failed to update candidate pool record:", updateError);
      return;
    }

    candidate = updatedCandidate as AnyRow;
  } else {
    const { data: insertedCandidate, error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .insert(candidatePayload)
      .select("*")
      .single();

    if (insertError) {
      console.error("Failed to insert candidate pool record:", insertError);
      return;
    }

    candidate = insertedCandidate as AnyRow;
  }

  if (candidate && shouldReturnToPool) {
    await syncCandidateMatches(candidate);
  }
}

async function loadDashboardData(dealerSlug: string) {
  noStore();

  const { data: jobsData, error: jobsError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("dealer_slug", dealerSlug)
    .order("created_at", { ascending: false });

  if (jobsError) console.error("Failed to load dealer jobs:", jobsError);

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

    if (applicationsError) console.error("Failed to load dealer applications:", applicationsError);
    else applications = (applicationsData || []) as AnyRow[];

    const { data: decisionsData, error: decisionsError } = await supabaseAdmin
      .schema("nata")
      .from("decision_records")
      .select("*")
      .in("job_id", jobIds)
      .order("created_at", { ascending: false });

    if (decisionsError) console.error("Failed to load decision records:", decisionsError);
    else decisions = (decisionsData || []) as AnyRow[];
  }

  const jobById = new Map(jobs.map((job) => [String(job.id), job]));

  const readyScheduleCandidates = applications
    .map((application) => toReadyScheduleCandidate(application, jobById.get(String(application.job_id))))
    .filter((candidate): candidate is ReadyScheduleCandidate => Boolean(candidate));

  const managerCandidates = applications
    .map((application) => toManagerCandidate(application, jobById.get(String(application.job_id))))
    .filter((candidate): candidate is ManagerCandidate => Boolean(candidate));

  const openJobs = jobs.filter((job) => job.is_active !== false && job.publish_status !== "filled");
  const filledJobs = jobs.filter((job) => job.publish_status === "filled" || job.is_active === false);

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
        managerCandidates.findIndex((candidate) => candidate.applicationId === activeManager.applicationId),
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

export default async function DealerDashboardPage({ params, searchParams }: PageProps) {
  noStore();

  const dealerName = formatDealerName(params.dealerSlug);

  if (!hasDealerAccess(params.dealerSlug)) {
    return (
      <main className="shell">
        <Nav />
        <section className="wrap" style={{ padding: "70px 0 110px" }}>
          <div style={secureAccessCardStyle}>
            <div className="eyebrow">Secure Dealer Access</div>
            <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>Access required.</h1>
            <p className="lede">
              This dealer workspace is protected. Complete enrollment through Stripe or use the secure access link issued after checkout.
            </p>
            <p style={{ color: "#9fb4d6", lineHeight: 1.6, marginTop: 18 }}>
              If your subscription is already active, contact NATA Today and we can resend the secure access link for this dealership.
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
  const submittedRole = searchParams?.role ? decodeURIComponent(searchParams.role) : "Hiring request";
  const decisionCandidate = searchParams?.candidate ? decodeURIComponent(searchParams.candidate) : "Candidate";

  const { applications, decisions, readyScheduleCandidates, managerCandidates, openJobs, filledJobs } = await loadDashboardData(params.dealerSlug);

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
    const publishMode = cleanFormValue(formData.get("publish_mode")) || "public";
    const interviewPocName = cleanFormValue(formData.get("interview_poc_name"));
    const interviewPocTitle = cleanFormValue(formData.get("interview_poc_title"));
    const interviewPocPhone = cleanFormValue(formData.get("interview_poc_phone"));
    const interviewPocEmail = cleanFormValue(formData.get("interview_poc_email"));
    const backupInterviewPocName = cleanFormValue(formData.get("backup_interview_poc_name"));
    const backupInterviewPocPhone = cleanFormValue(formData.get("backup_interview_poc_phone"));
    const backupInterviewPocEmail = cleanFormValue(formData.get("backup_interview_poc_email"));
    const preferredInterviewWindows = cleanFormValue(formData.get("preferred_interview_windows"));

    if (!title) throw new Error("Role is required before a hiring request can be submitted.");

    const adminKey = process.env.NATA_ADMIN_KEY;
    if (!adminKey) throw new Error("Missing NATA_ADMIN_KEY. Add it to Vercel before submitting hiring requests.");

    const response = await fetch(`${getBaseUrl()}/api/nata/jobs`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "x-nata-admin-key": adminKey },
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
    if (!response.ok) throw new Error(result?.error || "Hiring request could not be published.");

    redirect(`/dealer/${params.dealerSlug}/dashboard?request=submitted&role=${encodeURIComponent(title)}`);
  }

  async function closeHiringRequest(formData: FormData) {
    "use server";

    const jobId = cleanFormValue(formData.get("job_id"));
    const jobTitle = cleanFormValue(formData.get("job_title")) || "Hiring request";
    const closedReason = cleanFormValue(formData.get("closed_reason")) || "walk_in_candidate";
    const filledNote = cleanFormValue(formData.get("filled_note"));

    if (!jobId) throw new Error("Job id is required before a request can be removed.");

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

    redirect(`/dealer/${params.dealerSlug}/dashboard?request=closed&role=${encodeURIComponent(jobTitle)}`);
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

    const { error: decisionError } = await supabaseAdmin.schema("nata").from("decision_records").insert({
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
      .update({ status: nextApplicationStatus, screening_status: nextApplicationStatus, decision_reason: decisionReason })
      .eq("id", applicationId);

    if (applicationError) {
      console.error("Failed to update application after decision:", applicationError);
      throw new Error("Application status could not be updated.");
    }

    await upsertCandidateFromApplication({ applicationId, outcome, decisionReason });

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

    redirect(`/dealer/${params.dealerSlug}/dashboard?decision=saved&candidate=${encodeURIComponent(candidateName || "Candidate")}`);
  }

  const activeCandidateCount = readyScheduleCandidates.length + managerCandidates.length;

  return (
    <main className="shell">
      <Nav />

      <section className="wrap" style={pageSectionStyle}>
        <div style={opsHeaderStyle}>
          <div>
            <div className="eyebrow">Dealer workspace</div>
            <h1 style={opsTitleStyle}>{dealerName}</h1>
            <div style={opsSublineStyle}>
              <span>{dealerLocation}</span>
              <span>Pipeline active</span>
              <span>{activeCandidateCount} active candidate action{activeCandidateCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div style={successStripStyle}>
            <MiniMetric label="Open" value={openJobs.length} />
            <MiniMetric label="Ready" value={readyScheduleCandidates.length} />
            <MiniMetric label="Interviews" value={managerCandidates.length} />
            <MiniMetric label="Filled" value={filledJobs.length} tone="success" />
          </div>
        </div>

        {requestSubmitted ? <ActionNotice title={`${submittedRole} request received.`} copy="NATA is working the request. Active candidates appear here only when action is needed." /> : null}
        {requestClosed ? <ActionNotice title={`${submittedRole} request closed.`} copy="Removed from active hiring. Candidates remain archived." /> : null}
        {decisionSaved ? <ActionNotice title={`${decisionCandidate} decision saved.`} copy="The interview decision has been documented." /> : null}
        {scheduleRequested ? <ActionNotice title="Dealer scheduling request sent." copy="The dealer has been notified by dashboard alert, email, and SMS where available." /> : null}
        {scheduleConfirmed ? <ActionNotice title="Manager interview scheduled." copy="The candidate has been notified by email and SMS where available." /> : null}

        <ActiveCandidateRail
          dealerSlug={params.dealerSlug}
          readyScheduleCandidates={readyScheduleCandidates}
          managerCandidates={managerCandidates}
          activeApplicationId={activeAction?.candidate.applicationId || ""}
        />

        <section id="next-action" style={nextActionSectionStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div className="eyebrow">Next action</div>
              <h2 style={sectionTitleStyle}>Work queue</h2>
            </div>
            <span style={mutedSmallStyle}>One candidate action shown at a time.</span>
          </div>

          {activeAction ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={nextActionNoticeStyle}>
                <strong style={{ color: "#fff" }}>Action {activeAction.index + 1} of {activeAction.total}</strong>
                <span>{activeAction.type === "schedule" ? "Set manager interview time." : "Record manager decision."}</span>
              </div>

              {activeAction.type === "schedule" ? (
                <ScheduleCandidateCard candidate={activeAction.candidate} dealerSlug={params.dealerSlug} />
              ) : (
                <DecisionCandidateCard candidate={activeAction.candidate} submitInterviewDecision={submitInterviewDecision} />
              )}
            </div>
          ) : (
            <EmptyState copy="No dealer action is ready. NATA is screening, interviewing, or preparing packets." />
          )}
        </section>

        <div style={businessGridStyle}>
          <HiringRequestPanel submitHiringRequest={submitHiringRequest} />
          <OpenRequestsSection openJobs={openJobs} applications={applications} closeHiringRequest={closeHiringRequest} />
        </div>

        <FilledRequestsSection filledJobs={filledJobs} decisions={decisions} applications={applications} />

        <section style={{ marginTop: 28 }}>
          <div className="eyebrow">Communications</div>
          <CommunicationsCenter dealerSlug={params.dealerSlug} />
        </section>
      </section>
    </main>
  );
}

function HiringRequestPanel({ submitHiringRequest }: { submitHiringRequest: (formData: FormData) => Promise<void> }) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div className="eyebrow">New request</div>
          <h2 style={panelTitleStyle}>Open a role</h2>
        </div>
        <span style={mutedSmallStyle}>NATA handles posting + screening.</span>
      </div>

      <form action={submitHiringRequest} style={{ marginTop: 14 }}>
        <div style={compactFormGridStyle}>
          <Field label="Role needed">
            <select name="role" defaultValue="" required style={inputStyle}>
              <option value="" disabled>Select role</option>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </Field>

          <Field label="Priority">
            <select name="priority" defaultValue="Standard" style={inputStyle}>
              {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </Field>

          <Field label="Target pay range">
            <input name="payRange" placeholder="Example: $55,000 - $95,000" style={inputStyle} />
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

        <details style={drawerStyle}>
          <summary style={drawerSummaryStyle}>Interviewer Contact and preferred windows</summary>
          <p style={drawerCopyStyle}>Add the manager/interviewer contact now so scheduling is faster when a packet is ready.</p>

          <div style={compactFormGridStyle}>
            <Field label="Primary interviewer contact">
              <input name="interview_poc_name" placeholder="Example: Sales Manager" style={inputStyle} />
            </Field>

            <Field label="Interviewer title">
              <input name="interview_poc_title" placeholder="Example: General Sales Manager" style={inputStyle} />
            </Field>

            <Field label="Interviewer phone">
              <input name="interview_poc_phone" placeholder="+1..." style={inputStyle} />
            </Field>

            <Field label="Interviewer email">
              <input name="interview_poc_email" type="email" placeholder="manager@dealer.com" style={inputStyle} />
            </Field>

            <Field label="Backup interviewer">
              <input name="backup_interview_poc_name" placeholder="Optional backup contact" style={inputStyle} />
            </Field>

            <Field label="Backup phone">
              <input name="backup_interview_poc_phone" placeholder="+1..." style={inputStyle} />
            </Field>

            <Field label="Backup email">
              <input name="backup_interview_poc_email" type="email" placeholder="backup@dealer.com" style={inputStyle} />
            </Field>
          </div>

          <div style={{ marginTop: 10 }}>
            <Field label="Preferred interview windows">
              <textarea name="preferred_interview_windows" rows={2} placeholder="Example: Tue/Thu 2–5 PM. Saturdays before noon if urgent." style={inputStyle} />
            </Field>
          </div>
        </details>

        <details style={drawerStyle}>
          <summary style={drawerSummaryStyle}>Suggested pay ranges</summary>
          <div style={suggestionGridStyle}>
            {Object.entries(paySuggestions).map(([role, pay]) => (
              <span key={role}>{role}: <strong style={{ color: "#fff" }}>{pay}</strong></span>
            ))}
          </div>
        </details>

        <div style={{ marginTop: 12 }}>
          <Field label="Notes for this request">
            <textarea name="notes" rows={3} placeholder="Example: Saturday availability, Spanish preferred, strong closer." style={inputStyle} />
          </Field>
        </div>

        <div style={formFooterStyle}>
          <button className="btn btn-primary" type="submit">Send request</button>
          <span style={mutedSmallStyle}>Your team does not need to build the public post.</span>
        </div>
      </form>
    </section>
  );
}

function OpenRequestsSection({
  openJobs,
  applications,
  closeHiringRequest,
}: {
  openJobs: AnyRow[];
  applications: AnyRow[];
  closeHiringRequest: (formData: FormData) => Promise<void>;
}) {
  return (
    <section style={panelStyle}>
      <div style={panelHeaderStyle}>
        <div>
          <div className="eyebrow">Open requests</div>
          <h2 style={panelTitleStyle}>{openJobs.length} active</h2>
        </div>
      </div>

      {openJobs.length > 0 ? (
        <div style={requestListStyle}>
          {openJobs.map((job) => {
            const jobApplications = applications.filter((application) => String(application.job_id) === String(job.id));
            const readyCount = jobApplications.filter((application) => MANAGER_VISIBLE_STATUSES.has(getApplicationStatus(application))).length;

            return (
              <details key={job.id} style={requestCardStyle}>
                <summary style={requestSummaryStyle}>
                  <div>
                    <h3 style={requestTitleStyle}>{job.title || "Open role"}</h3>
                    <p style={requestMetaStyle}>{job.salary || "Compensation reviewed by NATA"}</p>
                  </div>
                  <div style={requestMetricsStyle}>
                    <Metric label="Candidates" value={jobApplications.length} />
                    <Metric label="Ready" value={readyCount} />
                  </div>
                </summary>

                <form action={closeHiringRequest} style={closeFormStyle}>
                  <input type="hidden" name="job_id" value={String(job.id)} />
                  <input type="hidden" name="job_title" value={String(job.title || "Hiring request")} />

                  <div style={closeGridStyle}>
                    <Field label="Remove reason">
                      <select name="closed_reason" defaultValue="walk_in_candidate" style={inputStyle}>
                        <option value="walk_in_candidate">Filled by walk-in candidate</option>
                        <option value="internal_hire">Filled internally</option>
                        <option value="role_paused">Role paused</option>
                        <option value="no_longer_needed">No longer needed</option>
                      </select>
                    </Field>

                    <Field label="Optional note">
                      <input name="filled_note" placeholder="Example: Walk-in accepted offer today." style={inputStyle} />
                    </Field>
                  </div>

                  <div style={closeFooterStyle}>
                    <span style={mutedSmallStyle}>Removes this role from the active board.</span>
                    <button className="btn btn-secondary" type="submit" style={{ border: "1px solid rgba(255,255,255,0.18)" }}>Remove request</button>
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
  );
}

function FilledRequestsSection({ filledJobs, decisions, applications }: { filledJobs: AnyRow[]; decisions: AnyRow[]; applications: AnyRow[] }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={sectionHeaderStyle}>
        <div>
          <div className="eyebrow">Successes</div>
          <h2 style={sectionTitleStyle}>Filled requests</h2>
        </div>
        <span style={successCountStyle}>{filledJobs.length} filled</span>
      </div>

      {filledJobs.length > 0 ? (
        <div style={filledGridStyle}>
          {filledJobs.map((job) => {
            const hiredDecision = decisions.find(
              (decision) => String(decision.job_id) === String(job.id) && String(decision.outcome) === "hired",
            );
            const application = applications.find((item) => String(item.id) === String(hiredDecision?.application_id));

            return (
              <article key={job.id} style={filledCardStyle}>
                <span style={filledBadgeStyle}>Filled</span>
                <h3 style={filledTitleStyle}>{job.title || "Filled role"}</h3>
                <p style={{ margin: "8px 0 0", color: "#cfe2ff" }}>
                  Filled by <strong style={{ color: "#fff" }}>{application ? getCandidateName(application) : "documented hire"}</strong>
                </p>
                <p style={filledCopyStyle}>{hiredDecision?.decision_reason || job.filled_note || "Decision documented."}</p>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState copy="No filled requests have been documented yet." />
      )}
    </section>
  );
}

function ActiveCandidateRail({
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
  const activeItems = [
    ...readyScheduleCandidates.map((candidate) => ({ type: "schedule" as const, candidate })),
    ...managerCandidates.map((candidate) => ({ type: "decision" as const, candidate })),
  ];

  return (
    <section style={activeRailStyle}>
      <div style={activeRailHeaderStyle}>
        <div>
          <div className="eyebrow">Active candidates</div>
          <h2 style={activeRailTitleStyle}>{activeItems.length ? `${activeItems.length} needs attention` : "No action needed"}</h2>
        </div>
        <span style={mutedSmallStyle}>Photo + basics stay visible for quick recognition.</span>
      </div>

      {activeItems.length ? (
        <div style={activeCandidateGridStyle}>
          {activeItems.map(({ type, candidate }) => (
            <MiniCandidateCard
              key={`${type}-${candidate.applicationId}`}
              candidate={candidate}
              tone={type}
              href={`/dealer/${dealerSlug}/dashboard?active=${encodeURIComponent(candidate.applicationId)}#next-action`}
              active={activeApplicationId === candidate.applicationId}
            />
          ))}
        </div>
      ) : (
        <div style={emptyMiniCardStyle}>NATA is working screening, interviews, or packets. Candidates appear here only when dealer action is required.</div>
      )}
    </section>
  );
}

function MiniCandidateCard({
  candidate,
  tone,
  href,
  active,
}: {
  candidate: ReadyScheduleCandidate | ManagerCandidate;
  tone: "schedule" | "decision";
  href: string;
  active: boolean;
}) {
  const meta = tone === "schedule" ? "Schedule interview" : formatInterviewTime((candidate as ManagerCandidate).dealerInterviewAt);

  return (
    <a href={href} style={{ ...miniCandidateCardStyle, ...(active ? miniCandidateActiveStyle : {}) }}>
      <CandidatePhoto url={candidate.photoUrl} name={candidate.name} size={48} radius={14} />
      <div style={{ minWidth: 0 }}>
        <strong style={miniNameStyle}>{candidate.name}</strong>
        <span style={miniRoleStyle}>{candidate.role}</span>
        <span style={tone === "schedule" ? miniScheduleStyle : miniDecisionStyle}>{meta}</span>
      </div>
      {candidate.fitScore !== null ? <span style={miniFitStyle}>{candidate.fitScore}</span> : null}
    </a>
  );
}

function ScheduleCandidateCard({ candidate, dealerSlug }: { candidate: ReadyScheduleCandidate; dealerSlug: string }) {
  return (
    <article id={`schedule-${candidate.applicationId}`} style={scheduleCardStyle}>
      <CandidateHeader candidate={candidate} subline={`${candidate.role} · Ready for manager interview time`} status="Schedule needed" />

      <PacketDetails candidate={candidate} title="View recommendation packet" notesTitle="NATA recommendation" />

      <form method="POST" action={`/api/nata/applications/${candidate.applicationId}/schedule-dealer-interview`} style={embeddedFormStyle}>
        <input type="hidden" name="dealer_slug" value={dealerSlug} />

        <h4 style={formTitleStyle}>Confirm manager interview</h4>

        <div style={compactFormGridStyle}>
          <Field label="Interview date"><input name="interview_date" type="date" required style={inputStyle} /></Field>
          <Field label="Interview time"><input name="interview_time" type="time" required style={inputStyle} /></Field>
          <Field label="Manager / interviewer"><input name="manager_name" placeholder="Example: Sales Manager" required style={inputStyle} /></Field>
          <Field label="Interview location"><input name="interview_location" placeholder="Example: Sales office" style={inputStyle} /></Field>
        </div>

        <div style={{ marginTop: 10 }}>
          <Field label="Optional note for candidate">
            <textarea name="dealer_schedule_note" rows={2} placeholder="Example: Please arrive 10 minutes early and ask for the sales manager." style={inputStyle} />
          </Field>
        </div>

        <div style={formFooterBetweenStyle}>
          <span style={mutedSmallStyle}>Confirming notifies the candidate and moves this into decision tracking.</span>
          <button className="btn btn-primary" type="submit">Confirm time</button>
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
    <article id={`interview-${candidate.applicationId}`} style={decisionCardStyle}>
      <CandidateHeader candidate={candidate} subline={`${candidate.role} · ${formatInterviewTime(candidate.dealerInterviewAt)}`} status="Interview scheduled" />

      <PacketDetails candidate={candidate} title="View interview packet" notesTitle="NATA notes" />

      <form action={submitInterviewDecision} style={embeddedFormStyle}>
        <input type="hidden" name="job_id" value={candidate.jobId} />
        <input type="hidden" name="application_id" value={candidate.applicationId} />
        <input type="hidden" name="candidate_name" value={candidate.name} />

        <h4 style={formTitleStyle}>Manager decision</h4>

        <div style={compactFormGridStyle}>
          <Field label="Outcome">
            <select name="outcome" required defaultValue="" style={inputStyle}>
              <option value="" disabled>Select outcome</option>
              <option value="hired">Hired</option>
              <option value="not_hired">Not hired</option>
              <option value="keep_warm">Keep warm</option>
              <option value="no_show">No-show</option>
              <option value="needs_followup">Needs follow-up</option>
            </select>
          </Field>

          <Field label="Manager / interviewer">
            <input name="interviewer_name" placeholder="Example: Sales Manager" required style={inputStyle} />
          </Field>
        </div>

        <div style={{ marginTop: 10 }}>
          <Field label="Decision reason">
            <textarea name="decision_reason" rows={3} placeholder="Required. Briefly document the reason for the decision." required style={inputStyle} />
          </Field>
        </div>

        <div style={formFooterBetweenStyle}>
          <span style={mutedSmallStyle}>Hired closes the listing. Other outcomes keep the role open.</span>
          <button className="btn btn-primary" type="submit">Save decision</button>
        </div>
      </form>
    </article>
  );
}

function CandidateHeader({ candidate, subline, status }: { candidate: BaseCandidate; subline: string; status: string }) {
  return (
    <div style={candidateHeaderStyle}>
      <CandidatePhoto url={candidate.photoUrl} name={candidate.name} />

      <div style={{ minWidth: 0 }}>
        <h3 style={candidateNameStyle}>{candidate.name}</h3>
        <p style={candidateSublineStyle}>{subline}</p>
        <p style={candidateSummaryStyle}>{candidate.summary}</p>
        <div style={tagRowStyle}>{candidate.notes.slice(0, 4).map((note) => <span key={note} style={tagStyle}>{note}</span>)}</div>
      </div>

      <div style={candidateRightStyle}>
        <StatusBadge status={status} />
        {candidate.fitScore !== null ? <span style={fitBadgeStyle}>Fit {candidate.fitScore}</span> : null}
        {candidate.resumeUrl ? <a href={candidate.resumeUrl} target="_blank" rel="noreferrer" style={resumeQuickLinkStyle}>Resume</a> : null}
      </div>
    </div>
  );
}

function PacketDetails({ candidate, title, notesTitle }: { candidate: BaseCandidate; title: string; notesTitle: string }) {
  return (
    <details style={packetDetailsStyle}>
      <summary style={packetSummaryStyle}>{title}</summary>
      <div style={packetGridStyle}>
        <PacketIdentityBlock name={candidate.name} role={candidate.role} photoUrl={candidate.photoUrl} fitScore={candidate.fitScore} />
        <ResumeBlock url={candidate.resumeUrl} />
        <QuestionBlock questions={candidate.interviewQuestions} />
      </div>
      <div style={{ marginTop: 10 }}><PacketBlock title={notesTitle} copy={candidate.nataNotes} /></div>
    </details>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span style={fieldLabelStyle}>{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={metricStyle}>
      <strong style={metricValueStyle}>{value}</strong>
      <span style={metricLabelStyle}>{label}</span>
    </div>
  );
}

function MiniMetric({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "success" }) {
  return (
    <div style={tone === "success" ? miniMetricSuccessStyle : miniMetricStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ copy }: { copy: string }) {
  return <div style={emptyStateStyle}>{copy}</div>;
}

function CandidatePhoto({ url, name, size = 60, radius = 16 }: { url: string; name: string; size?: number; radius?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div style={{ ...candidatePhotoBaseStyle, width: size, height: size, borderRadius: radius, fontSize: Math.max(14, Math.round(size * 0.28)) }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={`${name} profile photo`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials || "NA"
      )}
    </div>
  );
}

function PacketIdentityBlock({ name, role, photoUrl, fitScore }: { name: string; role: string; photoUrl: string; fitScore: number | null }) {
  return (
    <div style={packetIdentityStyle}>
      <CandidatePhoto url={photoUrl} name={name} size={66} radius={18} />
      <div>
        <strong style={{ color: "#fff", display: "block" }}>{name}</strong>
        <span style={packetRoleStyle}>{role}</span>
        {fitScore !== null ? <span style={packetFitStyle}>Fit {fitScore}</span> : null}
      </div>
    </div>
  );
}

function ResumeBlock({ url }: { url: string }) {
  return (
    <div style={packetBoxStyle}>
      <strong style={{ color: "#fff", display: "block" }}>Resume</strong>
      {url ? <a href={url} target="_blank" rel="noreferrer" style={resumeLinkStyle}>Open resume →</a> : <span style={packetMutedTextStyle}>Resume is not attached.</span>}
    </div>
  );
}

function QuestionBlock({ questions }: { questions: string[] }) {
  return (
    <div style={packetBoxStyle}>
      <strong style={{ color: "#fff", display: "block" }}>Suggested questions</strong>
      <ol style={questionListStyle}>{questions.map((question) => <li key={question}>{question}</li>)}</ol>
    </div>
  );
}

function PacketBlock({ title, copy }: { title: string; copy: string }) {
  return (
    <div style={packetBoxStyle}>
      <strong style={{ color: "#fff", display: "block" }}>{title}</strong>
      <span style={packetMutedTextStyle}>{copy}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span style={statusBadgeStyle}>{status}</span>;
}

const pageSectionStyle: CSSProperties = { padding: "24px 0 70px" };
const secureAccessCardStyle: CSSProperties = { maxWidth: 760, padding: 34, borderRadius: 30, border: "1px solid rgba(255,255,255,0.12)", background: "linear-gradient(145deg, rgba(20,115,255,0.13), rgba(255,255,255,0.045))" };
const opsHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 16 };
const opsTitleStyle: CSSProperties = { margin: "6px 0 0", fontSize: "clamp(30px,4vw,48px)", lineHeight: 0.96, letterSpacing: "-0.05em" };
const opsSublineStyle: CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, color: "#bfd6f5", fontSize: 13, fontWeight: 850 };
const successStripStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(82px, 1fr))", gap: 8, minWidth: 420 };
const miniMetricStyle: CSSProperties = { padding: "10px 12px", borderRadius: 14, background: "rgba(255,255,255,0.055)", border: "1px solid rgba(255,255,255,0.1)", display: "grid", gap: 3, color: "#9fb4d6", fontSize: 12 };
const miniMetricSuccessStyle: CSSProperties = { ...miniMetricStyle, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.18)", color: "#bbf7d0" };
const activeRailStyle: CSSProperties = { marginTop: 18, padding: 16, borderRadius: 22, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.1)" };
const activeRailHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" };
const activeRailTitleStyle: CSSProperties = { margin: "5px 0 0", color: "#fff", fontSize: 22, letterSpacing: "-0.035em" };
const activeCandidateGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(265px, 1fr))", gap: 10, marginTop: 12 };
const miniCandidateCardStyle: CSSProperties = { display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) auto", gap: 10, alignItems: "center", padding: 10, borderRadius: 16, textDecoration: "none", background: "rgba(5,10,18,0.52)", border: "1px solid rgba(255,255,255,0.09)" };
const miniCandidateActiveStyle: CSSProperties = { border: "1px solid rgba(147,197,253,0.72)", boxShadow: "0 0 0 3px rgba(59,130,246,0.18)" };
const miniNameStyle: CSSProperties = { color: "#fff", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const miniRoleStyle: CSSProperties = { color: "#bfd6f5", display: "block", marginTop: 2, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const miniScheduleStyle: CSSProperties = { color: "#fde68a", display: "block", marginTop: 3, fontSize: 11, fontWeight: 900 };
const miniDecisionStyle: CSSProperties = { color: "#86efac", display: "block", marginTop: 3, fontSize: 11, fontWeight: 900 };
const miniFitStyle: CSSProperties = { color: "#facc15", fontWeight: 950, fontSize: 16 };
const nextActionSectionStyle: CSSProperties = { marginTop: 24, scrollMarginTop: 120 };
const sectionHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "end", flexWrap: "wrap" };
const sectionTitleStyle: CSSProperties = { margin: "5px 0 0", color: "#fff", fontSize: 24, letterSpacing: "-0.04em" };
const businessGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 0.95fr) minmax(360px, 0.82fr)", gap: 16, marginTop: 28, alignItems: "start" };
const panelStyle: CSSProperties = { padding: 18, borderRadius: 22, background: "linear-gradient(145deg, rgba(20,115,255,0.09), rgba(255,255,255,0.035))", border: "1px solid rgba(255,255,255,0.11)" };
const panelHeaderStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" };
const panelTitleStyle: CSSProperties = { margin: "5px 0 0", color: "#fff", fontSize: 24, lineHeight: 1, letterSpacing: "-0.04em" };
const compactFormGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 };
const fieldLabelStyle: CSSProperties = { color: "#d7e8ff", fontWeight: 850, fontSize: 13 };
const inputStyle = { width: "100%", marginTop: 5, padding: "10px 11px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(5,10,18,0.88)", color: "#fff", outline: "none" } as const;
const drawerStyle = { marginTop: 12, padding: 12, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" } as const;
const drawerSummaryStyle = { color: "#fff", fontWeight: 950, cursor: "pointer", listStyle: "none" } as const;
const drawerCopyStyle: CSSProperties = { color: "#bfd6f5", lineHeight: 1.45, margin: "8px 0 0", fontSize: 13 };
const suggestionGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 7, marginTop: 10, color: "#cfe2ff", lineHeight: 1.45, fontSize: 13 };
const formFooterStyle: CSSProperties = { marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };
const mutedSmallStyle: CSSProperties = { color: "#9fb4d6", fontSize: 13, fontWeight: 750 };
const requestListStyle: CSSProperties = { display: "grid", gap: 10, marginTop: 12 };
const requestCardStyle: CSSProperties = { padding: 14, borderRadius: 18, background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.1)" };
const requestSummaryStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", cursor: "pointer", listStyle: "none" };
const requestTitleStyle: CSSProperties = { margin: 0, color: "#fff", fontSize: 19, lineHeight: 1.05, letterSpacing: "-0.03em" };
const requestMetaStyle: CSSProperties = { margin: "5px 0 0", color: "#bfd6f5", fontSize: 13 };
const requestMetricsStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 76px)", gap: 8 };
const metricStyle: CSSProperties = { padding: 9, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
const metricValueStyle: CSSProperties = { display: "block", color: "#fff", fontSize: 18 };
const metricLabelStyle: CSSProperties = { display: "block", color: "#9fb4d6", fontSize: 11 };
const closeFormStyle: CSSProperties = { marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.09)", display: "grid", gap: 10 };
const closeGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 0.78fr) minmax(0, 1fr)", gap: 10, alignItems: "start" };
const closeFooterStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
const filledGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 12 };
const successCountStyle: CSSProperties = { padding: "7px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", color: "#86efac", fontSize: 12, fontWeight: 950 };
const filledCardStyle: CSSProperties = { padding: 16, borderRadius: 20, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)" };
const filledBadgeStyle: CSSProperties = { display: "inline-flex", padding: "6px 9px", borderRadius: 999, background: "rgba(34,197,94,0.14)", color: "#86efac", fontSize: 11, fontWeight: 950, letterSpacing: "0.08em", textTransform: "uppercase" };
const filledTitleStyle: CSSProperties = { margin: "10px 0 0", color: "#fff", fontSize: 20, lineHeight: 1, letterSpacing: "-0.035em" };
const filledCopyStyle: CSSProperties = { color: "#9fb4d6", lineHeight: 1.45, fontSize: 13, marginBottom: 0 };
const nextActionNoticeStyle: CSSProperties = { padding: 12, borderRadius: 16, background: "rgba(20,115,255,0.08)", border: "1px solid rgba(96,165,250,0.16)", color: "#bfd6f5", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
const scheduleCardStyle: CSSProperties = { padding: 18, borderRadius: 22, background: "linear-gradient(145deg, rgba(251,191,36,0.105), rgba(255,255,255,0.035))", border: "1px solid rgba(251,191,36,0.22)" };
const decisionCardStyle: CSSProperties = { padding: 18, borderRadius: 22, background: "linear-gradient(145deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))", border: "1px solid rgba(255,255,255,0.12)" };
const candidateHeaderStyle: CSSProperties = { display: "grid", gridTemplateColumns: "60px minmax(0, 1fr) auto", gap: 14, alignItems: "center" };
const candidatePhotoBaseStyle: CSSProperties = { overflow: "hidden", background: "rgba(20,115,255,0.14)", border: "1px solid rgba(147,197,253,0.24)", display: "grid", placeItems: "center", color: "#dbeafe", fontWeight: 950 };
const candidateNameStyle: CSSProperties = { margin: 0, color: "#fff", fontSize: 24, letterSpacing: "-0.04em", lineHeight: 1 };
const candidateSublineStyle: CSSProperties = { margin: "5px 0 0", color: "#bfd6f5", fontSize: 13 };
const candidateSummaryStyle: CSSProperties = { color: "#9fb4d6", lineHeight: 1.45, margin: "7px 0 0", fontSize: 13 };
const tagRowStyle: CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 };
const tagStyle: CSSProperties = { padding: "4px 7px", borderRadius: 999, background: "rgba(147,197,253,0.12)", border: "1px solid rgba(147,197,253,0.18)", color: "#dbeafe", fontSize: 11, fontWeight: 850 };
const candidateRightStyle: CSSProperties = { display: "grid", gap: 7, justifyItems: "end" };
const fitBadgeStyle: CSSProperties = { padding: "7px 9px", borderRadius: 999, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.22)", color: "#fbbf24", fontSize: 12, fontWeight: 950 };
const resumeQuickLinkStyle: CSSProperties = { color: "#93c5fd", textDecoration: "none", fontSize: 12, fontWeight: 950 };
const packetDetailsStyle: CSSProperties = { marginTop: 12, padding: 13, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)" };
const packetSummaryStyle: CSSProperties = { color: "#fff", fontWeight: 900, cursor: "pointer" };
const packetGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "145px minmax(0, 0.65fr) minmax(0, 1.15fr)", gap: 10, marginTop: 12, alignItems: "stretch" };
const embeddedFormStyle: CSSProperties = { marginTop: 12, padding: 13, borderRadius: 16, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" };
const formTitleStyle: CSSProperties = { margin: "0 0 10px", color: "#fff", fontSize: 17 };
const formFooterBetweenStyle: CSSProperties = { marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" };
const packetIdentityStyle: CSSProperties = { padding: 12, borderRadius: 14, background: "rgba(5,10,18,0.5)", border: "1px solid rgba(255,255,255,0.08)", display: "grid", gap: 8, justifyItems: "center", textAlign: "center" };
const packetRoleStyle: CSSProperties = { color: "#bfd6f5", display: "block", marginTop: 4, fontSize: 12 };
const packetFitStyle: CSSProperties = { color: "#fbbf24", display: "block", marginTop: 5, fontSize: 12, fontWeight: 900 };
const packetBoxStyle: CSSProperties = { padding: 12, borderRadius: 14, background: "rgba(5,10,18,0.5)", border: "1px solid rgba(255,255,255,0.08)" };
const resumeLinkStyle: CSSProperties = { display: "inline-flex", marginTop: 8, color: "#93c5fd", fontWeight: 900, textDecoration: "none" };
const packetMutedTextStyle: CSSProperties = { color: "#bfd6f5", display: "block", marginTop: 6, fontSize: 13, lineHeight: 1.4 };
const questionListStyle: CSSProperties = { margin: "8px 0 0", paddingLeft: 18, color: "#bfd6f5", fontSize: 12, lineHeight: 1.4 };
const statusBadgeStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 132, minHeight: 34, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 950, textAlign: "center", background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac" };
const emptyMiniCardStyle: CSSProperties = { padding: 13, borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", color: "#bfd6f5", lineHeight: 1.45 };
const emptyStateStyle: CSSProperties = { marginTop: 12, padding: 18, borderRadius: 18, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#cfe2ff" };
