import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import {
returnApplicationToCandidatePool,
syncCandidateMatches,
} from "../../../../lib/nataCandidatePool";

type AnyRow = Record<string, any>;

const RESUME_BUCKET =
process.env.NATA_CANDIDATE_RESUME_BUCKET || "candidate-resumes";

const PHOTO_BUCKET =
process.env.NATA_CANDIDATE_PHOTO_BUCKET || "candidate-photos";

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

const { data } = supabaseAdmin.storage
.from(bucket)
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
return { ok: false as const, status: 400, error: "Missing required fields." };
}

if (!consent) {
return { ok: false as const, status: 400, error: "Consent required." };
}

if (!isUsableFile(resumeFile)) {
return { ok: false as const, status: 400, error: "Resume required." };
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
error: "Resume upload failed.",
};
}

const now = new Date().toISOString();

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
updated_at: now,
};

const { data: existing } = await supabaseAdmin
.schema("nata")
.from("candidates")
.select("id")
.eq("email", email)
.maybeSingle();

let candidate;

if (existing?.id) {
const { data } = await supabaseAdmin
.schema("nata")
.from("candidates")
.update(payload)
.eq("id", existing.id)
.select("*")
.single();


candidate = data;


} else {
const { data } = await supabaseAdmin
.schema("nata")
.from("candidates")
.insert({ ...payload, created_at: now })
.select("*")
.single();


candidate = data;


}

await syncCandidateMatches(candidate);

return { ok: true as const, candidate };
}

export async function POST(req: Request) {
try {
const contentType = req.headers.get("content-type") || "";


if (contentType.includes("multipart/form-data")) {
  const formData = await req.formData();
  const result = await upsertCandidateFromForm(formData);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}

return NextResponse.json({ error: "Unsupported" }, { status: 415 });


} catch (err) {
console.error("candidate-pool route error:", err);
return NextResponse.json({ error: "Server error" }, { status: 500 });
}
}
