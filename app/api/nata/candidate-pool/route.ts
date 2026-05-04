import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  returnApplicationToCandidatePool,
  syncCandidateMatches,
} from "../../../../lib/nataCandidatePool";

type AnyRow = Record<string, any>;

type GeoPoint = {
  latitude: number;
  longitude: number;
  canonicalLocation: string;
};

const RESUME_BUCKET =
  process.env.NATA_CANDIDATE_RESUME_BUCKET || "candidate-resumes";

const PHOTO_BUCKET =
  process.env.NATA_CANDIDATE_PHOTO_BUCKET || "candidate-photos";

const KNOWN_LOCATIONS: Record<string, GeoPoint> = {
  phoenix: { latitude: 33.4484, longitude: -112.074, canonicalLocation: "Phoenix, AZ" },
  "phoenix az": { latitude: 33.4484, longitude: -112.074, canonicalLocation: "Phoenix, AZ" },
  "phoenix arizona": { latitude: 33.4484, longitude: -112.074, canonicalLocation: "Phoenix, AZ" },

  houston: { latitude: 29.7604, longitude: -95.3698, canonicalLocation: "Houston, TX" },
  "houston tx": { latitude: 29.7604, longitude: -95.3698, canonicalLocation: "Houston, TX" },
  "houston texas": { latitude: 29.7604, longitude: -95.3698, canonicalLocation: "Houston, TX" },

  cypress: { latitude: 29.9691, longitude: -95.6972, canonicalLocation: "Cypress, TX" },
  "cypress tx": { latitude: 29.9691, longitude: -95.6972, canonicalLocation: "Cypress, TX" },
  "cypress texas": { latitude: 29.9691, longitude: -95.6972, canonicalLocation: "Cypress, TX" },

  "jersey village": { latitude: 29.8877, longitude: -95.563, canonicalLocation: "Jersey Village, TX" },
  "jersey village tx": { latitude: 29.8877, longitude: -95.563, canonicalLocation: "Jersey Village, TX" },

  dallas: { latitude: 32.7767, longitude: -96.797, canonicalLocation: "Dallas, TX" },
  "dallas tx": { latitude: 32.7767, longitude: -96.797, canonicalLocation: "Dallas, TX" },
  "dallas texas": { latitude: 32.7767, longitude: -96.797, canonicalLocation: "Dallas, TX" },

  austin: { latitude: 30.2672, longitude: -97.7431, canonicalLocation: "Austin, TX" },
  "austin tx": { latitude: 30.2672, longitude: -97.7431, canonicalLocation: "Austin, TX" },
  "austin texas": { latitude: 30.2672, longitude: -97.7431, canonicalLocation: "Austin, TX" },

  "san antonio": { latitude: 29.4241, longitude: -98.4936, canonicalLocation: "San Antonio, TX" },
  "san antonio tx": { latitude: 29.4241, longitude: -98.4936, canonicalLocation: "San Antonio, TX" },

  miami: { latitude: 25.7617, longitude: -80.1918, canonicalLocation: "Miami, FL" },
  "miami fl": { latitude: 25.7617, longitude: -80.1918, canonicalLocation: "Miami, FL" },
  "miami florida": { latitude: 25.7617, longitude: -80.1918, canonicalLocation: "Miami, FL" },

  orlando: { latitude: 28.5383, longitude: -81.3792, canonicalLocation: "Orlando, FL" },
  "orlando fl": { latitude: 28.5383, longitude: -81.3792, canonicalLocation: "Orlando, FL" },

  tampa: { latitude: 27.9506, longitude: -82.4572, canonicalLocation: "Tampa, FL" },
  "tampa fl": { latitude: 27.9506, longitude: -82.4572, canonicalLocation: "Tampa, FL" },

  atlanta: { latitude: 33.749, longitude: -84.388, canonicalLocation: "Atlanta, GA" },
  "atlanta ga": { latitude: 33.749, longitude: -84.388, canonicalLocation: "Atlanta, GA" },
  "atlanta georgia": { latitude: 33.749, longitude: -84.388, canonicalLocation: "Atlanta, GA" },

  columbus: { latitude: 39.9612, longitude: -82.9988, canonicalLocation: "Columbus, OH" },
  "columbus oh": { latitude: 39.9612, longitude: -82.9988, canonicalLocation: "Columbus, OH" },
  "columbus ohio": { latitude: 39.9612, longitude: -82.9988, canonicalLocation: "Columbus, OH" },

  cleveland: { latitude: 41.4993, longitude: -81.6944, canonicalLocation: "Cleveland, OH" },
  "cleveland oh": { latitude: 41.4993, longitude: -81.6944, canonicalLocation: "Cleveland, OH" },

  chicago: { latitude: 41.8781, longitude: -87.6298, canonicalLocation: "Chicago, IL" },
  "chicago il": { latitude: 41.8781, longitude: -87.6298, canonicalLocation: "Chicago, IL" },

  denver: { latitude: 39.7392, longitude: -104.9903, canonicalLocation: "Denver, CO" },
  "denver co": { latitude: 39.7392, longitude: -104.9903, canonicalLocation: "Denver, CO" },

  losangeles: { latitude: 34.0522, longitude: -118.2437, canonicalLocation: "Los Angeles, CA" },
  "los angeles": { latitude: 34.0522, longitude: -118.2437, canonicalLocation: "Los Angeles, CA" },
  "los angeles ca": { latitude: 34.0522, longitude: -118.2437, canonicalLocation: "Los Angeles, CA" },

  sandiego: { latitude: 32.7157, longitude: -117.1611, canonicalLocation: "San Diego, CA" },
  "san diego": { latitude: 32.7157, longitude: -117.1611, canonicalLocation: "San Diego, CA" },
  "san diego ca": { latitude: 32.7157, longitude: -117.1611, canonicalLocation: "San Diego, CA" },
};

