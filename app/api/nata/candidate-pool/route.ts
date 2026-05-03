import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RESUME_BUCKET = "candidate-resumes";
const PHOTO_BUCKET = "candidate-photos";

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

async function uploadPublicFile(input: {
  bucket: string;
  file: File | null;
  folder: string;
}) {
  const { bucket, file, folder } = input;

  if (!file || file.size <= 0) return null;

  const fileName = safeFileName(file.name || "upload");
  const storagePath = `${folder}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    console.error(`Failed to upload file to ${bucket}:`, uploadError);
    return null;
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);

  return data.publicUrl || null;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const name = clean(formData.get("name"));
    const email = clean(formData.get("email")).toLowerCase();
    const phone = clean(formData.get("phone"));
    const location = clean(formData.get("location"));
    const linkedin = clean(formData.get("linkedin"));

    const resume = formData.get("resume") instanceof File
      ? (formData.get("resume") as File)
      : null;

    const profilePhoto =
      formData.get("profile_photo") instanceof File
        ? (formData.get("profile_photo") as File)
        : formData.get("photo") instanceof File
          ? (formData.get("photo") as File)
          : null;

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
      .select("id,name,email,status")
      .single();

    if (insertError) {
      console.error("Insert failed:", insertError);
      return NextResponse.json(
        { error: "Failed to submit candidate." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      candidate,
    });
  } catch (error) {
    console.error("Candidate pool route failed:", error);

    return NextResponse.json(
      { error: "Unexpected candidate submission error." },
      { status: 500 },
    );
  }
}
