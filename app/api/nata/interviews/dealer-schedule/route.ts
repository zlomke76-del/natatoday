import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicationId = clean(body.applicationId);
    const dealerInterviewAtRaw = clean(body.dealerInterviewAt);

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    if (!dealerInterviewAtRaw) {
      return NextResponse.json({ error: "Missing dealerInterviewAt" }, { status: 400 });
    }

    const dealerInterviewAt = parseDate(dealerInterviewAtRaw);

    if (!dealerInterviewAt) {
      return NextResponse.json({ error: "Invalid dealerInterviewAt" }, { status: 400 });
    }

    const { data: application, error: appError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select(
        "id,status,screening_status,virtual_interview_status,virtual_interview_completed_at,interview_packet_ready,dealer_interview_at"
      )
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

    if (!application.virtual_interview_completed_at && application.virtual_interview_status !== "completed") {
      return NextResponse.json(
        { error: "Virtual interview must be completed before scheduling dealer interview" },
        { status: 400 }
      );
    }

    if (application.dealer_interview_at || application.status === "dealer_interview_scheduled") {
      return NextResponse.json(
        { error: "Dealer interview has already been scheduled" },
        { status: 409 }
      );
    }

    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        dealer_interview_at: dealerInterviewAt.toISOString(),
        screening_status: "dealer_interview_scheduled",
        status: "dealer_interview_scheduled",
      })
      .eq("id", applicationId)
      .eq("interview_packet_ready", true)
      .is("dealer_interview_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Dealer interview could not be scheduled because state changed" },
        { status: 409 }
      );
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
