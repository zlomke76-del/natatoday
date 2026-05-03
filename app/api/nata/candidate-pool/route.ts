import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type AnyRow = Record<string, any>;

const MIN_MATCH_SCORE = 70;
const MAX_MATCH_DISTANCE_MILES = 100;
const DEFAULT_COOLDOWN_DAYS = 30;
const NO_SHOW_COOLDOWN_DAYS = 45;

const POOL_RETURN_STATUSES = [
  "not_fit",
  "passed",
  "pass",
  "rejected",
  "dealer_rejected",
  "not_selected",
  "interview_not_selected",
  "not_hired",
  "withdrawn",
  "no_show",
];

const PLACED_STATUSES = [
  "placed",
  "hired",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
];

export type CandidatePoolReturnSource =
  | "recruiter_rejected"
  | "dealer_rejected"
  | "not_hired"
  | "withdrawn"
  | "system";

function normalize(value: unknown) {
  return String(value || "").toLowerCase().trim();
}

function label(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function toNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function getCooldownDays(status: string) {
  const normalized = normalize(status);
  return normalized === "no_show" ? NO_SHOW_COOLDOWN_DAYS : DEFAULT_COOLDOWN_DAYS;
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 3958.8;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistanceMiles(candidate: AnyRow, job: AnyRow) {
  const candidateLat = toNumber(candidate.latitude);
  const candidateLon = toNumber(candidate.longitude);
  const jobLat = toNumber(job.latitude);
  const jobLon = toNumber(job.longitude);

  if (
    candidateLat === null ||
    candidateLon === null ||
    jobLat === null ||
    jobLon === null
  ) {
    return null;
  }

  return haversineMiles(candidateLat, candidateLon, jobLat, jobLon);
}

function splitList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getRoleKey(roleTitle: string) {
  const normalized = normalize(roleTitle);

  if (normalized.includes("sales")) return "sales consultant";
  if (normalized.includes("service") && normalized.includes("advisor")) return "service advisor";
  if (normalized.includes("technician") || normalized.includes("tech")) return "service technician";
  if (normalized.includes("bdc")) return "bdc representative";
  if (normalized.includes("parts")) return "parts advisor";
  if (normalized.includes("finance") || normalized.includes("f&i")) return "finance manager";

  return "";
}

function getJobRoleKey(job: AnyRow) {
  return getRoleKey(String(job.title || "")) || "general";
}

function getTargetRoles(candidate: AnyRow) {
  if (Array.isArray(candidate.target_roles)) {
    return candidate.target_roles.map((role) => normalize(role)).filter(Boolean);
  }

  return [];
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

function scoreRoleFit(candidate: AnyRow, job: AnyRow) {
  const roleKey = getJobRoleKey(job);
  const text = getCandidateSearchText(candidate);
  const targetRoles = getTargetRoles(candidate);
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

  if (score > 0 && reasons.length === 0) {
    reasons.push(`Candidate has role-specific signal for ${roleKey}.`);
  }

  return {
    roleKey,
    score: Math.min(score, 45),
    reasons,
  };
}

function getDaysSince(value: unknown) {
  if (!value || typeof value !== "string") return null;

  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) return null;

  return (Date.now() - time) / (1000 * 60 * 60 * 24);
}

function isInCooldown(candidate: AnyRow) {
  if (!candidate.cooldown_until) return false;

  const cooldownTime = new Date(candidate.cooldown_until).getTime();

  return Number.isFinite(cooldownTime) && cooldownTime > Date.now();
}

function computeMatch(candidate: AnyRow, job: AnyRow) {
  let score = 50;
  const reasons: string[] = [];

  const roleFit = scoreRoleFit(candidate, job);
  score += roleFit.score;
  reasons.push(...roleFit.reasons);

  const distance = getDistanceMiles(candidate, job);

  if (distance !== null) {
    if (distance <= MAX_MATCH_DISTANCE_MILES) {
      score += 10;
      reasons.push(`Candidate is within ${Math.round(distance)} miles.`);
    } else {
      score -= 35;
      reasons.push(`Candidate is ${Math.round(distance)} miles away, outside preferred radius.`);
    }
  } else if (candidate.location_text) {
    score += 5;
    reasons.push("Candidate provided a local market or ZIP.");
  }

  const candidateText = getCandidateSearchText(candidate);
  const jobText = [
    job.title,
    job.description,
    job.public_description,
    job.summary,
    job.requirements,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    candidateText.includes("dealership") ||
    candidateText.includes("automotive") ||
    candidateText.includes("car sales") ||
    candidateText.includes("auto sales")
  ) {
    score += 12;
    reasons.push("Candidate has automotive or dealership experience signal.");
  }

  if (jobText.includes("sales") && candidateText.includes("sales")) {
    score += 8;
    reasons.push("Sales language aligns with the role.");
  }

  if (jobText.includes("service") && candidateText.includes("service")) {
    score += 8;
    reasons.push("Service language aligns with the role.");
  }

  if (
    (jobText.includes("technician") || jobText.includes("tech")) &&
    (candidateText.includes("technician") || candidateText.includes("tech"))
  ) {
    score += 10;
    reasons.push("Technician language aligns with the role.");
  }

  const daysSinceUpdate = getDaysSince(candidate.updated_at);

  if (daysSinceUpdate !== null) {
    if (daysSinceUpdate <= 7) {
      score += 8;
      reasons.push("Candidate record was updated in the last week.");
    } else if (daysSinceUpdate <= 30) {
      score += 4;
      reasons.push("Candidate record was updated in the last 30 days.");
    }
  }

  if (candidate.resume_url) {
    score += 7;
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

  const contactCount = Number(candidate.contact_count || 0);

  if (contactCount >= 6) {
    score -= 18;
    reasons.push("Candidate has high prior contact volume.");
  } else if (contactCount >= 3) {
    score -= 10;
    reasons.push("Candidate has moderate prior contact volume.");
  }

  const daysSinceRejected = getDaysSince(candidate.last_rejected_at);

  if (daysSinceRejected !== null) {
    if (daysSinceRejected <= 7) {
      score -= 25;
      reasons.push("Candidate was rejected in the last 7 days.");
    } else if (daysSinceRejected <= 30) {
      score -= 12;
      reasons.push("Candidate was rejected in the last 30 days.");
    } else if (daysSinceRejected <= 90) {
      score -= 5;
      reasons.push("Candidate was rejected in the last 90 days.");
    }
  }

  const inCooldown = isInCooldown(candidate);

  if (inCooldown) {
    score -= 40;
    reasons.push("Candidate is inside an enforced cooldown window.");
  }

  if (normalize(candidate.availability_status) === "do_not_contact") {
    score = 0;
    reasons.push("Candidate is marked do-not-contact.");
  }

  if (normalize(candidate.availability_status) === "working_at_client") {
    score = Math.min(score, 45);
    reasons.push("Candidate is marked as working at a client dealership.");
  }

  const fitScore = Math.max(0, Math.min(100, Math.round(score)));
  const eligible =
    fitScore >= MIN_MATCH_SCORE &&
    !inCooldown &&
    normalize(candidate.availability_status) !== "do_not_contact" &&
    normalize(candidate.availability_status) !== "working_at_client";

  return {
    distance_miles: distance === null ? null : Math.round(distance * 10) / 10,
    fit_score: fitScore,
    match_status: eligible ? "eligible" : inCooldown ? "cooldown" : "below_threshold",
    match_reason: reasons.join(" "),
  };
}

function inferTargetRolesFromApplication(application: AnyRow, job: AnyRow | null) {
  const explicit = splitList(application.target_roles);

  if (explicit.length) return explicit.map((item) => item.toLowerCase());

  const roleTitle = label(application.role || application.job_title || job?.title, "");
  const roleKey = roleTitle ? getRoleKey(roleTitle) : "";

  return roleKey ? [roleKey] : [];
}

function buildExperienceSummary(application: AnyRow, job: AnyRow | null, reason: string) {
  return label(
    application.experience_summary ||
      application.screening_summary ||
      application.cover_note ||
      reason ||
      application.decision_reason,
    `Candidate previously applied for ${label(job?.title || application.role, "a dealership role")}.`,
  );
}

export async function syncCandidateMatches(candidate: AnyRow) {
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
    console.error("Failed to load jobs for candidate matching:", error);
    return;
  }

  const rows = ((jobs || []) as AnyRow[]).map((job) => {
    const match = computeMatch(candidate, job);

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
    console.error("Failed to sync candidate matches:", matchError);
  }
}

export async function markCandidatePlacedFromApplication(applicationId: string) {
  const { data: application, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !application) {
    console.error("Failed to load application for placed candidate protection:", error);
    return;
  }

  const email = normalize(application.email || application.candidate_email);

  if (!email) return;

  const { error: updateError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .update({
      status: "placed",
      availability_status: "working_at_client",
      cooldown_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  if (updateError) {
    console.error("Failed to protect placed candidate:", updateError);
  }
}

export async function returnApplicationToCandidatePool(input: {
  applicationId: string;
  source: CandidatePoolReturnSource;
  reason: string;
}) {
  const { applicationId, source, reason } = input;

  const { data: application, error: applicationError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError || !application) {
    console.error("Failed to load application for candidate pool return:", applicationError);
    return null;
  }

  const status = normalize(application.status);

  if (PLACED_STATUSES.includes(status)) {
    await markCandidatePlacedFromApplication(applicationId);
    return null;
  }

  if (!POOL_RETURN_STATUSES.includes(status)) {
    return null;
  }

  const email = normalize(application.email || application.candidate_email);

  if (!email) return null;

  const { data: job } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", application.job_id)
    .maybeSingle();

  const now = new Date().toISOString();
  const cooldownUntil = addDays(getCooldownDays(status));
  const targetRoles = inferTargetRolesFromApplication(application, job);
  const experienceSummary = buildExperienceSummary(application, job, reason);

  const { data: existingCandidate } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id,contact_count,rejection_count")
    .eq("email", email)
    .maybeSingle();

  const nextRejectionCount = Number(existingCandidate?.rejection_count || 0) + 1;

  const { data: candidate, error: upsertError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .upsert(
      {
        name: label(application.name || application.candidate_name || application.email, "Candidate"),
        email,
        phone: label(application.phone || application.candidate_phone, ""),
        linkedin: application.linkedin || null,
        location_text:
          application.location_text ||
          application.location ||
          application.city ||
          application.market ||
          null,
        resume_url:
          application.resume_url ||
          application.resume_public_url ||
          application.resume_path ||
          null,
        profile_photo_url:
          application.profile_photo_url ||
          application.photo_url ||
          application.candidate_photo_url ||
          null,
        target_roles: targetRoles,
        experience_summary: experienceSummary,
        status: "active",
        availability_status: status === "no_show" ? "cooldown" : "available",
        last_rejected_at: now,
        cooldown_until: cooldownUntil,
        rejection_count: nextRejectionCount,
        search_text: [
          application.name,
          application.email,
          application.phone,
          application.linkedin,
          application.location_text,
          targetRoles.join(" "),
          experienceSummary,
          reason,
          source,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
        updated_at: now,
      },
      { onConflict: "email" },
    )
    .select("*")
    .single();

  if (upsertError || !candidate) {
    console.error("Failed to return application to candidate pool:", upsertError);
    return null;
  }

  await syncCandidateMatches(candidate);

  const existingReason = label(application.decision_reason, "");
  const poolNote = `[Pool return: ${source}] ${reason}`;

  const { error: noteError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .update({
      decision_reason: existingReason ? `${existingReason}\n${poolNote}` : poolNote,
    })
    .eq("id", applicationId);

  if (noteError) {
    console.error("Failed to append candidate pool return note:", noteError);
  }

  return candidate;
}

export async function incrementCandidateContactByEmail(emailValue: string) {
  const email = normalize(emailValue);

  if (!email) return;

  const { data: existing } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("contact_count")
    .eq("email", email)
    .maybeSingle();

  const nextContactCount = Number(existing?.contact_count || 0) + 1;
  const now = new Date().toISOString();

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .update({
      last_contacted_at: now,
      contact_count: nextContactCount,
      cooldown_until: addDays(7),
      availability_status: "contacted",
      updated_at: now,
    })
    .eq("email", email);

  if (error) {
    console.error("Failed to increment candidate contact count:", error);
  }
}
