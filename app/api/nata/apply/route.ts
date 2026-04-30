import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const jobId = String(formData.get("job_id") || "");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const linkedin = String(formData.get("linkedin") || "").trim();
  const coverNote = String(formData.get("cover_note") || "").trim();
  const resume = formData.get("resume");

  if (!jobId || !name || !email) {
    return NextResponse.json({ error: "Name, email, and job are required" }, { status: 400 });
  }

  if (!(resume instanceof File)) {
    return NextResponse.json({ error: "Resume file is required" }, { status: 400 });
  }

  const safeFileName = resume.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const resumePath = `${jobId}/${Date.now()}-${safeFileName}`;
  const buffer = Buffer.from(await resume.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("nata-resumes")
    .upload(resumePath, buffer, {
      contentType: resume.type || "application/octet-stream",
      upsert: false
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .insert({
      job_id: jobId,
      name,
      email,
      phone,
      linkedin,
      resume_url: resumePath,
      cover_note: coverNote,
      status: "new"
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ application: data });
}
