import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { buildCandidateScheduleUrl, sendInterviewInvite } from "../../../../lib/nataNotifications";
import { returnApplicationToCandidatePool } from "../../../../lib/nataCandidatePool";
import CommunicationsCenter from "./CommunicationsCenter";
import MusicLibraryPlayer from "./MusicLibraryPlayer";
import NataSoundStateBridge from "./NataSoundStateBridge";

type AnyRow = Record<string, any>;

type FitBand = {
  roleKey: string;
  interviewReady: number;
  review: number;
};

type QueueSurface = "candidate" | "interview";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type MusicTrack = {
  id: string;
  title: string;
  artist?: string;
  mood?: string;
  category?: string;
  url: string;
};

const MUSIC_BUCKET = "nata-music-library";
const MIN_MATCH_SCORE = 70;
const MAX_MATCH_DISTANCE_MILES = 100;

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
];

const PLACED_STATUSES = [
  "placed",
  "hired",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
];

async function loadInitialMusicTracks(): Promise<MusicTrack[]> {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("music_tracks")
    .select("id,title,artist,mood,category,storage_bucket,storage_path,sort_order,created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load music tracks:", error);
    return [];
  }

  return (data || []).map((track) => {
    const bucket = String(track.storage_bucket || MUSIC_BUCKET);
    const path = String(track.storage_path || "");
    const { data: publicUrl } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    return {
      id: String(track.id),
      title: label(track.title, "Untitled track"),
      artist: label(track.artist, "NATA Today"),
      mood: label(track.mood, ""),
      category: label(track.category, "workspace"),
      url: publicUrl.publicUrl,
    };
  });
}

const ROLE_THRESHOLDS: Record<string, Omit<FitBand, "roleKey">> = {
  "sales consultant": { interviewReady: 80, review: 60 },
  "service advisor": { interviewReady: 82, review: 65 },
  "service technician": { interviewReady: 78, review: 60 },
  "bdc representative": { interviewReady: 76, review: 58 },
  "parts advisor": { interviewReady: 75, review: 58 },
  "finance manager": { interviewReady: 85, review: 70 },
};

function label(value: unknown, fallback = "Unassigned") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "Not scheduled";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Not scheduled";
  }
}

function cleanFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function yearsSince(value?: string | null) {
  if (!value) return null;

  const time = new Date(value).getTime();

  if (!Number.isFinite(time)) return null;

  return (Date.now() - time) / (1000 * 60 * 60 * 24 * 365.25);
}

function getRoleKey(roleTitle: string) {
  const normalized = roleTitle.toLowerCase();

  if (normalized.includes("sales")) return "sales consultant";
  if (normalized.includes("service") && normalized.includes("advisor")) return "service advisor";
  if (normalized.includes("technician") || normalized.includes("tech")) return "service technician";
  if (normalized.includes("bdc")) return "bdc representative";
  if (normalized.includes("parts")) return "parts advisor";
  if (normalized.includes("finance") || normalized.includes("f&i")) return "finance manager";

  return "sales consultant";
}

function getFitBand(roleTitle: string): FitBand {
  const roleKey = getRoleKey(roleTitle);
  return { roleKey, ...ROLE_THRESHOLDS[roleKey] };
}

