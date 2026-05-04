import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
  returnApplicationToCandidatePool,
  syncCandidateMatches,
} from "../../../../lib/nataCandidatePool";

type AnyRow = Record<string, any>;

const CANDIDATE_FILES_BUCKET =
  process.env.NATA_CANDIDATE_FILES_BUCKET || "nata-candidate-files";

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

async function uploadCandidateFile(input: {
  file: File;
  email: string;
  kind: "resume" | "profile-photo";
}) {
  const extension = fileExtension(input.file.name || input.kind);
  const emailPart = safePathPart(input.email) || "candidate";
  const path = `${emailPart}/${input.kind}-${Date.now()}.${extension}`;

  const arrayBuffer = await input.file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(CANDIDATE_FILES_BUCKET)
    .upload(path, buffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    console.error("Candidate pool file upload failed:", {
      bucket: CANDIDATE_FILES_BUCKET,
      path,
      error: uploadError,
    });
    return null;
  }

  const { data } = supabaseAdmin.storage
    .from(CANDIDATE_FILES_BUCKET)
    .getPublicUrl(path);

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

  const [resumeUrl, profilePhotoUrl] = await Promise.all([
    uploadCandidateFile({ file: resumeFile, email, kind: "resume" }),
    isUsableFile(profilePhotoFile)
      ? uploadCandidateFile({ file: profilePhotoFile, email, kind: "profile-photo" })
      : Promise.resolve(null),
  ]);

  if (!resumeUrl) {
    return {
      ok: false as const,
      status: 500,
      error:
        "Resume upload failed. Confirm the candidate files storage bucket exists and is writable.",
    };
  }

  const now = new Date().toISOString();
  const searchText = [
    name,
    email,
    phone,
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
    location_text: location,
    resume_url: resumeUrl,
    profile_photo_url: profilePhotoUrl,
    status: "active",
    availability_status: "available",
    sms_email_consent: true,
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
