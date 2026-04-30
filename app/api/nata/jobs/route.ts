import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function buildJobContent(input: {
  title: string;
  dealerName: string;
  location: string;
  salary: string;
  notes: string;
  publishMode: string;
}) {
  const title = input.title;
  const dealer =
    input.publishMode === "confidential"
      ? "A dealership in the market"
      : input.dealerName;
  const location = input.location || "the local market";

  const lower = title.toLowerCase();

  if (lower.includes("technician")) {
    return {
      description: `${dealer} is looking for an experienced ${title} who wants steady work, a strong vehicle mix, and a service department where ability matters.`,
      requirements:
        "ASE or OEM certification preferred. Strong diagnostic ability, dealership experience, consistent availability, and clear communication are strong advantages.",
      role_hook: `${dealer} needs a ${title} who can step into a real service workflow and help keep vehicles moving through the shop with quality and consistency.`,
      responsibilities: [
        "Diagnose and repair customer vehicles",
        "Perform maintenance, inspections, and service repairs",
        "Communicate findings clearly with advisors and the service team",
        "Support a steady workflow with quality and consistency",
      ],
      fit_signals: [
        "ASE or OEM certification preferred",
        "Diagnostic ability and dealership experience are strong advantages",
        "Consistent availability and good communication",
        "Truck, SUV, CDJR, or high-volume service experience helpful",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  if (lower.includes("advisor")) {
    return {
      description: `${dealer} is looking for a ${title} who can handle volume, communicate clearly, and help customers move through the service process with confidence.`,
      requirements:
        "Service lane experience preferred. Strong customer communication, follow-up discipline, and dealership process familiarity are important.",
      role_hook: `${dealer} needs a ${title} who can bring organization, communication, and follow-through to a busy service lane in ${location}.`,
      responsibilities: [
        "Greet service customers and understand repair or maintenance needs",
        "Communicate clearly between customers, technicians, and management",
        "Help protect follow-up, CSI, and service lane organization",
        "Support a fast-moving service department",
      ],
      fit_signals: [
        "Service advisor or customer-facing automotive experience preferred",
        "Strong communication and follow-up discipline",
        "Comfort working with volume and multiple priorities",
        "Dealership process or DMS familiarity helpful",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  if (lower.includes("sales")) {
    return {
      description: `${dealer} is building its sales pipeline for candidates who can work with customers, follow up consistently, and operate in a real dealership environment.`,
      requirements:
        "Automotive sales experience preferred but not required. Strong communication, availability, consistency, and customer follow-up are important.",
      role_hook: `${dealer} is looking for a ${title} who can turn conversations into opportunities and help customers move confidently through the buying process.`,
      responsibilities: [
        "Work with customers through the vehicle shopping and sales process",
        "Follow up consistently with leads, appointments, and opportunities",
        "Build product confidence around new and used inventory",
        "Operate within a structured dealership sales workflow",
      ],
      fit_signals: [
        "Automotive sales experience preferred but not required",
        "Strong communication and customer follow-up",
        "Availability and consistency matter",
        "Truck, SUV, retail, or dealership sales experience helpful",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  return {
    description:
      input.notes ||
      `${dealer} is hiring for a ${title} role in ${location}. This position is part of an active dealership hiring request managed through Solace.`,
    requirements:
      "Relevant experience, strong communication, consistent availability, and dealership or customer-facing experience are helpful.",
    role_hook: `${dealer} is looking for a ${title} who can step into a real operating environment and contribute with consistency, communication, and follow-through.`,
    responsibilities: [
      "Support day-to-day dealership operations within the role",
      "Communicate clearly with customers, managers, and team members",
      "Follow process and maintain consistent availability",
      "Contribute to a professional, performance-driven environment",
    ],
    fit_signals: [
      "Relevant experience preferred",
      "Strong communication and reliability",
      "Comfort working in a fast-moving dealership environment",
      "Consistent availability and follow-through",
    ],
    process_note:
      "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

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

  return NextResponse.json({ jobs: (data || []).map(normalizeJob) });
}

export async function POST(request: NextRequest) {
  const adminKey = request.headers.get("x-nata-admin-key");

  if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const title = clean(body.title);
  if (!title) {
    return NextResponse.json({ error: "Job title is required" }, { status: 400 });
  }

  const dealerSlug = clean(body.dealer_slug, "jersey-village-cdjr");
  const dealerName = clean(
    body.public_dealer_name,
    "Jersey Village Chrysler Jeep Dodge Ram"
  );
  const location = clean(body.location || body.public_location, "Jersey Village, TX");
  const salary = clean(body.salary);
  const type = clean(body.type, "Full-time");
  const notes = clean(body.notes || body.request_notes);
  const publishMode = clean(body.publish_mode, "public");

  const baseSlug = body.slug
    ? slugify(String(body.slug))
    : slugify(`${dealerSlug}-${title}`);

  const generated = buildJobContent({
    title,
    dealerName,
    location,
    salary,
    notes,
    publishMode,
  });

  const jobPayload = {
    title,
    slug: baseSlug,
    dealer_id: body.dealer_id || null,
    dealer_slug: dealerSlug,
    location,
    type,
    salary,
    description: clean(body.description, generated.description),
    requirements: clean(body.requirements, generated.requirements),
    role_hook: clean(body.role_hook, generated.role_hook),
    responsibilities:
      Array.isArray(body.responsibilities) && body.responsibilities.length > 0
        ? body.responsibilities
        : generated.responsibilities,
    fit_signals:
      Array.isArray(body.fit_signals) && body.fit_signals.length > 0
        ? body.fit_signals
        : generated.fit_signals,
    process_note: clean(body.process_note, generated.process_note),
    is_active: body.is_active ?? true,
    publish_mode: publishMode,
    public_dealer_name: publishMode === "confidential" ? null : dealerName,
    public_location: clean(body.public_location, location),
    confidential_note:
      publishMode === "confidential"
        ? clean(
            body.confidential_note,
            "This role is being handled confidentially on behalf of a dealership. Candidate information is reviewed before any dealership handoff."
          )
        : null,
    published_by: "Solace",
    publish_status: clean(body.publish_status, "published"),
  };

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .upsert(jobPayload, { onConflict: "slug" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: normalizeJob(data) });
}
