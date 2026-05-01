import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { generateInterviewPacket } from "../../../../../lib/nataInterviewPacket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json({ error: "Interview notes are required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        virtual_interview_notes: notes,
        virtual_interview_completed_at: new Date().toISOString(),
        virtual_interview_status: "completed",
        screening_status: "virtual_completed",
        status: "virtual_completed",
      })
      .eq("id", applicationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const packetResult = await generateInterviewPacket(applicationId);

    return NextResponse.json({
      success: true,
      packet: packetResult.packet,
    });
  } catch (error) {
    console.error("Failed to save interview notes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save notes" },
      { status: 500 }
    );
  }
}
