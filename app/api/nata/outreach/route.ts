import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isAllowedStatus(status: string) {
  return [
    "pending",
    "approved",
    "sent",
    "responded",
    "declined",
    "ignored",
    "suppressed",
  ].includes(status);
}

export async function GET(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");

    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("job_id");
    const status = searchParams.get("status") || "pending";

    let query = supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (jobId) query = query.eq("job_id", jobId);
    if (status !== "all") query = query.eq("outreach_status", status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outreach: data || [] });
  } catch (error) {
    console.error("Outreach GET error:", error);
    return NextResponse.json({ error: "Failed to load outreach." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");

    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const outreachId = clean(body.outreach_id || body.id);
    const status = clean(body.outreach_status || body.status).toLowerCase();

    if (!outreachId) {
      return NextResponse.json({ error: "Missing outreach_id" }, { status: 400 });
    }

    if (!isAllowedStatus(status)) {
      return NextResponse.json({ error: "Invalid outreach_status" }, { status: 400 });
    }

    const update: Record<string, string | null> = {
      outreach_status: status,
    };

    if (status === "responded") update.responded_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .update(update)
      .eq("id", outreachId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outreach: data });
  } catch (error) {
    console.error("Outreach PATCH error:", error);
    return NextResponse.json({ error: "Failed to update outreach." }, { status: 500 });
  }
}
