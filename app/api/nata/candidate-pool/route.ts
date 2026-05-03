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

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
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

function computeMatch(candidate: AnyRow, job: AnyRow) {
  let score = 50;
  const reasons: string[] = [];

  const distance = getDistanceMiles(candidate, job);

  if (distance !== null) {
    if (distance <= MAX_MATCH_DISTANCE_MILES) {
      score += 18;
      reasons.push(`Candidate is within ${Math.round(distance)} miles.`);
    } else {
      score -= 25;
      reasons.push(`Candidate is ${Math.round(distance)} miles away.`);
    }
  } else if (candidate.location_text) {
    score += 10;
    reasons.push("Candidate provided a local market or ZIP.");
  }

  if (candidate.resume_url) {
    score += 12;
    reasons.push("Resume is available for review.");
  }

  if (candidate.profile_photo_url) {
    score += 3;
    reasons.push("Profile photo is available.");
  }

  if (candidate.linkedin) {
    score += 5;
    reasons.push("LinkedIn profile is available.");
  }

  if (job.publish_status === "published") {
    score += 5;
    reasons.push("Role is published.");
  }

  if (job.is_active !== false && !job.filled_at) {
    score += 5;
    reasons.push("Role is active and unfilled.");
  }

  const title = String(job.title || "").toLowerCase();
  const candidateText = [
    candidate.name,
    candidate.email,
    candidate.location_text,
    candidate.linkedin,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (title.includes("sales") && candidateText.includes("sales")) score += 8;
  if (title.includes("service") && candidateText.includes("service")) score += 8;
  if (title.includes("technician") && candidateText.includes("tech")) score += 8;
  if (title.includes("bdc") && candidateText.includes("bdc")) score += 8;
  if (title.includes("finance") && candidateText.includes("finance")) score += 8;

  const fitScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    distance_miles: distance === null ? null : Math.round(distance * 10) / 10,
    fit_score: fitScore,
    match_status: fitScore >= MIN_MATCH_SCORE ? "eligible" : "below_threshold",
    match_reason: reasons.join(" "),
  };
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
      "id,title,location,public_location,public_dealer_name,is_active,publish_status,publish_mode,filled_at,latitude,longitude",
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
