import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type FeedJob = {
  id: string;
  title: string | null;
  slug: string | null;
  dealer_slug: string | null;
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
  public_dealer_name: string | null;
  public_location: string | null;
  distribution_status: string | null;
  created_at: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

function cdata(value: unknown) {
  const text = typeof value === "string" && value.trim() ? value.trim() : "";

  return `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function xmlEscape(value: unknown) {
  const text =
    typeof value === "string" || typeof value === "number"
      ? String(value)
      : "";

  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeSalaryForFeed(value: string | null) {
  if (!value) return "";

  let salary = value.trim();

  salary = salary
    .replace(/\s*\/\s*hour/gi, " / hour")
    .replace(/\s*\/\s*hr/gi, " / hour")
    .replace(/\s*per\s*hour/gi, " / hour")
    .replace(/\s*\/\s*year/gi, " / year")
    .replace(/\s*per\s*year/gi, " / year")
    .replace(/\s+/g, " ")
    .trim();

  salary = salary.replace(
    /\$?(\d{2,3})\s*[-–]\s*\$?(\d{2,3})\s*\/\s*hour/i,
    "$$$1 - $$$2 / hour"
  );

  salary = salary.replace(
    /\$?(\d{4,6})\s*[-–]\s*\$?(\d{4,6})\s*\/\s*year/i,
    (_match, min, max) =>
      `$${String(min).replace(/,/g, "")} - $${String(max).replace(
        /,/g,
        ""
      )} / year`
  );

  salary = salary.replace(
    /\$?(\d{2,3})k\s*[-–]\s*\$?(\d{2,3})k\s*\/\s*year/i,
    (_match, min, max) =>
      `$${Number(min) * 1000} - $${Number(max) * 1000} / year`
  );

  salary = salary.replace(
    /\$?(\d{2,3})k\s*[-–]\s*\$?(\d{2,3})k/i,
    (_match, min, max) =>
      `$${Number(min) * 1000} - $${Number(max) * 1000} / year`
  );

  salary = salary.replace(/^\$?(\d{2,3})\s*\/\s*hour$/i, "$$$1 / hour");

  salary = salary.replace(/^\$?(\d{4,6})\s*\/\s*year$/i, (_match, amount) =>
    `$${String(amount).replace(/,/g, "")} / year`
  );

  return salary;
}

function normalizeJobType(type: string | null) {
  const value = (type || "").toLowerCase();

  if (value.includes("part")) return "parttime";
  if (value.includes("contract")) return "contract";
  if (value.includes("temporary") || value.includes("temp")) return "temporary";
  if (value.includes("intern")) return "internship";

  return "fulltime";
}

function parseLocation(job: FeedJob) {
  const raw = (job.public_location || job.location || "").trim();

  if (!raw) {
    return {
      city: "Jersey Village",
      state: "TX",
      country: "US",
      postalcode: "",
    };
  }

  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return {
      city: parts[0],
      state: parts[1],
      country: "US",
      postalcode: "",
    };
  }

  return {
    city: raw,
    state: "",
    country: "US",
    postalcode: "",
  };
}

function buildCategory(title: string | null) {
  const value = (title || "").toLowerCase();

  if (value.includes("technician")) return "Automotive, Service, Technician";
  if (value.includes("advisor"))
    return "Automotive, Service Advisor, Customer Service";
  if (value.includes("sales")) return "Automotive, Sales, Retail";
  if (value.includes("bdc")) return "Automotive, BDC, Customer Service";
  if (value.includes("parts")) return "Automotive, Parts, Fixed Operations";
  if (value.includes("finance")) return "Automotive, Finance, F&I";

  return "Automotive, Dealership";
}

function buildExperience(title: string | null) {
  const value = (title || "").toLowerCase();

  if (value.includes("technician")) {
    return "Automotive service experience preferred. ASE or OEM certification is helpful but not always required.";
  }

  if (value.includes("advisor")) {
    return "Service lane or customer-facing automotive experience preferred.";
  }

  if (value.includes("sales")) {
    return "Automotive sales experience preferred but not required.";
  }

  if (value.includes("bdc")) {
    return "Customer service, phone, appointment-setting, or dealership experience helpful.";
  }

  if (value.includes("parts")) {
    return "Parts counter or dealership parts experience preferred.";
  }

  if (value.includes("finance")) {
    return "Automotive finance, F&I, or dealership sales management experience preferred.";
  }

  return "Relevant dealership, customer-facing, or role-specific experience helpful.";
}

function buildDescriptionHtml(job: FeedJob) {
  const lines: string[] = [];

  if (job.role_hook) {
    lines.push(`<p>${xmlEscape(job.role_hook)}</p>`);
  }

  if (job.description) {
    lines.push(`<p>${xmlEscape(stripHtml(job.description))}</p>`);
  }

  if (Array.isArray(job.responsibilities) && job.responsibilities.length > 0) {
    lines.push("<h3>What you will do</h3>");
    lines.push("<ul>");
    for (const item of job.responsibilities) {
      if (item?.trim()) lines.push(`<li>${xmlEscape(item)}</li>`);
    }
    lines.push("</ul>");
  }

  if (Array.isArray(job.fit_signals) && job.fit_signals.length > 0) {
    lines.push("<h3>What makes you a strong fit</h3>");
    lines.push("<ul>");
    for (const item of job.fit_signals) {
      if (item?.trim()) lines.push(`<li>${xmlEscape(item)}</li>`);
    }
    lines.push("</ul>");
  }

  if (job.requirements) {
    lines.push("<h3>Requirements</h3>");
    lines.push(`<p>${xmlEscape(stripHtml(job.requirements))}</p>`);
  }

  if (job.process_note) {
    lines.push("<h3>How the process works</h3>");
    lines.push(`<p>${xmlEscape(stripHtml(job.process_note))}</p>`);
  }

  lines.push(
    "<p>NATA Today reviews applications before dealership handoff so qualified candidates reach the right interview stage with useful context.</p>"
  );

  return lines.join("\n");
}

function buildJobXml(job: FeedJob) {
  const baseUrl = getBaseUrl();
  const slug = job.slug || job.id;
  const url = `${baseUrl}/careers/${encodeURIComponent(slug)}`;
  const location = parseLocation(job);
  const company = job.public_dealer_name || "NATA Today";
  const date = job.created_at || new Date().toISOString();
  const salary = normalizeSalaryForFeed(job.salary);

  return `
  <job>
    <title>${cdata(job.title || "Dealership Opportunity")}</title>
    <date>${cdata(date)}</date>
    <referencenumber>${cdata(job.id)}</referencenumber>
    <url>${cdata(url)}</url>
    <company>${cdata(company)}</company>
    <sourcename>${cdata("NATA Today")}</sourcename>
    <city>${cdata(location.city)}</city>
    <state>${cdata(location.state)}</state>
    <country>${cdata(location.country)}</country>
    <postalcode>${cdata(location.postalcode)}</postalcode>
    <email>${cdata(process.env.NATA_JOBS_CONTACT_EMAIL || "team@natatoday.ai")}</email>
    <description>${cdata(buildDescriptionHtml(job))}</description>
    <salary>${cdata(salary)}</salary>
    <jobtype>${cdata(normalizeJobType(job.type))}</jobtype>
    <category>${cdata(buildCategory(job.title))}</category>
    <experience>${cdata(buildExperience(job.title))}</experience>
    <education>${cdata("High school diploma or equivalent preferred")}</education>
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
        "dealer_slug",
        "location",
        "type",
        "salary",
        "description",
        "requirements",
        "role_hook",
        "responsibilities",
        "fit_signals",
        "process_note",
        "publish_mode",
        "publish_status",
        "public_dealer_name",
        "public_location",
        "distribution_status",
        "created_at",
      ].join(",")
    )
    .eq("is_active", true)
    .eq("publish_status", "published")
    .eq("publish_mode", "public")
    .eq("distribution_status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to generate NATA job feed:", error);

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
