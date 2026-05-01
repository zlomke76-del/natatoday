import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
    const dealerInterviewAt =
      typeof body.dealerInterviewAt === "string" ? body.dealerInterviewAt.trim() : "";

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    if (!dealerInterviewAt) {
      return NextResponse.json({ error: "Missing dealerInterviewAt" }, { status: 400 });
    }

    const { data: application, error: appError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("id, interview_packet_ready")
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { error: appError?.message || "Application not found" },
        { status: 404 }
      );
    }

    if (application.interview_packet_ready !== true) {
      return NextResponse.json(
        { error: "Interview packet must be ready before scheduling dealer interview" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        dealer_interview_at: new Date(dealerInterviewAt).toISOString(),
        screening_status: "dealer_interview_scheduled",
        status: "dealer_interview_scheduled",
      })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, application: data });
  } catch (error) {
    console.error("Failed to schedule dealer interview:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Dealer interview scheduling failed" },
      { status: 500 }
    );
  }
}