function clean(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function fileExtension(fileName: string) {
  const parts = fileName.split(".").filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "bin";
}

function safePathPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isUsableFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function normalizeLocationKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/open to relocation|willing to relocate|willing to move|relocation|relocate/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\btexas\b/g, "tx")
    .replace(/\barizona\b/g, "az")
    .replace(/\bflorida\b/g, "fl")
    .replace(/\bgeorgia\b/g, "ga")
    .replace(/\bohio\b/g, "oh")
    .replace(/\billinois\b/g, "il")
    .replace(/\bcolorado\b/g, "co")
    .replace(/\bcalifornia\b/g, "ca")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKnownLocation(value: string): GeoPoint | null {
  const key = normalizeLocationKey(value);
  if (!key) return null;

  if (KNOWN_LOCATIONS[key]) return KNOWN_LOCATIONS[key];

  const compactKey = key.replace(/\s+/g, "");
  if (KNOWN_LOCATIONS[compactKey]) return KNOWN_LOCATIONS[compactKey];

  const cityOnly = key.split(" ")[0];
  if (KNOWN_LOCATIONS[cityOnly]) return KNOWN_LOCATIONS[cityOnly];

  return null;
}

async function uploadCandidateFile(input: {
  file: File;
  email: string;
  kind: "resume" | "profile-photo";
}) {
  const extension = fileExtension(input.file.name || input.kind);
  const emailPart = safePathPart(input.email) || "candidate";
  const path = `${emailPart}/${input.kind}-${Date.now()}.${extension}`;
  const bucket = input.kind === "resume" ? RESUME_BUCKET : PHOTO_BUCKET;

  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(path, buffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    console.error("Candidate pool file upload failed:", {
      bucket,
      path,
      error: uploadError,
    });
    return null;
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

  return data.publicUrl || null;
}

async function upsertCandidateFromForm(formData: FormData) {
  const name = clean(formData.get("name"));
  const email = normalizeEmail(clean(formData.get("email")));
  const phone = clean(formData.get("phone"));
  const location = clean(formData.get("location"));
  const linkedin = clean(formData.get("linkedin"));
  const consent = clean(formData.get("sms_email_consent")) === "yes";
  const resumeFile = formData.get("resume");
  const profilePhotoFile = formData.get("profile_photo");

  if (!name || !email || !phone || !location) {
    return {
      ok: false as const,
      status: 400,
      error: "Name, email, phone, and location are required.",
    };
  }

  if (!consent) {
    return {
      ok: false as const,
      status: 400,
      error: "SMS/email consent is required.",
    };
  }

  if (!isUsableFile(resumeFile)) {
    return {
      ok: false as const,
      status: 400,
      error: "Resume is required.",
    };
  }

  const resolvedLocation = resolveKnownLocation(location);
  const locationText = resolvedLocation?.canonicalLocation || location;

  const [resumeUrl, profilePhotoUrl] = await Promise.all([
    uploadCandidateFile({ file: resumeFile, email, kind: "resume" }),
    isUsableFile(profilePhotoFile)
      ? uploadCandidateFile({
          file: profilePhotoFile,
          email,
          kind: "profile-photo",
        })
      : Promise.resolve(null),
  ]);

  if (!resumeUrl) {
    return {
      ok: false as const,
      status: 500,
      error: "Resume upload failed.",
    };
  }

  const now = new Date().toISOString();

  const searchText = [
    name,
    email,
    phone,
    locationText,
    location,
    linkedin,
    "candidate pool",
    "dealership automotive sales service technician advisor bdc parts finance",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const payload = {
    name,
    email,
    phone,
    linkedin: linkedin || null,
    location_text: locationText,
    latitude: resolvedLocation?.latitude ?? null,
    longitude: resolvedLocation?.longitude ?? null,
    resume_url: resumeUrl,
    profile_photo_url: profilePhotoUrl,
    status: "active",
    availability_status: "available",
    target_roles: [],
    search_text: searchText,
    experience_summary:
      "Candidate joined the NATA candidate pool for continuous dealership role matching.",
    updated_at: now,
  };

  const { data: existingCandidate, error: existingError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check existing pool candidate:", existingError);
    return {
      ok: false as const,
      status: 500,
      error: "Could not check existing candidate record.",
    };
  }

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
      console.error("Failed to update candidate pool submission:", updateError);
      return {
        ok: false as const,
        status: 500,
        error: "Could not update candidate pool record.",
      };
    }

    candidate = updatedCandidate as AnyRow;
  } else {
    const { data: insertedCandidate, error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .insert({ ...payload, created_at: now })
      .select("*")
      .single();

    if (insertError || !insertedCandidate) {
      console.error("Failed to insert candidate pool submission:", insertError);
      return {
        ok: false as const,
        status: 500,
        error: "Could not create candidate pool record.",
      };
    }

    candidate = insertedCandidate as AnyRow;
  }

  await syncCandidateMatches(candidate);

  return {
    ok: true as const,
    candidate,
  };
}

async function handleJsonReturn(req: Request) {
  const body = await req.json();
  const { applicationId, source, reason } = body || {};

  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const candidate = await returnApplicationToCandidatePool({
    applicationId,
    source: source || "system",
    reason: reason || "Returned to pool",
  });

  if (candidate) {
    await syncCandidateMatches(candidate);
  }

  return NextResponse.json({ ok: true });
}

async function handleMultipartSubmission(req: Request) {
  const formData = await req.formData();
  const result = await upsertCandidateFromForm(formData);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const referer = req.headers.get("referer");

  if (referer) {
    const redirectUrl = new URL(referer);
    redirectUrl.searchParams.set("pool", "submitted");
    redirectUrl.hash = "candidate-pool";
    return NextResponse.redirect(redirectUrl, { status: 303 });
  }

  return NextResponse.json({ ok: true, candidateId: result.candidate.id });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      return await handleMultipartSubmission(req);
    }

    if (contentType.includes("application/json")) {
      return await handleJsonReturn(req);
    }

    return NextResponse.json(
      { error: "Unsupported content type." },
      { status: 415 },
    );
  } catch (err) {
    console.error("candidate-pool route error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
