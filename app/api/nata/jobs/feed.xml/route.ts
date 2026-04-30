import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type FeedJob = {
  id: string;
  title: string | null;
  slug: string | null;
  location: string | null;
  type: string | null;
  salary: string | null;
  description: string | null;
  requirements: string | null;
  role_hook: string | null;
  responsibilities: string[] | null;
  fit_signals: string[] | null;
  process_note: string | null;
  publish_mode: string | null;
  publish_status: string | null;
  distribution_status: string | null;
  public_dealer_name: string | null;
  public_location: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

function getBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NATA_PUBLIC_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDescription(job: FeedJob) {
  const blocks: string[] = [];

  if (job.role_hook) blocks.push(job.role_hook);
  if (job.description) blocks.push(job.description);

  if (Array.isArray(job.responsibilities) && job.responsibilities.length > 0) {
    blocks.push(
      `Responsibilities:\n${job.responsibilities
        .filter(Boolean)
        .map((item) => `- ${item}`)
        .join("\n")}`
    );
  }

  if (Array.isArray(job.fit_signals) && job.fit_signals.length > 0) {
    blocks.push(
      `Strong fit signals:\n${job.fit_signals
        .filter(Boolean)
        .map((item) => `- ${item}`)
        .join("\n")}`
    );
  }

  if (job.requirements) blocks.push(`Requirements:\n${job.requirements}`);
  if (job.process_note) blocks.push(job.process_note);

  blocks.push(
    "Apply through NATA Today so your application can be reviewed and routed through the structured hiring process."
  );

  return blocks.join("\n\n");
}

function renderJobXml(job: FeedJob, baseUrl: string) {
  const dealerName =
    job.publish_mode === "confidential"
      ? "Confidential Dealership"
      : job.public_dealer_name || "NATA Today";

  const location =
    job.publish_mode === "confidential"
      ? job.public_location || job.location || "Houston, TX Market"
      : job.public_location || job.location || "Houston, TX Market";

  const applyUrl = `${baseUrl}/careers/${encodeURIComponent(job.slug || job.id)}`;
  const postedAt = job.created_at || new Date().toISOString();
  const updatedAt = job.updated_at || job.created_at || new Date().toISOString();

  return `
  <job>
    <id>${escapeXml(job.id)}</id>
    <title>${escapeXml(job.title)}</title>
    <company>${escapeXml(dealerName)}</company>
    <location>${escapeXml(location)}</location>
    <jobtype>${escapeXml(job.type || "Full-time")}</jobtype>
    <salary>${escapeXml(job.salary || "")}</salary>
    <description><![CDATA[${formatDescription(job)}]]></description>
    <apply_url>${escapeXml(applyUrl)}</apply_url>
    <date>${escapeXml(postedAt)}</date>
    <updated>${escapeXml(updatedAt)}</updated>
    <source>${escapeXml("NATA Today")}</source>
  </job>`;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      "id,title,slug,location,type,salary,description,requirements,role_hook,responsibilities,fit_signals,process_note,publish_mode,publish_status,distribution_status,public_dealer_name,public_location,created_at,updated_at"
    )
    .eq("is_active", true)
    .eq("publish_status", "published")
    .eq("publish_mode", "public")
    .eq("distribution_status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to build NATA job feed:", error);
    return NextResponse.json(
      { error: "Job feed could not be generated" },
      { status: 500 }
    );
  }

  const baseUrl = getBaseUrl().replace(/\/$/, "");
  const jobs = (data || []) as FeedJob[];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>NATA Today</publisher>
  <publisherurl>${escapeXml(baseUrl)}</publisherurl>
  <lastBuildDate>${escapeXml(new Date().toISOString())}</lastBuildDate>
${jobs.map((job) => renderJobXml(job, baseUrl)).join("\n")}
</source>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
