import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const location = String(formData.get("location") || "").trim();
    const linkedin = String(formData.get("linkedin") || "").trim();

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required." },
        { status: 400 }
      );
    }

    // Upload resume if exists
    let resumePath: string | null = null;

    const resume = formData.get("resume") as File | null;

    if (resume && resume.size > 0) {
      const fileName = `${Date.now()}-${resume.name}`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("candidate-resumes")
        .upload(fileName, resume);

      if (uploadError) {
        console.error("Resume upload failed:", uploadError);
      } else {
        resumePath = fileName;
      }
    }

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("candidate_pool")
      .insert({
        name,
        email,
        phone,
        location,
        linkedin,
        resume_path: resumePath,
        status: "new",
      });

    if (error) {
      console.error("Insert failed:", error);
      return NextResponse.json(
        { error: "Failed to submit candidate." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Candidate pool error:", err);
    return NextResponse.json(
      { error: "Unexpected error." },
      { status: 500 }
    );
  }
}
