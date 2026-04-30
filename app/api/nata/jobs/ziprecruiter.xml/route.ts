import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

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
  public_dealer_name: string | null;
  public_location: string | null;
  created_at: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const APPLY_PROCESS_NOTE =
  "Apply directly through NATA Today. Applications are reviewed before dealership handoff so qualified candidates move forward with context.";

function getBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");

  return "http://localhost:3000";
}

function cdata(value: unknown) {
  const text = typeof value === "string" && value.trim() ? value.trim() : "";
  return `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";

  return stripHtml(value)
    .replace(/\b20\/hr\b/gi, "$20 per hour")
    .replace(/\s*\/\s*hour\b/gi, " per hour")
    .replace(/\s*\/\s*year\b/gi, " per year")
    .replace(/Compensation is structured within\s+/gi, "Compensation is ")
    .replace(/depending on experience, consistency, and fit/gi, "depending on experience and fit")
    .replace(/NATA Today reviews applications before dealership handoff so qualified candidates reach the right interview stage with useful context\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSalaryForFeed(value: string | null) {
  if (!value) return "";

  return value
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s*\/\s*hr\b/gi, " per hour")
    .replace(/\s*\/\s*hour\b/gi, " per hour")
    .replace(/\s*\/\s*yr\b/gi, " per year")
    .replace(/\s*\/\s*year\b/gi, " per year")
    .replace(/\bhr\b/gi, "hour")
    .replace(/\byr\b/gi, "year")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeJobType(type: string | null) {
  const value = (type || "").toLowerCase();

  if (value.includes("part")) return "part-time";
  if (value.includes("contract")) return "contract";
  if (value.includes("temporary") || value.includes("temp")) return "temporary";
  if (value.includes("intern")) return "internship";

  return "full-time";
}

function parseLocation(job: FeedJob) {
  const raw = (job.public_location || job.location || "Jersey Village, TX")
    .trim()
    .replace(/\s+/g, " ");

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);

  return {
    city: parts[0] || "Jersey Village",
    state: parts[1] || "TX",
    country: "US",
  };
}

function buildDescription(job: FeedJob) {
  const parts: string[] = [];

  if (job.role_hook) parts.push(cleanText(job.role_hook));
  if (job.description) {
    const description = cleanText(job.description);
    const roleHook = cleanText(job.role_hook || "");

    if (description && description !== roleHook) parts.push(description);
  }

  if (Array.isArray(job.responsibilities) && job.responsibilities.length > 0) {
    parts.push(`What you will do: ${job.responsibilities.map(cleanText).filter(Boolean).join("; ")}.`);
  }

  if (Array.isArray(job.fit_signals) && job.fit_signals.length > 0) {
    parts.push(`Strong fit signals: ${job.fit_signals.map(cleanText).filter(Boolean).join("; ")}.`);
  }

  if (job.requirements) parts.push(`Requirements: ${cleanText(job.requirements)}`);
  parts.push(APPLY_PROCESS_NOTE);

  return parts.filter(Boolean).join("\n\n");
}

function buildJobXml(job: FeedJob) {
  const baseUrl = getBaseUrl();
  const slug = job.slug || job.id;
  const url = `${baseUrl}/careers/${encodeURIComponent(slug)}`;
  const location = parseLocation(job);
  const company = job.public_dealer_name || "NATA Today";

  return `
  <job>
    <id>${cdata(job.id)}</id>
    <title>${cdata(job.title || "Dealership Opportunity")}</title>
    <company>${cdata(company)}</company>
    <url>${cdata(url)}</url>
    <location>${cdata(`${location.city}, ${location.state}`)}</location>
    <city>${cdata(location.city)}</city>
    <state>${cdata(location.state)}</state>
    <country>${cdata(location.country)}</country>
    <description>${cdata(buildDescription(job))}</description>
    <compensation>${cdata(normalizeSalaryForFeed(job.salary))}</compensation>
    <jobtype>${cdata(normalizeJobType(job.type))}</jobtype>
    <date>${cdata(job.created_at || new Date().toISOString())}</date>
    <email>${cdata(process.env.NATA_JOBS_CONTACT_EMAIL || "team@natatoday.ai")}</email>
  </job>`;
}

export async function GET() {
  noStore();

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      [
        "id",
        "title",
        "slug",
        "location",
        "type",
        "salary",
        "description",
        "requirements",
        "role_hook",
        "responsibilities",
        "fit_signals",
        "public_dealer_name",
        "public_location",
        "created_at",
      ].join(",")
    )
    .eq("is_active", true)
    .eq("publish_status", "published")
    .eq("publish_mode", "public")
    .eq("distribution_status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to generate NATA ZipRecruiter feed:", error);

    return new NextResponse("Feed unavailable", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const jobs = ((data || []) as unknown) as FeedJob[];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<source>
  <publisher>${cdata("NATA Today")}</publisher>
  <publisherurl>${cdata(getBaseUrl())}</publisherurl>
  <lastBuildDate>${cdata(new Date().toISOString())}</lastBuildDate>
${jobs.map(buildJobXml).join("\n")}
</source>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
