import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(req: NextRequest) {
  try {
    const { applicationId, notes } = await req.json();

    const { error } = await supabaseAdmin
      .from("applications")
      .update({
        virtual_interview_notes: notes,
        virtual_interview_completed_at: new Date().toISOString(),
        virtual_interview_status: "completed",
      })
      .eq("id", applicationId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to save notes" },
      { status: 500 }
    );
  }
}
