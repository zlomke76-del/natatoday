import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESUME_BUCKET = "candidate-resumes";
const PHOTO_BUCKET = "candidate-photos";
const MAX_MATCH_DISTANCE_MILES = 100;
const MIN_MATCH_SCORE = 70;

type AnyRow = Record<string, any>;

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getFile(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = formData.get(key);
    if (value instanceof File && value.size > 0) return value;
  }

  return null;
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

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase();
}

function getTargetRoles(candidate: AnyRow) {
  if (Array.isArray(candidate.target_roles)) {
    return candidate.target_roles.map((role) => normalizeText(role)).filter(Boolean);
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
  const title = normalizeText(job.title);

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

function inferTargetRoles(formData: FormData) {
  const explicit = clean(formData.get("target_roles"));
  const role = clean(formData.get("role"));
  const desiredRole = clean(formData.get("desired_role"));

  const raw = explicit || role || desiredRole;

  if (!raw) return [];

  return raw
    .split(/,|;|\n|\|/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

async function uploadPublicFile(input: {
  bucket: string;
  file: File | null;
  folder: string;
}) {
  const { bucket, file, folder } = input;

  if (!file || file.size <= 0) return null;

  const fileName = safeFileName(file.name || "upload");
  const storagePath = `${folder}/${Date.now()}-${fileName}`;

  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    console.error(`Failed to upload file to ${bucket}:`, error);
    return null;
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl || null;
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

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const name = clean(formData.get("name"));
    const email = clean(formData.get("email")).toLowerCase();
    const phone = clean(formData.get("phone"));
    const location = clean(formData.get("location"));
    const linkedin = clean(formData.get("linkedin"));
    const experienceSummary = clean(formData.get("experience_summary"));
    const targetRoles = inferTargetRoles(formData);

    const resume = getFile(formData, ["resume", "resume_file"]);
    const profilePhoto = getFile(formData, [
      "profile_photo",
      "profilePhoto",
      "photo",
      "candidate_photo",
    ]);

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: "Name, email, and phone are required." },
        { status: 400 },
      );
    }

    const uploadFolder = email.replace(/[^a-z0-9]+/g, "-");

    const [resumeUrl, profilePhotoUrl] = await Promise.all([
      uploadPublicFile({
        bucket: RESUME_BUCKET,
        file: resume,
        folder: uploadFolder,
      }),
      uploadPublicFile({
        bucket: PHOTO_BUCKET,
        file: profilePhoto,
        folder: uploadFolder,
      }),
    ]);

    const { data: candidate, error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .insert({
        name,
        email,
        phone,
        linkedin: linkedin || null,
        location_text: location || null,
        resume_url: resumeUrl,
        profile_photo_url: profilePhotoUrl,
        target_roles: targetRoles,
        experience_summary: experienceSummary || null,
        status: "active",
      })
      .select("*")
      .single();

    if (insertError || !candidate) {
      console.error("Insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to submit candidate." },
        { status: 500 },
      );
    }

    await syncCandidateMatches(candidate);

    return NextResponse.redirect(
      new URL(`/careers/thank-you?candidateId=${candidate.id}`, req.url),
      { status: 303 },
    );
  } catch (error) {
    console.error("Candidate pool route failed:", error);

    return NextResponse.json(
      { error: "Unexpected candidate submission error." },
      { status: 500 },
    );
  }
}
