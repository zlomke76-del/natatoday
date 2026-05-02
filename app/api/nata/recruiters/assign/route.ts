import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const applicationId = formData.get("applicationId") as string;
  const recruiterId = formData.get("recruiterId") as string;

  if (!applicationId) {
    return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("applications")
    .update({ recruiter_id: recruiterId || null })
    .eq("id", applicationId);

  if (error) {
    return NextResponse.json({ error: "Failed to assign" }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/recruiter/admin", req.url));
}
