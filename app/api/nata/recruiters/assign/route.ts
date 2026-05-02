import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const applicationId = clean(formData.get("applicationId"));
    const recruiterId = clean(formData.get("recruiterId"));

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    if (recruiterId) {
      const { data: recruiter, error: recruiterError } = await supabaseAdmin
        .schema("nata")
        .from("recruiters")
        .select("id,status,is_active")
        .eq("id", recruiterId)
        .maybeSingle();

      if (recruiterError) {
        return NextResponse.json({ error: recruiterError.message }, { status: 500 });
      }

      if (!recruiter) {
        return NextResponse.json({ error: "Recruiter not found" }, { status: 404 });
      }

      if (recruiter.is_active === false || recruiter.status === "suspended" || recruiter.status === "inactive") {
        return NextResponse.json(
          { error: "Cannot assign work to inactive or suspended recruiter" },
          { status: 400 }
        );
      }
    }

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        recruiter_id: recruiterId || null,
        assigned_recruiter: recruiterId || null,
      })
      .eq("id", applicationId);

    if (error) {
      console.error("Recruiter assignment failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.redirect(new URL("/recruiter/admin", request.url), 303);
  } catch (error) {
    console.error("POST /api/nata/recruiters/assign failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Recruiter assignment failed",
      },
      { status: 500 }
    );
  }
}
