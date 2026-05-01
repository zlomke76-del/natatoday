import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { generateInterviewPacket } from "../../../../../lib/nataInterviewPacket";

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseDealerInterviewAt(value: unknown): string | null {
  const raw = cleanString(value);

  if (!raw) {
    return null;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const applicationId = cleanString(body.applicationId);
    const notes = cleanString(body.notes);
    const dealerInterviewAt = parseDealerInterviewAt(body.dealerInterviewAt);

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json(
        { error: "Interview notes are required" },
        { status: 400 }
      );
    }

    if (!dealerInterviewAt) {
      return NextResponse.json(
        { error: "Valid dealerInterviewAt is required" },
        { status: 400 }
      );
    }

    const { data: application, error: applicationError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .maybeSingle();

    if (applicationError || !application) {
      return NextResponse.json(
        { error: applicationError?.message || "Application not found" },
        { status: 404 }
      );
    }

    const completedAt = new Date().toISOString();

    const { error: notesError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        virtual_interview_notes: notes,
        virtual_interview_completed_at: completedAt,
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

    const { data: committedApplication, error: commitError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        interview_packet_ready: true,
        dealer_interview_at: dealerInterviewAt,
        screening_status: "dealer_interview_scheduled",
        status: "dealer_interview_scheduled",
      })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (commitError) {
      return NextResponse.json({ error: commitError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      application: committedApplication,
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
