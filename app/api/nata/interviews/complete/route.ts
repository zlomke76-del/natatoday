import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { generateInterviewPacket } from "../../../../../lib/nataInterviewPacket";

function getDealerInterviewTime(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    return new Date(raw).toISOString();
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(10, 0, 0, 0);
  return fallback.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const applicationId =
      typeof body.applicationId === "string" ? body.applicationId.trim() : "";

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    const dealerInterviewAt = getDealerInterviewTime(body.dealerInterviewAt);

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json(
        { error: "Interview notes are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const { error: notesError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        virtual_interview_notes: notes,
        virtual_interview_completed_at: now,
        virtual_interview_status: "completed",
        screening_status: "virtual_completed",
        status: "virtual_completed",
      })
      .eq("id", applicationId);

    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 500 });
    }

    const packetResult = await generateInterviewPacket(applicationId);

    if (!packetResult?.packet) {
      return NextResponse.json(
        { error: "Interview packet generation failed" },
        { status: 500 }
      );
    }

    const { error: commitError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        interview_packet_ready: true,
        dealer_interview_at: dealerInterviewAt,
        screening_status: "dealer_interview_scheduled",
        status: "dealer_interview_scheduled",
      })
      .eq("id", applicationId);

    if (commitError) {
      return NextResponse.json({ error: commitError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      applicationId,
      status: "dealer_interview_scheduled",
      dealerInterviewAt,
      packet: packetResult.packet,
    });
  } catch (error) {
    console.error("Failed to complete interview:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete interview",
      },
      { status: 500 }
    );
  }
}
