import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = clean(formData.get("token"));

    if (!token) {
      return NextResponse.json({ error: "Missing invite token" }, { status: 400 });
    }

    const { data: recruiter, error: loadError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("id,slug,status")
      .eq("invite_token", token)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    if (!recruiter) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .update({
        status: "active",
        is_active: true,
        activated_at: now,
        updated_at: now,
      })
      .eq("id", recruiter.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.redirect(
      new URL(`/recruiter/${recruiter.slug}/dashboard`, req.url)
    );
  } catch (error) {
    console.error("POST /api/nata/recruiters/accept-invite failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invite activation failed" },
      { status: 500 }
    );
  }
}
