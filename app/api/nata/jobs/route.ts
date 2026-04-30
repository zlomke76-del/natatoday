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

type JobContentInput = {
  title: string;
  dealerName: string;
  location: string;
  salary: string;
  notes: string;
  publishMode: string;
  priority: string;
};

function buildJobContent(input: JobContentInput) {
  const title = input.title;
  const dealer =
    input.publishMode === "confidential"
      ? "A dealership in the market"
      : input.dealerName;
  const location = input.location || "the local market";
  const salary = input.salary;
  const notes = input.notes;
  const priority = input.priority;
  const lower = title.toLowerCase();

  const urgencyLine =
    priority.toLowerCase().includes("urgent") || priority.toLowerCase().includes("immediate")
      ? "This role is actively being filled. Qualified candidates are reviewed quickly."
      : "Qualified candidates are reviewed before dealership handoff so the first conversation starts with useful context.";

  const compensationLine = salary
    ? `Compensation is structured within ${salary} depending on experience, consistency, and fit.`
    : "Compensation details will be discussed with qualified candidates during the review process.";

  const noteLine = notes ? ` The dealership also noted: ${notes}` : "";

  if (lower.includes("technician")) {
    return {
      description: `${dealer} is hiring an experienced ${title} for a busy service department with steady workflow, a strong vehicle mix, and real opportunity for someone who takes pride in quality work. ${compensationLine} ${urgencyLine}${noteLine}`,
      requirements:
        "ASE or OEM certification preferred. Strong diagnostic ability, dealership experience, consistent availability, and clear communication are strong advantages.",
      role_hook: `${dealer} needs a ${title} who can step into a real service workflow in ${location} and help keep vehicles moving through the shop with quality and consistency.`,
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
      description: `${dealer} is hiring a ${title} who can handle service-lane volume, communicate clearly, and help customers move through the repair process with confidence. ${compensationLine} ${urgencyLine}${noteLine}`,
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
      description: `${dealer} is actively hiring a ${title} to support a real dealership sales floor with customer traffic, inventory opportunity, and a team that values follow-through. ${compensationLine} ${urgencyLine}${noteLine}`,
      requirements:
        "Automotive sales experience preferred but not required. Strong communication, availability, consistency, and customer follow-up are important.",
      role_hook: `${dealer} is looking for a ${title} who can turn conversations into opportunities and help customers move confidently through the buying process in ${location}.`,
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

  if (lower.includes("bdc")) {
    return {
      description: `${dealer} is hiring a ${title} to support customer follow-up, appointment setting, and lead communication in a fast-moving dealership environment. ${compensationLine} ${urgencyLine}${noteLine}`,
      requirements:
        "Strong phone skills, follow-up discipline, schedule consistency, and customer communication experience are important.",
      role_hook: `${dealer} needs a ${title} who can keep opportunities moving, communicate clearly, and help turn customer interest into scheduled conversations.`,
      responsibilities: [
        "Respond to customer inquiries and follow-up opportunities",
        "Set appointments and support communication between customers and the store",
        "Maintain consistent follow-up and accurate notes",
        "Help keep the dealership pipeline organized and moving",
      ],
      fit_signals: [
        "Strong phone and written communication",
        "Appointment-setting or customer service experience helpful",
        "Consistency and follow-up discipline",
        "Automotive or dealership experience helpful but not required",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  if (lower.includes("parts")) {
    return {
      description: `${dealer} is hiring a ${title} to support parts counter activity, internal service needs, and customer requests in a dealership environment. ${compensationLine} ${urgencyLine}${noteLine}`,
      requirements:
        "Parts counter experience, dealership familiarity, organization, communication, and follow-through are strong advantages.",
      role_hook: `${dealer} needs a ${title} who can support technicians, customers, and internal workflow with accuracy and consistency.`,
      responsibilities: [
        "Support parts counter and internal service department needs",
        "Help identify, locate, and organize parts requests",
        "Communicate clearly with service, technicians, and customers",
        "Maintain accurate workflow and follow-through",
      ],
      fit_signals: [
        "Parts counter or dealership parts experience preferred",
        "Strong organization and attention to detail",
        "Comfort supporting technicians and service workflow",
        "Consistent availability and communication",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  return {
    description:
      notes ||
      `${dealer} is hiring for a ${title} role in ${location}. This position is part of an active dealership hiring request managed through Solace. ${compensationLine} ${urgencyLine}`,
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

  const title = clean(body.title || body.role);
  if (!title) {
    return NextResponse.json({ error: "Job title is required" }, { status: 400 });
  }

  const dealerSlug = clean(body.dealer_slug, "jersey-village-cdjr");
  const dealerName = clean(
    body.public_dealer_name,
    "Jersey Village Chrysler Jeep Dodge Ram"
  );
  const location = clean(body.location || body.public_location, "Jersey Village, TX");
  const salary = clean(body.salary || body.payRange || body.pay_range);
  const type = clean(body.type, "Full-time");
  const notes = clean(body.notes || body.request_notes);
  const priority = clean(body.priority, "Standard");
  const publishMode = clean(body.publish_mode, "public");

  const slugBase = slugify(`${dealerSlug}-${title}`);
  const baseSlug = body.slug
    ? slugify(String(body.slug))
    : `${slugBase}-${Date.now()}`;

  const generated = buildJobContent({
    title,
    dealerName,
    location,
    salary,
    notes,
    publishMode,
    priority,
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
    .insert(jobPayload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ job: normalizeJob(data) });
}
