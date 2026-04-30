import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeJob(job: any) {
  const isConfidential = job.publish_mode === "confidential";

  return {
    ...job,
    display_dealer: isConfidential
      ? "Confidential Dealership"
      : job.public_dealer_name || "Jersey Village Chrysler Jeep Dodge Ram",

    display_location: isConfidential
      ? job.public_location || "Houston, TX Market"
      : job.public_location || job.location,

    is_confidential: isConfidential,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  // 🔹 Single job
  if (slug) {
    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .eq("publish_status", "published")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job: normalizeJob(data) });
  }

  // 🔹 All jobs (public board)
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .eq("publish_status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (data || []).map(normalizeJob);

  return NextResponse.json({ jobs: normalized });
}

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get("x-nata-admin-key");

  if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const title = String(body.title || "").trim();

  if (!title) {
    return NextResponse.json({ error: "Job title is required" }, { status: 400 });
  }

  const slug = body.slug ? slugify(String(body.slug)) : slugify(title);

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .insert({
      title,
      slug,
      dealer_id: body.dealer_id || null,
      dealer_slug: body.dealer_slug || null,
      location: body.location || "",
      type: body.type || "",
      salary: body.salary || "",
      description: body.description || "",
      requirements: body.requirements || "",
      is_active: body.is_active ?? true,

      // 🔥 KEY ADDITIONS
      publish_mode: body.publish_mode || "public", // public | confidential
      public_dealer_name: body.public_dealer_name || null,
      public_location: body.public_location || null,
      confidential_note: body.confidential_note || null,
      published_by: "Solace",
      publish_status: body.publish_status || "published", // draft | published
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: normalizeJob(data) });
}
