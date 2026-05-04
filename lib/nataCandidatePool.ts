import { supabaseAdmin } from "./supabaseAdmin";

type AnyRow = Record<string, any>;

const MIN_ELIGIBLE_SCORE = 78;
const MIN_REVIEW_SCORE = 62;
const MIN_MORE_STATE_SCORE = 45;
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
  return normalize(status) === "no_show"
    ? NO_SHOW_COOLDOWN_DAYS
    : DEFAULT_COOLDOWN_DAYS;
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
  if (normalized.includes("service") && normalized.includes("advisor")) {
    return "service advisor";
  }
  if (normalized.includes("technician") || normalized.includes("tech")) {
    return "service technician";
  }
  if (normalized.includes("bdc")) return "bdc representative";
  if (normalized.includes("parts")) return "parts advisor";
  if (normalized.includes("finance") || normalized.includes("f&i")) {
    return "finance manager";
  }

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
    candidate.search_text,
    ...(Array.isArray(candidate.target_roles) ? candidate.target_roles : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function scoreRoleFit(candidate: AnyRow, job: AnyRow) {
  const roleKey = getJobRoleKey(job);
  const text = getCandidateSearchText(candidate);
  const targetRoles = getTargetRoles(candidate);
  const reasons: string[] = [];
  const verificationItems: string[] = [];

  let score = 0;

  if (targetRoles.some((role) => role.includes(roleKey) || roleKey.includes(role))) {
    score += 28;
    reasons.push(`Target role aligns with ${roleKey}.`);
  }

  if (roleKey === "sales consultant") {
    if (includesAny(text, ["sales consultant", "sales associate", "automotive sales"])) {
      score += 16;
      reasons.push("Automotive sales signal is present.");
    } else if (text.includes("sales")) {
      score += 10;
      reasons.push("General sales signal is present.");
    }

    if (includesAny(text, ["closing", "closer", "objection handling"])) score += 8;
    if (includesAny(text, ["crm", "vinsolutions", "dealersocket", "elead"])) score += 7;
    if (includesAny(text, ["appointment", "follow-up", "follow up"])) score += 6;
    if (includesAny(text, ["units", "unit volume", "close rate", "closing ratio"])) score += 6;

    verificationItems.push(
      "Verify unit volume, close rate, and whether metrics are documented.",
      "Confirm CRM usage depth and follow-up discipline.",
      "Ask for examples of objection handling and appointment conversion.",
    );
  }

  if (roleKey === "service advisor") {
    if (text.includes("service advisor")) score += 20;
    if (includesAny(text, ["repair order", "ro ", "ros"])) score += 9;
    if (text.includes("warranty")) score += 7;
    if (text.includes("service lane")) score += 7;
    if (text.includes("customer escalation")) score += 6;

    verificationItems.push(
      "Verify repair-order volume and service-lane pressure.",
      "Confirm warranty, estimate, and customer escalation experience.",
    );
  }

  if (roleKey === "service technician") {
    if (includesAny(text, ["technician", "tech"])) score += 18;
    if (text.includes("ase")) score += 12;
    if (text.includes("diagnostic")) score += 10;
    if (text.includes("electrical")) score += 8;
    if (text.includes("tools")) score += 6;

    verificationItems.push(
      "Verify certifications, diagnostic categories, and tool ownership.",
      "Confirm shop experience and repair types handled.",
    );
  }

  if (roleKey === "bdc representative") {
    if (text.includes("bdc")) score += 22;
    if (includesAny(text, ["calls", "call volume"])) score += 8;
    if (text.includes("appointment")) score += 8;
    if (text.includes("crm")) score += 8;
    if (includesAny(text, ["sms", "email follow", "text follow"])) score += 6;

    verificationItems.push(
      "Verify call volume, appointment-set rate, and CRM note quality.",
      "Confirm phone, SMS, and email follow-up discipline.",
    );
  }

  if (roleKey === "parts advisor") {
    if (text.includes("parts")) score += 22;
    if (text.includes("inventory")) score += 8;
    if (text.includes("catalog")) score += 8;
    if (text.includes("counter")) score += 6;

    verificationItems.push(
      "Verify catalog lookup, inventory, counter, and OEM parts experience.",
    );
  }

  if (roleKey === "finance manager") {
    if (includesAny(text, ["finance", "f&i"])) score += 22;
    if (text.includes("lender")) score += 8;
    if (text.includes("compliance")) score += 8;
    if (text.includes("menu")) score += 6;

    verificationItems.push(
      "Verify lender, compliance, menu presentation, and product penetration experience.",
    );
  }

  if (score === 0) {
    reasons.push(`No clear role-specific signal for ${roleKey}.`);
  }

  return {
    roleKey,
    score: Math.max(0, Math.min(score, 45)),
    reasons,
    verificationItems,
  };
}

function scoreProofQuality(candidate: AnyRow) {
  const text = getCandidateSearchText(candidate);
  const reasons: string[] = [];
  const verificationItems: string[] = [];

  let score = 0;

  if (candidate.resume_url) {
    score += 10;
    reasons.push("Resume is available.");
  } else {
    reasons.push("Resume is missing.");
    verificationItems.push("Request resume before advancing.");
  }

  if (candidate.profile_photo_url) {
    score += 2;
  }

  if (candidate.linkedin) {
    score += 4;
    reasons.push("LinkedIn profile is available.");
  }

  if (includesAny(text, ["units", "unit volume", "close rate", "closing ratio", "gross", "revenue"])) {
    score += 6;
    reasons.push("Measurable performance claim is present.");
    verificationItems.push("Verify measurable performance claims with context.");
  }

  if (includesAny(text, ["ase", "certified", "certification", "manufacturer certified"])) {
    score += 6;
    reasons.push("Certification signal is present.");
    verificationItems.push("Confirm certification status and expiration where applicable.");
  }

  if (includesAny(text, ["vinsolutions", "dealersocket", "elead", "tekion", "reynolds", "cdk"])) {
    score += 5;
    reasons.push("Specific dealership system experience is present.");
  } else if (text.includes("crm")) {
    score += 3;
    reasons.push("Generic CRM experience is present.");
    verificationItems.push("Confirm which CRM and actual usage depth.");
  }

  if (includesAny(text, ["top performer", "top ranked", "ranked", "award", "president's club"])) {
    score += 3;
    reasons.push("Recognition claim is present.");
    verificationItems.push("Clarify store size and ranking context for performance claims.");
  }

  if (!candidate.experience_summary || normalize(candidate.experience_summary).length < 80) {
    score -= 5;
    reasons.push("Experience summary is thin.");
    verificationItems.push("Collect a stronger experience summary before dealer exposure.");
  }

  return {
    score: Math.max(0, Math.min(score, 25)),
    reasons,
    verificationItems,
  };
}

function scoreLocationFit(candidate: AnyRow, job: AnyRow) {
  const text = getCandidateSearchText(candidate);
  const distance = getDistanceMiles(candidate, job);
  const reasons: string[] = [];
  const verificationItems: string[] = [];
  const riskFlags: string[] = [];

  let score = 0;

  if (distance !== null) {
    if (distance <= 25) {
      score += 15;
      reasons.push(`Candidate is within ${Math.round(distance)} miles.`);
    } else if (distance <= MAX_MATCH_DISTANCE_MILES) {
      score += 10;
      reasons.push(`Candidate is within ${Math.round(distance)} miles.`);
    } else {
      score -= 18;
      reasons.push(
        `Candidate is ${Math.round(distance)} miles away, outside preferred radius.`,
      );
      riskFlags.push("outside_preferred_radius");
      verificationItems.push("Confirm relocation or commute plan before advancing.");
    }
  } else if (candidate.location_text) {
    const locationText = normalize(candidate.location_text);

    if (
      includesAny(locationText, ["open to relocation", "relocate", "relocation", "willing to move"])
    ) {
      score += 4;
      reasons.push("Candidate states relocation openness.");
      riskFlags.push("relocation_not_verified");
      verificationItems.push("Confirm relocation timing, target market, and compensation needs.");
    } else {
      score += 6;
      reasons.push("Candidate provided a location, but distance was not computed.");
      verificationItems.push("Confirm commute or relocation fit.");
    }
  } else {
    score -= 8;
    reasons.push("Candidate location is missing.");
    riskFlags.push("location_missing");
    verificationItems.push("Collect candidate location before matching.");
  }

  if (includesAny(text, ["open to relocation", "relocate", "relocation", "willing to move"])) {
    verificationItems.push("Confirm relocation commitment before dealer exposure.");
  }

  return {
    score: Math.max(-20, Math.min(score, 15)),
    distance,
    reasons,
    verificationItems,
    riskFlags,
  };
}

function scoreRisk(candidate: AnyRow, roleKey: string) {
  const text = getCandidateSearchText(candidate);
  const reasons: string[] = [];
  const riskFlags: string[] = [];
  const verificationItems: string[] = [];

  let deduction = 0;

  if (candidate.cooldown_until && new Date(candidate.cooldown_until).getTime() > Date.now()) {
    deduction += 18;
    reasons.push("Candidate is inside a post-decision cooldown window.");
    riskFlags.push("cooldown_active");
  }

  if (includesAny(text, ["short tenure", "limited tenure", "8 months", "less than a year"])) {
    deduction += 8;
    reasons.push("Short-tenure signal requires recruiter review.");
    riskFlags.push("limited_tenure");
    verificationItems.push("Clarify reason for short tenure and prior role transitions.");
  }

  if (
    roleKey === "sales consultant" &&
    includesAny(text, ["18", "20", "22", "24", "units", "30%", "30 percent", "top performer"])
  ) {
    deduction += 5;
    reasons.push("High sales-performance claim requires verification.");
    riskFlags.push("performance_claim_requires_verification");
    verificationItems.push("Verify claimed unit volume, close rate, and store context.");
  }

  if (includesAny(text, ["claimed", "unverified", "unclear", "unknown", "inconsistent"])) {
    deduction += 7;
    reasons.push("Candidate record contains unverified or ambiguous claims.");
    riskFlags.push("unverified_claims");
    verificationItems.push("Resolve ambiguous claims before dealer exposure.");
  }

  if (includesAny(text, ["career pivot", "transitioned from", "fitness", "retail", "restaurant"])) {
    deduction += 4;
    reasons.push("Career pivot may be valid but needs context.");
    riskFlags.push("career_pivot");
    verificationItems.push("Ask why the candidate moved into automotive and what has kept them there.");
  }

  if (!candidate.resume_url) {
    deduction += 12;
    riskFlags.push("resume_missing");
  }

  if (!candidate.phone) {
    deduction += 6;
    riskFlags.push("phone_missing");
    verificationItems.push("Collect candidate phone number.");
  }

  return {
    score: Math.max(0, Math.min(deduction, 35)),
    reasons,
    riskFlags,
    verificationItems,
  };
}

function determineMatchStatus(input: {
  fitScore: number;
  riskFlags: string[];
  roleScore: number;
  proofScore: number;
  cooldownActive: boolean;
}) {
  if (input.cooldownActive) return "cooldown";

  if (input.roleScore < 12) return "below_threshold";

  if (
    input.riskFlags.includes("resume_missing") ||
    input.riskFlags.includes("location_missing")
  ) {
    return "more_state_required";
  }

  if (
    input.riskFlags.includes("performance_claim_requires_verification") ||
    input.riskFlags.includes("relocation_not_verified") ||
    input.riskFlags.includes("limited_tenure") ||
    input.riskFlags.includes("unverified_claims")
  ) {
    return input.fitScore >= MIN_REVIEW_SCORE ? "recruiter_review" : "more_state_required";
  }

  if (input.fitScore >= MIN_ELIGIBLE_SCORE && input.proofScore >= 12) {
    return "eligible";
  }

  if (input.fitScore >= MIN_REVIEW_SCORE) {
    return "recruiter_review";
  }

  if (input.fitScore >= MIN_MORE_STATE_SCORE) {
    return "more_state_required";
  }

  return "below_threshold";
}

function uniqueList(items: string[]) {
  return Array.from(
    new Set(items.map((item) => item.trim()).filter(Boolean)),
  );
}

function computeMatch(candidate: AnyRow, job: AnyRow) {
  const roleFit = scoreRoleFit(candidate, job);
  const proof = scoreProofQuality(candidate);
  const location = scoreLocationFit(candidate, job);
  const risk = scoreRisk(candidate, roleFit.roleKey);

  const baseScore = 25;
  const jobStatusScore =
    job.publish_status === "published" && job.is_active !== false && !job.filled_at ? 5 : 0;

  const rawScore =
    baseScore +
    roleFit.score +
    proof.score +
    location.score +
    jobStatusScore -
    risk.score;

  const fitScore = Math.max(0, Math.min(100, Math.round(rawScore)));
  const riskFlags = uniqueList([...location.riskFlags, ...risk.riskFlags]);
  const verificationItems = uniqueList([
    ...roleFit.verificationItems,
    ...proof.verificationItems,
    ...location.verificationItems,
    ...risk.verificationItems,
  ]);

  const matchStatus = determineMatchStatus({
    fitScore,
    riskFlags,
    roleScore: roleFit.score,
    proofScore: proof.score,
    cooldownActive: riskFlags.includes("cooldown_active"),
  });

  const reasons = uniqueList([
    ...roleFit.reasons,
    ...proof.reasons,
    ...location.reasons,
    ...risk.reasons,
    `Role score: ${roleFit.score}/45.`,
    `Proof score: ${proof.score}/25.`,
    `Location score: ${location.score}/15.`,
    `Risk deduction: ${risk.score}/35.`,
    `Decision status: ${matchStatus}.`,
  ]);

  return {
    distance_miles:
      location.distance === null ? null : Math.round(location.distance * 10) / 10,
    fit_score: fitScore,
    role_score: roleFit.score,
    proof_score: proof.score,
    location_score: location.score,
    risk_score: risk.score,
    risk_flags: riskFlags,
    verification_items: verificationItems.slice(0, 8),
    match_status: matchStatus,
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
    `Candidate previously applied for ${label(
      job?.title || application.role,
      "a dealership role",
    )}.`,
  );
}

async function upsertCandidateMatch(row: AnyRow) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .schema("nata")
    .from("candidate_matches")
    .select("id")
    .eq("candidate_id", row.candidate_id)
    .eq("job_id", row.job_id)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check existing candidate match:", existingError);
    return;
  }

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .schema("nata")
      .from("candidate_matches")
      .update(row)
      .eq("id", existing.id);

    if (error) console.error("Failed to update candidate match:", error);
    return;
  }

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("candidate_matches")
    .insert(row);

  if (error) console.error("Failed to insert candidate match:", error);
}

