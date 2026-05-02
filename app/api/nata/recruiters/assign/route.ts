import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const BACKLOG_THRESHOLD = 10;
const DON_OVERLOAD_THRESHOLD = 15;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { applicationId, recruiterId, mode } = body;

    // ===== 1. Manual assignment always wins =====
    if (mode === "manual" && recruiterId) {
      await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({ recruiter_id: recruiterId })
        .eq("id", applicationId);

      return NextResponse.json({ success: true, mode: "manual" });
    }

    // ===== 2. Get backlog =====
    const { data: backlogApps } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("id")
      .neq("screening_status", "rejected")
      .neq("virtual_interview_status", "completed");

    const backlogCount = backlogApps?.length || 0;

    // ===== 3. Get recruiters =====
    const { data: recruiters } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("id,name,role,status")
      .eq("status", "active");

    // ===== 4. Get application counts =====
    const { data: appCounts } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("recruiter_id");

    const loadMap: Record<string, number> = {};

    for (const r of recruiters || []) {
      loadMap[r.id] = 0;
    }

    for (const a of appCounts || []) {
      if (a.recruiter_id) {
        loadMap[a.recruiter_id] =
          (loadMap[a.recruiter_id] || 0) + 1;
      }
    }

    // ===== 5. Identify Don =====
    const don = recruiters?.find(r => r.name.includes("Don"));

    const donLoad = don ? loadMap[don.id] || 0 : 0;

    // ===== 6. Decide if auto should run =====
    const shouldAuto =
      backlogCount > BACKLOG_THRESHOLD ||
      donLoad > DON_OVERLOAD_THRESHOLD;

    if (!shouldAuto) {
      return NextResponse.json({
        success: true,
        mode: "no_auto",
        backlogCount,
        donLoad,
      });
    }

    // ===== 7. Find lowest load recruiter (excluding Don if overloaded) =====
    const candidates = recruiters?.filter(r => {
      if (!r.id) return false;
      if (don && r.id === don.id && donLoad > DON_OVERLOAD_THRESHOLD) {
        return false;
      }
      return true;
    });

    let best = null;
    let lowest = Infinity;

    for (const r of candidates || []) {
      const score = loadMap[r.id] || 0;
      if (score < lowest) {
        lowest = score;
        best = r;
      }
    }

    if (!best) {
      return NextResponse.json({
        success: false,
        error: "No recruiter available",
      });
    }

    // ===== 8. Assign =====
    await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({ recruiter_id: best.id })
      .eq("id", applicationId);

    return NextResponse.json({
      success: true,
      mode: "auto",
      assignedTo: best.name,
      backlogCount,
      donLoad,
    });

  } catch (error) {
    console.error("Assignment engine failed:", error);

    return NextResponse.json(
      { error: "Assignment failed" },
      { status: 500 }
    );
  }
}
