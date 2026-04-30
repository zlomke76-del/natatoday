import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const MUTABLE_STATUSES = new Set(["pending", "approved", "suppressed"]);

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const dealerSlug = searchParams.get("dealerSlug");
    const status = searchParams.get("status") || "pending";

    let query = supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .select(
        `
          *,
          jobs:job_id (
            id,
            title,
            slug,
            dealer_slug,
            publish_status,
            is_active
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (status !== "all") {
      query = query.eq("outreach_status", status);
    }

    if (dealerSlug) {
      query = query.eq("jobs.dealer_slug", dealerSlug);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Outreach load failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outreach: data || [] });
  } catch (error) {
    console.error("Outreach GET failed:", error);
    return NextResponse.json(
      { error: "Outreach could not be loaded." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");

    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const outreachId = clean(body.outreach_id);
    const outreachStatus = clean(body.outreach_status);

    if (!outreachId) {
      return NextResponse.json(
        { error: "outreach_id is required" },
        { status: 400 }
      );
    }

    if (!MUTABLE_STATUSES.has(outreachStatus)) {
      return NextResponse.json(
        {
          error:
            "outreach_status must be pending, approved, or suppressed from this endpoint.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .update({ outreach_status: outreachStatus })
      .eq("id", outreachId)
      .select("*")
      .single();

    if (error) {
      console.error("Outreach update failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ outreach: data });
  } catch (error) {
    console.error("Outreach PATCH failed:", error);
    return NextResponse.json(
      { error: "Outreach could not be updated." },
      { status: 500 }
    );
  }
}