export async function syncCandidateMatches(candidate: AnyRow) {
  if (!candidate?.id) {
    console.error("Cannot sync candidate matches without candidate id.");
    return;
  }

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

  for (const job of (jobs || []) as AnyRow[]) {
    const match = computeMatch(candidate, job);

    await upsertCandidateMatch({
      candidate_id: candidate.id,
      job_id: job.id,
      distance_miles: match.distance_miles,
      fit_score: match.fit_score,
      role_score: match.role_score,
      proof_score: match.proof_score,
      location_score: match.location_score,
      risk_score: match.risk_score,
      risk_flags: match.risk_flags,
      verification_items: match.verification_items,
      match_status: match.match_status,
      match_reason: match.match_reason,
      updated_at: new Date().toISOString(),
    });
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

  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check placed candidate record:", existingError);
    return;
  }

  const payload = {
    name: label(application.name || application.candidate_name || application.email, "Candidate"),
    email,
    phone: label(application.phone || application.candidate_phone, ""),
    status: "placed",
    availability_status: "working_at_client",
    cooldown_until: null,
    updated_at: now,
  };

  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .update(payload)
      .eq("id", existing.id);

    if (updateError) console.error("Failed to protect placed candidate:", updateError);
    return;
  }

  const { error: insertError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .insert(payload);

  if (insertError) {
    console.error("Failed to insert placed candidate protection record:", insertError);
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

  if (!POOL_RETURN_STATUSES.includes(status)) return null;

  const email = normalize(application.email || application.candidate_email);
  if (!email) return null;

  const { data: job } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", application.job_id)
    .maybeSingle();

  const now = new Date().toISOString();
  const targetRoles = inferTargetRolesFromApplication(application, job);
  const experienceSummary = buildExperienceSummary(application, job, reason);

  const { data: existingCandidate, error: existingCandidateError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id,contact_count,rejection_count")
    .eq("email", email)
    .maybeSingle();

  if (existingCandidateError) {
    console.error("Failed to check existing candidate before pool return:", existingCandidateError);
    return null;
  }

  const payload = {
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
    cooldown_until: addDays(getCooldownDays(status)),
    rejection_count: Number(existingCandidate?.rejection_count || 0) + 1,
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
  };

  let candidate: AnyRow | null = null;

  if (existingCandidate?.id) {
    const { data: updatedCandidate, error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .update(payload)
      .eq("id", existingCandidate.id)
      .select("*")
      .single();

    if (updateError || !updatedCandidate) {
      console.error("Failed to update candidate pool record:", updateError);
      return null;
    }

    candidate = updatedCandidate as AnyRow;
  } else {
    const { data: insertedCandidate, error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .insert(payload)
      .select("*")
      .single();

    if (insertError || !insertedCandidate) {
      console.error("Failed to insert candidate pool record:", insertError);
      return null;
    }

    candidate = insertedCandidate as AnyRow;
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

  if (noteError) console.error("Failed to append candidate pool return note:", noteError);

  return candidate;
}

export async function incrementCandidateContactByEmail(emailValue: string) {
  const email = normalize(emailValue);
  if (!email) return;

  const { data: existing } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id,contact_count")
    .eq("email", email)
    .maybeSingle();

  if (!existing?.id) return;

  const nextContactCount = Number(existing.contact_count || 0) + 1;

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .update({
      last_contacted_at: new Date().toISOString(),
      contact_count: nextContactCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (error) console.error("Failed to increment candidate contact count:", error);
}
