import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

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

const MIN_MATCH_SCORE = 70;
const MAX_MATCH_DISTANCE_MILES = 100;
const DEFAULT_COOLDOWN_DAYS = 30;
const NO_SHOW_COOLDOWN_DAYS = 45;

type AnyRow = Record<string, any>;

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

function getCooldownDays(outcome: string) {
  const normalized = normalize(outcome);

  if (normalized === "no_show") return NO_SHOW_COOLDOWN_DAYS;

  return DEFAULT_COOLDOWN_DAYS;
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

function computeMatch(candidate: AnyRow, job: AnyRow) {
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

  if (candidate.cooldown_until && new Date(candidate.cooldown_until).getTime() > Date.now()) {
    score -= 10;
    reasons.push("Candidate is currently inside a post-decision cooldown window.");
  }

  const fitScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    distance_miles: distance === null ? null : Math.round(distance * 10) / 10,
    fit_score: fitScore,
    match_status: fitScore >= MIN_MATCH_SCORE ? "eligible" : "below_threshold",
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

function buildExperienceSummary(application: AnyRow, job: AnyRow | null) {
  return label(
    application.experience_summary ||
      application.screening_summary ||
      application.cover_note ||
      application.decision_reason,
    `Candidate previously applied for ${label(job?.title || application.role, "a dealership role")}.`,
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

async function markCandidatePlaced(email: string) {
  if (!email) return;

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .update({
      status: "placed",
      availability_status: "working_at_client",
      cooldown_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);

  if (error) {
    console.error("Failed to protect placed candidate:", error);
  }
}

async function returnCandidateToPool(input: {
  application: AnyRow;
  job: AnyRow | null;
  outcome: string;
  decisionReason: string;
}) {
  const { application, job, outcome, decisionReason } = input;
  const email = normalize(application.email || application.candidate_email);

  if (!email) return null;

  const cooldownUntil = addDays(getCooldownDays(outcome));
  const targetRoles = inferTargetRolesFromApplication(application, job);
  const experienceSummary = buildExperienceSummary(application, job);
  const now = new Date().toISOString();

  const { data: existingCandidate } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id,contact_count,rejection_count")
    .eq("email", email)
    .maybeSingle();

  const nextRejectionCount = Number(existingCandidate?.rejection_count || 0) + 1;

  const { data: candidate, error } = await supabaseAdmin
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
        availability_status: normalize(outcome) === "no_show" ? "cooldown" : "available",
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
          decisionReason,
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

  if (error || !candidate) {
    console.error("Failed to return candidate to pool:", error);
    return null;
  }

  await syncCandidateMatches(candidate);

  return candidate;
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

    const { data: job, error: jobError } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();

    if (jobError) {
      console.error("Failed to load job for decision:", jobError);
    }

    const email = normalize(application.email || application.candidate_email);
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
      decisionPayload.status = "hired";
      decisionPayload.dealer_hired_at = now;
    }

    if (POOL_STATUSES.includes(normalizedOutcome)) {
      decisionPayload.last_rejected_at = now;
    }

    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update(decisionPayload)
      .eq("id", application_id);

    if (updateError) {
      console.error("Failed to update application decision:", updateError);
      return NextResponse.json(
        { error: "Decision could not be recorded." },
        { status: 500 },
      );
    }

    if (PLACED_STATUSES.includes(normalizedOutcome)) {
      await markCandidatePlaced(email);

      if (job_id) {
        const { error: jobCloseError } = await supabaseAdmin
          .schema("nata")
          .from("jobs")
          .update({
            is_active: false,
            publish_status: "filled",
            filled_at: now,
            updated_at: now,
          })
          .eq("id", job_id);

        if (jobCloseError) {
          console.error("Failed to close filled job:", jobCloseError);
        }
      }

      return NextResponse.json({
        ok: true,
        job_closed: true,
      });
    }

    let returnedCandidate = null;

    if (POOL_STATUSES.includes(normalizedOutcome)) {
      returnedCandidate = await returnCandidateToPool({
        application,
        job,
        outcome: normalizedOutcome,
        decisionReason: decision_reason,
      });
    }

    if (KEEP_WARM_STATUSES.includes(normalizedOutcome)) {
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