function getFitDecision(score: number | null, roleTitle: string) {
  const band = getFitBand(roleTitle);
  const safeScore = typeof score === "number" ? score : null;

  if (safeScore === null) {
    return {
      band,
      label: "Not scored",
      tone: "muted",
      nextAction: "Screen candidate",
      canOpenStudio: false,
    };
  }

  if (safeScore >= band.interviewReady) {
    return {
      band,
      label: "Interview ready",
      tone: "ready",
      nextAction: "Open studio",
      canOpenStudio: true,
    };
  }

  if (safeScore >= band.review) {
    return {
      band,
      label: "Recruiter review",
      tone: "review",
      nextAction: "Review before interview",
      canOpenStudio: false,
    };
  }

  return {
    band,
    label: "Do not advance",
    tone: "blocked",
    nextAction: "Hold or pass candidate",
    canOpenStudio: false,
  };
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

function getFallbackVerification(roleTitle: string, score: number | null) {
  const roleKey = getRoleKey(roleTitle);
  const items = ["Confirm schedule and weekend availability.", "Confirm compensation alignment."];

  if (roleKey === "sales consultant") {
    items.unshift("Verify comfort with commission pressure, objection handling, and high-ticket closing.");
    items.unshift("Ask for measurable sales results: close rate, rank, revenue, or units sold.");
  }

  if (roleKey === "service technician") {
    items.unshift("Verify certifications, tools, diagnostic ability, and shop experience.");
  }

  if (roleKey === "service advisor") {
    items.unshift("Verify service-lane pressure, repair-order handling, and customer escalation ability.");
  }

  if (roleKey === "bdc representative") {
    items.unshift("Verify call volume, CRM notes, appointment setting, and text/email follow-up discipline.");
  }

  if (roleKey === "parts advisor") {
    items.unshift("Verify parts lookup, catalog, inventory, and counter experience.");
  }

  if (roleKey === "finance manager") {
    items.unshift("Verify F&I, lender, warranty, compliance, and menu presentation experience.");
  }

  if (typeof score === "number" && score < getFitBand(roleTitle).review) {
    items.push("Do not advance unless recruiter documents a clear override reason.");
  }

  return items.slice(0, 5);
}

function getFallbackCoaching(roleTitle: string) {
  const roleKey = getRoleKey(roleTitle);

  if (roleKey === "sales consultant") {
    return [
      "Add measurable sales outcomes such as rank, revenue, close rate, or units sold.",
      "Add high-ticket, commission, or automotive sales proof if available.",
      "Add examples of objection handling, follow-up discipline, and appointment setting.",
    ];
  }

  if (roleKey === "service technician") {
    return ["Add certifications, diagnostic examples, tool ownership, and repair categories handled."];
  }

  if (roleKey === "service advisor") {
    return ["Add repair-order, service-lane, customer escalation, and estimate-writing experience."];
  }

  if (roleKey === "bdc representative") {
    return ["Add call volume, appointment rate, CRM tools, and follow-up examples."];
  }

  if (roleKey === "parts advisor") {
    return ["Add parts lookup, inventory, catalog, OEM, and counter/customer examples."];
  }

  return ["Add role-specific proof, measurable outcomes, and dealership-relevant experience."];
}

function getResumeUrl(application: AnyRow) {
  return label(
    application.resume_url ||
      application.resume_public_url ||
      application.resume_path,
    ""
  );
}

function getProfilePhotoUrl(application: AnyRow) {
  return label(
    application.profile_photo_url ||
      application.photo_url ||
      application.candidate_photo_url,
    ""
  );
}

function getCandidateInitials(application: AnyRow) {
  const raw = label(application.name || application.email, "Candidate");
  const parts = raw
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return raw.slice(0, 2).toUpperCase();
}

function hasAnyState(app: AnyRow, states: string[]) {
  const values = [app.status, app.screening_status, app.virtual_interview_status]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return values.some((value) => states.includes(value));
}

function isPassedOrBlocked(app: AnyRow) {
  return hasAnyState(app, [
    "not_fit",
    "passed",
    "pass",
    "rejected",
    "blocked",
    "disqualified",
    "withdrawn",
  ]);
}

function isDealerScheduled(app: AnyRow) {
  return (
    hasAnyState(app, ["dealer_interview_scheduled"]) ||
    Boolean(app.dealer_interview_at && app.interview_packet_ready)
  );
}

function isPacketPending(app: AnyRow) {
  return Boolean(app.virtual_interview_completed_at && !app.interview_packet_ready);
}

function isInterviewToComplete(app: AnyRow) {
  if (app.virtual_interview_completed_at) return false;

  return hasAnyState(app, ["virtual_scheduled", "scheduled"]);
}

function isWaitingOnCandidate(app: AnyRow) {
  if (app.virtual_interview_completed_at) return false;
  if (isInterviewToComplete(app)) return false;

  return hasAnyState(app, ["virtual_invited", "invited"]);
}

function isCandidateQueueActionable(app: AnyRow) {
  if (isPassedOrBlocked(app)) return false;
  if (isDealerScheduled(app)) return false;
  if (isPacketPending(app)) return false;
  if (isInterviewToComplete(app)) return false;
  if (isWaitingOnCandidate(app)) return false;

  return hasAnyState(app, [
    "new",
    "submitted",
    "applied",
    "screened",
    "screening_complete",
    "needs_review",
    "ready_for_recruiter_decision",
    "review",
  ]);
}

function getNextAction(app: AnyRow, roleTitle: string) {
  if (isInterviewToComplete(app)) return "Complete virtual interview";
  if (isWaitingOnCandidate(app)) return "Waiting on candidate to schedule";
  if (isPacketPending(app)) return "Generate packet";
  if (isDealerScheduled(app)) return "Ready for dealer";
  if (isPassedOrBlocked(app)) return "Archived";

  const fit = getFitDecision(typeof app.fit_score === "number" ? app.fit_score : null, roleTitle);

  if (!fit.canOpenStudio) {
    return fit.nextAction;
  }

  return "Approve or open studio";
}

function getBadgeStyle(tone: string): React.CSSProperties {
  if (tone === "ready") return { background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac" };
  if (tone === "review") return { background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" };
  if (tone === "blocked") return { background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5" };
  return { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#cfe2ff" };
}

function normalizeOperatorRole(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasAdminAccess(recruiter: AnyRow) {
  const role = normalizeOperatorRole(recruiter.role);
  const permissions = recruiter.permissions && typeof recruiter.permissions === "object"
    ? recruiter.permissions
    : {};

  return (
    role === "admin" ||
    permissions.can_manage_team === true ||
    permissions.can_view_all === true
  );
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

  if (!application?.email) return;

  const status = normalize(application.status);

  if (PLACED_STATUSES.includes(status)) {
    const { error: placedError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .update({
        status: "placed",
        updated_at: new Date().toISOString(),
      })
      .eq("email", application.email);

    if (placedError) {
      console.error("Failed to protect placed candidate in pool:", placedError);
    }

    return;
  }

function getCurrentDealerSlug(application: AnyRow) {
  return normalize(
    application.current_dealer_slug ||
      application.current_employer_dealer_slug ||
      application.current_rooftop_slug ||
      application.current_dealership_slug ||
      application.current_employer,
  );
}

function getPlacementDate(application: AnyRow) {
  return label(
    application.placed_at ||
      application.hired_at ||
      application.placement_completed_at ||
      application.dealer_hired_at ||
      application.updated_at,
    "",
  );
}

function getDealerProtectionState(application: AnyRow, job: AnyRow | undefined | null) {
  const jobDealerSlug = normalize(job?.dealer_slug);
  const currentDealerSlug = getCurrentDealerSlug(application);
  const sameDealer = Boolean(jobDealerSlug && currentDealerSlug && jobDealerSlug === currentDealerSlug);

  const statusValues = [
    application.status,
    application.screening_status,
    application.virtual_interview_status,
  ].map(normalize);

  const hasPlacementHistory = statusValues.some((status) => PLACED_STATUSES.includes(status));
  const placementYears = yearsSince(getPlacementDate(application));
  const isOldPlacement = placementYears !== null && placementYears >= 2;
  const placementRisk = hasPlacementHistory && !isOldPlacement;
  const hasClientDealerRisk = Boolean(currentDealerSlug && !sameDealer);

  return {
    sameDealer,
    hasPlacementHistory,
    placementYears,
    isOldPlacement,
    placementRisk,
    hasClientDealerRisk,
  };
}

export default async function RecruiterDashboard({
  params,
}: {
  params: { recruiterSlug: string };
}) {
  noStore();

  const { recruiterSlug } = params;

  const { data: recruiter, error: recruiterError } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", recruiterSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (recruiterError) {
    console.error("Failed to load recruiter:", recruiterError);
  }

  if (!recruiter) {
    return (
      <main className="shell">
        <Nav />
        <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "60px 0" }}>
          <div className="eyebrow">Recruiter Control Center</div>
          <h1>Recruiter not found.</h1>
          <p style={{ color: "#cfe2ff" }}>This recruiter workspace does not exist or is inactive.</p>
        </section>
      </main>
    );
  }

  async function approveForInterview(formData: FormData) {
    "use server";

    const applicationId = cleanFormValue(formData.get("application_id"));
    const reason =
      cleanFormValue(formData.get("reason")) ||
      "Recruiter approved candidate for virtual interview after review.";

    if (!applicationId) throw new Error("Application id is required.");

    const { data: application, error: applicationLoadError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id)
      .maybeSingle();

    if (applicationLoadError) throw new Error(applicationLoadError.message);
    if (!application) throw new Error("Application not found for this recruiter.");

    const { data: job } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .eq("id", application.job_id)
      .maybeSingle();

    const protection = getDealerProtectionState(application, job);

    if (protection.sameDealer) {
      throw new Error("Dealer Protection Mode blocked this action because the candidate appears connected to the same rooftop.");
    }

    if ((protection.placementRisk || protection.hasClientDealerRisk) && !reason) {
      throw new Error("Recruiter override reason is required for flagged candidates.");
    }

    const bookingUrl = buildCandidateScheduleUrl(applicationId);
    const overridePrefix =
      protection.placementRisk || protection.hasClientDealerRisk
        ? "[Recruiter Override] "
        : "";

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "virtual_invited",
        screening_status: "virtual_invited",
        virtual_interview_status: "invited",
        virtual_interview_url: bookingUrl,
        decision_reason: `${overridePrefix}${reason}`,
      })
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id);

    if (error) throw new Error(error.message);

    try {
      await sendInterviewInvite({
        applicationId,
        candidateName: label(application.name || application.email, "Candidate"),
        candidateEmail: application.email || null,
        candidatePhone: application.phone || null,
        roleTitle: label(job?.title || application.role, "Candidate"),
        dealerName: label(job?.public_dealer_name || job?.dealer_slug, "Dealer"),
        recruiterName: label(recruiter.name, "your recruiter"),
        bookingUrl,
      });
    } catch (notificationError) {
      console.error("Candidate invite notification failed:", notificationError);
    }

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  async function holdCandidate(formData: FormData) {
    "use server";

    const applicationId = cleanFormValue(formData.get("application_id"));
    const reason = cleanFormValue(formData.get("reason")) || "Recruiter hold: more candidate proof required before interview.";

    if (!applicationId) throw new Error("Application id is required.");

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "needs_review",
        screening_status: "needs_review",
        decision_reason: reason,
      })
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id);

    if (error) throw new Error(error.message);

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  async function passCandidate(formData: FormData) {
    "use server";

    const applicationId = cleanFormValue(formData.get("application_id"));
    const reason = cleanFormValue(formData.get("reason")) || "Recruiter passed candidate after role-specific review.";

    if (!applicationId) throw new Error("Application id is required.");

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "not_fit",
        screening_status: "not_fit",
        decision_reason: reason,
      })
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id);

    if (error) throw new Error(error.message);

    await returnApplicationToCandidatePool({
      applicationId,
      source: "recruiter_rejected",
      reason,
    });

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  const { data: jobsData, error: jobsError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (jobsError) console.error("Failed to load jobs:", jobsError);

  const { data: applicationsData, error: applicationsError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("recruiter_id", recruiter.id)
    .order("created_at", { ascending: false });

  if (applicationsError) console.error("Failed to load recruiter applications:", applicationsError);

  const jobs = (jobsData || []) as AnyRow[];
  const applications = (applicationsData || []) as AnyRow[];
  const canOpenAdmin = hasAdminAccess(recruiter);
  const musicTracks = await loadInitialMusicTracks();

  const openJobs = jobs.filter((job) => job.is_active !== false && !job.filled_at && job.publish_status !== "closed" && job.publish_status !== "filled");

  const interviewQueue = applications.filter(isInterviewToComplete);
  const candidateQueue = applications.filter(isCandidateQueueActionable);
  const waitingOnCandidate = applications.filter(isWaitingOnCandidate);
  const reviewRequired = candidateQueue.filter((app) => hasAnyState(app, ["needs_review", "review"]));
  const packetPending = applications.filter(isPacketPending);
  const dealerScheduled = applications.filter(isDealerScheduled);
  const blocked = applications.filter(isPassedOrBlocked);

  const dealers = Array.from(new Set(openJobs.map((job) => label(job.dealer_slug || job.public_dealer_name, "unknown-dealer")))).map((dealerSlug) => {
    const dealerJobs = openJobs.filter((job) => label(job.dealer_slug || job.public_dealer_name, "unknown-dealer") === dealerSlug);
    const dealerJobIds = new Set(dealerJobs.map((job) => job.id));
    const dealerApps = applications.filter((app) => dealerJobIds.has(app.job_id));
    const readyForDealer = dealerApps.filter(isDealerScheduled);
    const needsInterview = dealerApps.filter(isInterviewToComplete);
    const packetPendingForDealer = dealerApps.filter(isPacketPending);

    let priority = "Monitor";
    if (dealerJobs.length > 0 && readyForDealer.length === 0) priority = "High";
    if (dealerJobs.length > 0 && needsInterview.length > 0) priority = "Action";

    return {
      dealerSlug,
      dealerName: label(dealerJobs[0]?.public_dealer_name || dealerJobs[0]?.dealer_slug, dealerSlug),
      openJobs: dealerJobs.length,
      pipeline: dealerApps.length,
      needsInterview: needsInterview.length,
      packetPending: packetPendingForDealer.length,
      readyForDealer: readyForDealer.length,
      priority,
    };
  });

  function renderApplicationCard(application: AnyRow, surface: QueueSurface) {
    const job = jobs.find((item) => item.id === application.job_id);
    const roleTitle = label(job?.title || application.role, "Candidate");
    const fitScore = typeof application.fit_score === "number" ? application.fit_score : null;
    const fit = getFitDecision(fitScore, roleTitle);
    const verificationItems = splitList(application.interview_questions).length ? splitList(application.interview_questions) : getFallbackVerification(roleTitle, fitScore);
    const coachingItems = splitList(application.verification_items).length ? splitList(application.verification_items) : getFallbackCoaching(roleTitle);
    const nextAction = getNextAction(application, roleTitle);
    const canOpenStudio = surface === "interview" || fit.canOpenStudio;
    const resumeUrl = getResumeUrl(application);
    const profilePhotoUrl = getProfilePhotoUrl(application);
    const protection = getDealerProtectionState(application, job);

    return (
      <article key={application.id} style={candidateCard}>
        <div style={{ display: "grid", gridTemplateColumns: "104px minmax(0, 1fr) auto", gap: 18, alignItems: "start" }}>
          <div style={candidateMedia}>
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt={`${application.name || "Candidate"} profile`}
                style={candidatePhoto}
              />
            ) : (
              <div style={candidatePhotoFallback}>{getCandidateInitials(application)}</div>
            )}

            {resumeUrl ? (
              <a href={resumeUrl} target="_blank" rel="noreferrer" style={resumeButton}>
                View resume
              </a>
            ) : (
              <span style={resumeMissing}>No resume</span>
            )}
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: 24 }}>{application.name || application.email || "Candidate"}</h2>
            <p style={{ margin: "8px 0 0", color: "#cfe2ff" }}>{roleTitle} · {label(job?.public_dealer_name || job?.dealer_slug, "Dealer pending")}</p>
            <p style={{ margin: "10px 0 0", color: "#9fb1cc" }}>
              Status: {application.status || "new"} · Virtual: {application.virtual_interview_status || "not_scheduled"} · Packet: {application.interview_packet_ready ? "ready" : "not ready"} · Dealer: {formatDate(application.dealer_interview_at)}
            </p>
            <p style={{ margin: "10px 0 0", color: "#9fb1cc", fontSize: 13 }}>
              Email: {application.email || "Not provided"} · Phone: {application.phone || "Not provided"}
            </p>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {protection.sameDealer ? (
                <span style={conflictPill}>Same rooftop — blocked</span>
              ) : null}

              {protection.placementRisk ? (
                <span style={dangerPill}>Recent placement — override required</span>
              ) : null}

              {protection.hasPlacementHistory && protection.isOldPlacement ? (
                <span style={historyPill}>Historical placement</span>
              ) : null}

              {protection.hasClientDealerRisk && !protection.sameDealer ? (
                <span style={warningPill}>Client dealership relationship</span>
              ) : null}
            </div>
          </div>
          <span style={{ ...scoreBadge, ...getBadgeStyle(fit.tone) }}>
            Solace Fit {fitScore === null ? "—" : `${fitScore}/100`}<br />{fit.label}
          </span>
        </div>

        <div style={supportGrid}>
          <div style={supportBox}>
            <strong style={{ color: "#fff" }}>Role threshold</strong>
            <p style={supportText}>
              {fit.band.roleKey}: interview ready {fit.band.interviewReady}+ · recruiter review {fit.band.review}-{fit.band.interviewReady - 1} · do not advance below {fit.band.review}.
            </p>
          </div>
          <div style={supportBox}>
            <strong style={{ color: "#fff" }}>Why this score</strong>
            <p style={supportText}>{application.screening_summary || "No screening summary has been generated yet."}</p>
            <p style={{ ...supportText, color: "#fbbf24" }}>Decision: {application.decision_reason || "No decision reason recorded."}</p>
          </div>
        </div>

        <div style={supportGrid}>
          <Checklist title="Recruiter verification" items={verificationItems} />
          <Checklist title="Candidate support notes" items={coachingItems} />
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
          <p style={{ margin: 0, color: "#fbbf24", fontWeight: 900 }}>Next action: {nextAction}</p>
          {canOpenStudio ? (
            <Link href={`/recruiter/${recruiterSlug}/interviews/${application.id}`} className="btn btn-primary">Open studio</Link>
          ) : (
            <span style={{ ...pill, ...getBadgeStyle(fit.tone) }}>Review required before studio</span>
          )}
        </div>

        {surface === "candidate" ? (
          <div style={actionPanel}>
            <form action={approveForInterview} style={actionForm}>
              <input type="hidden" name="application_id" value={String(application.id)} />
              <input
                name="reason"
                placeholder={
                  protection.sameDealer
                    ? "Blocked — same rooftop"
                    : protection.placementRisk || protection.hasClientDealerRisk
                      ? "Override reason required"
                      : "Approval note"
                }
                style={miniInput}
              />
              <button
                className="btn btn-primary"
                type="submit"
                disabled={protection.sameDealer}
                style={{
                  opacity: protection.sameDealer ? 0.45 : 1,
                  cursor: protection.sameDealer ? "not-allowed" : "pointer",
                }}
              >
                {protection.sameDealer
                  ? "Blocked — same dealer"
                  : protection.placementRisk || protection.hasClientDealerRisk
                    ? "Override + send invite"
                    : "Approve + send invite"}
              </button>
            </form>
            <form action={holdCandidate} style={actionForm}>
              <input type="hidden" name="application_id" value={String(application.id)} />
              <input name="reason" placeholder="What proof is missing?" style={miniInput} />
              <button className="btn btn-secondary" type="submit">Hold / request info</button>
            </form>
            <form action={passCandidate} style={actionForm}>
              <input type="hidden" name="application_id" value={String(application.id)} />
              <input name="reason" placeholder="Pass reason" style={miniInput} />
              <button className="btn btn-secondary" type="submit">Pass candidate</button>
            </form>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <main className="shell">
      <Nav />

      <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "60px 0" }}>
        <NataSoundStateBridge
          candidateQueue={candidateQueue.length}
          interviewQueue={interviewQueue.length}
          waitingOnCandidate={waitingOnCandidate.length}
          reviewRequired={reviewRequired.length}
          dealerScheduled={dealerScheduled.length}
          blocked={blocked.length}
        />

        <div className="eyebrow">Recruiter Control Center</div>

        <div style={headerRow}>
          <div>
            <h1 style={{ marginTop: 0 }}>{recruiter.name} — Operations Command Center</h1>
            <p style={{ color: "#cfe2ff", maxWidth: 860 }}>
              Daily visibility for dealer demand, role-specific scoring, recruiter review, candidate coaching, interview readiness, dealer handoff status, and protected candidate relationships.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {canOpenAdmin ? (
              <Link
                href="/recruiter/admin"
                className="btn btn-primary"
                style={{ whiteSpace: "nowrap" }}
              >
                Admin Control Layer →
              </Link>
            ) : null}

            <Link
              href={`/recruiter/${recruiterSlug}/candidate-pool`}
              className="btn btn-primary"
              style={{ whiteSpace: "nowrap" }}
            >
              Candidate Pool →
            </Link>

            <Link
              href={`/recruiter/${recruiterSlug}/availability`}
              className="btn btn-secondary"
              style={{ whiteSpace: "nowrap" }}
            >
              Manage availability
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginTop: 34 }}>
          {[
            ["Active clients", dealers.length],
            ["Open jobs", openJobs.length],
            ["Assigned", applications.length],
            ["Review", reviewRequired.length],
            ["Interviews", interviewQueue.length],
            ["Ready dealer", dealerScheduled.length],
          ].map(([title, value]) => (
            <div key={String(title)} style={metricCard}>
              <div style={{ color: "#9fb1cc", fontSize: 13 }}>{title}</div>
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={noticeGrid}>
          <div style={noticeCard}>
            <strong>Waiting on candidate scheduling</strong>
            <span>{waitingOnCandidate.length}</span>
            <p>Approved candidates are hidden until they book a time.</p>
          </div>
          <div style={noticeCard}>
            <strong>Actionable candidate queue</strong>
            <span>{candidateQueue.length}</span>
            <p>Rejected candidates are returned to the candidate pool and rematched when eligible.</p>
          </div>
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Dealer Priority Board</div>
        <div style={{ display: "grid", gap: 14 }}>
          {dealers.length === 0 ? (
            <EmptyState>No active dealer jobs are currently open.</EmptyState>
          ) : (
            dealers.map((dealer) => (
              <article key={dealer.dealerSlug} style={dealerRow}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21 }}>{dealer.dealerName}</h2>
                  <p style={{ margin: "6px 0 0", color: "#9fb1cc" }}>{dealer.dealerSlug}</p>
                </div>
                <strong>{dealer.openJobs}</strong>
                <strong>{dealer.pipeline}</strong>
                <strong>{dealer.needsInterview}</strong>
                <strong>{dealer.packetPending}</strong>
                <span style={{ ...pill, background: dealer.priority === "Action" ? "#1473ff" : "rgba(255,255,255,0.08)" }}>{dealer.priority}</span>
              </article>
            ))
          )}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Today’s Work</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            ["Needs review", reviewRequired.length],
            ["Interviews to complete", interviewQueue.length],
            ["Packets pending", packetPending.length],
            ["Passed / blocked", blocked.length],
          ].map(([title, value]) => (
            <div key={String(title)} style={workCard}>
              <div style={{ color: "#fbbf24", fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12 }}>{title}</div>
              <div style={{ fontSize: 42, fontWeight: 950, marginTop: 12 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Interviews to Complete</div>
        <div style={{ display: "grid", gap: 18 }}>
          {interviewQueue.length === 0 ? (
            <EmptyState>No scheduled virtual interviews require action right now.</EmptyState>
          ) : (
            interviewQueue.map((application) => renderApplicationCard(application, "interview"))
          )}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Candidate Queue</div>
        <div style={{ display: "grid", gap: 18 }}>
          {candidateQueue.length === 0 ? (
            <EmptyState>No candidates require a recruiter decision right now. Approved candidates are hidden until they schedule, and passed candidates are archived into the candidate pool.</EmptyState>
          ) : (
            candidateQueue.map((application) => renderApplicationCard(application, "candidate"))
          )}
        </div>

        <MusicLibraryPlayer tracks={musicTracks} />

        <div className="section-kicker" style={{ marginTop: 48 }}>Communications</div>
        <CommunicationsCenter
          recruiter={recruiter}
          recruiterSlug={recruiterSlug}
          applications={applications}
        />
      </section>
    </main>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={supportBox}>
      <strong style={{ color: "#fff" }}>{title}</strong>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#bfd6f5", lineHeight: 1.5, fontSize: 13 }}>
        {items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, borderRadius: 20, background: "rgba(255,255,255,0.05)", color: "#cfe2ff" }}>{children}</div>;
}

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  flexWrap: "wrap",
};

const noticeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 18,
};

