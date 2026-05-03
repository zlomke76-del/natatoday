import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

const POOL_STATUSES = [
  "not_hired",
  "rejected",
  "not_selected",
  "no_show",
];

const PLACED_STATUSES = [
  "hired",
  "placed",
  "dealer_hired",
];

function normalize(v: any) {
  return String(v || "").toLowerCase().trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      job_id,
      application_id,
      outcome,
      decision_reason,
    } = body;

    if (!job_id || !application_id) {
      return NextResponse.json(
        { error: "Missing job_id or application_id" },
        { status: 400 }
      );
    }

    // =========================
    // LOAD APPLICATION
    // =========================
    const { data: app, error: appError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (appError || !app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const email = app.email?.toLowerCase();

    // =========================
    // UPDATE APPLICATION
    // =========================
    await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: outcome,
        decision_reason,
      })
      .eq("id", application_id);

    // =========================
    // HANDLE HIRE (PROTECT)
    // =========================
    if (PLACED_STATUSES.includes(normalize(outcome))) {
      await supabaseAdmin
        .schema("nata")
        .from("candidates")
        .update({
          status: "placed",
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      return NextResponse.json({
        ok: true,
        job_closed: true,
      });
    }

    // =========================
    // HANDLE RETURN TO POOL
    // =========================
    if (POOL_STATUSES.includes(normalize(outcome))) {
      // UPSERT INTO POOL
      const { data: candidate } = await supabaseAdmin
        .schema("nata")
        .from("candidates")
        .upsert(
          {
            name: app.name,
            email: email,
            phone: app.phone,
            location_text: app.location_text || null,
            resume_url: app.resume_url || null,
            profile_photo_url: app.profile_photo_url || null,
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        )
        .select("*")
        .single();

      // =========================
      // REMATCH ENGINE
      // =========================
      if (candidate) {
        const { data: jobs } = await supabaseAdmin
          .schema("nata")
          .from("jobs")
          .select("*")
          .eq("is_active", true);

        const matches = (jobs || []).map((job: any) => ({
          candidate_id: candidate.id,
          job_id: job.id,
          fit_score: Math.floor(Math.random() * 30) + 70, // replace with real scoring
          match_status: "eligible",
          updated_at: new Date().toISOString(),
        }));

        if (matches.length) {
          await supabaseAdmin
            .schema("nata")
            .from("candidate_matches")
            .upsert(matches, {
              onConflict: "candidate_id,job_id",
            });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      job_closed: false,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Decision failed" },
      { status: 500 }
    );
  }
}
