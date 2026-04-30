import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const jobId = clean(formData.get("job_id"));
    const name = clean(formData.get("name"));
    const email = clean(formData.get("email"));
    const phone = clean(formData.get("phone"));
    const linkedin = clean(formData.get("linkedin"));
    const coverNote = clean(formData.get("cover_note"));

    if (!jobId) {
      return NextResponse.json({ error: "Job is required." }, { status: 400 });
    }

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: "Name, email, and phone are required." },
        { status: 400 }
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("id,slug,title,is_active")
      .eq("id", jobId)
      .eq("is_active", true)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    let profilePhotoUrl: string | null = null;
    const photo = formData.get("profile_photo");

    if (photo instanceof File && photo.size > 0) {
      const safeName = photo.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
      const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
      const filePath = `${job.slug}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("candidate-photos")
        .upload(filePath, photo, {
          contentType: photo.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json(
          { error: "Profile photo upload failed." },
          { status: 500 }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("candidate-photos")
        .getPublicUrl(filePath);

      profilePhotoUrl = publicUrlData.publicUrl;
    }

    const { data: application, error: applicationError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .insert({
        job_id: job.id,
        name,
        email,
        phone,
        linkedin: linkedin || null,
        cover_note: coverNote || null,
        resume_url: null,
        profile_photo_url: profilePhotoUrl,
        status: "new",
      })
      .select("*")
      .single();

    if (applicationError) {
      return NextResponse.json(
        { error: applicationError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      application,
    });
  } catch (error) {
    console.error("Application submit error:", error);
    return NextResponse.json(
      { error: "Application submit failed." },
      { status: 500 }
    );
  }
}