const noticeCard: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(96,165,250,0.18)",
  background: "rgba(37,99,235,0.08)",
  color: "#dbeafe",
};

const metricCard: React.CSSProperties = { padding: 20, borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" };
const dealerRow: React.CSSProperties = { padding: 22, borderRadius: 22, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: "1.4fr repeat(5, .7fr)", gap: 14, alignItems: "center" };
const workCard: React.CSSProperties = { padding: 24, borderRadius: 22, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" };
const candidateCard: React.CSSProperties = { padding: 24, borderRadius: 24, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" };
const candidateMedia: React.CSSProperties = { display: "grid", gap: 10, justifyItems: "center" };
const candidatePhoto: React.CSSProperties = { width: 92, height: 92, borderRadius: 22, objectFit: "cover", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)" };
const candidatePhotoFallback: React.CSSProperties = { width: 92, height: 92, borderRadius: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(20,115,255,0.18)", color: "#dbeafe", fontSize: 26, fontWeight: 950 };
const resumeButton: React.CSSProperties = { width: "100%", minHeight: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(20,115,255,0.16)", border: "1px solid rgba(96,165,250,0.26)", color: "#bfdbfe", fontSize: 12, fontWeight: 900, textDecoration: "none" };
const resumeMissing: React.CSSProperties = { width: "100%", minHeight: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.22)", color: "#fca5a5", fontSize: 12, fontWeight: 900 };
const supportGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 16 };
const supportBox: React.CSSProperties = { padding: 15, borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(3,10,20,0.34)" };
const supportText: React.CSSProperties = { margin: "8px 0 0", color: "#bfd6f5", lineHeight: 1.5, fontSize: 13, whiteSpace: "pre-line" };
const scoreBadge: React.CSSProperties = { display: "inline-flex", justifyContent: "center", alignItems: "center", minWidth: 154, minHeight: 54, padding: "8px 14px", borderRadius: 999, fontWeight: 950, fontSize: 12, textAlign: "center", lineHeight: 1.3 };
const pill: React.CSSProperties = { display: "inline-flex", justifyContent: "center", padding: "8px 12px", borderRadius: 999, fontWeight: 900, color: "#fff" };
const actionPanel: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" };
const actionForm: React.CSSProperties = { display: "grid", gap: 8 };
const miniInput: React.CSSProperties = { minHeight: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(3,7,18,0.8)", color: "#fff", padding: "0 12px", outline: "none" };

const conflictPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(239,68,68,0.2)",
  border: "1px solid rgba(248,113,113,0.4)",
  color: "#fecaca",
  fontSize: 12,
  fontWeight: 900,
};

const dangerPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(251,191,36,0.2)",
  border: "1px solid rgba(251,191,36,0.4)",
  color: "#fde68a",
  fontSize: 12,
  fontWeight: 900,
};

const historyPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(147,197,253,0.2)",
  border: "1px solid rgba(147,197,253,0.4)",
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 900,
};

const warningPill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(168,85,247,0.16)",
  border: "1px solid rgba(192,132,252,0.35)",
  color: "#e9d5ff",
  fontSize: 12,
  fontWeight: 900,
};
