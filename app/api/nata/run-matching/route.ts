import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  linkedin: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  resume_url: string | null;
  status: string | null;
};

type Job = {
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
  public_dealer_name: string | null;
  public_location: string | null;
  latitude: number | null;
  longitude: number | null;
};

const MAX_DISTANCE_MILES = 100;

const PLACED_STATUSES = [
  "placed",
  "hired",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return clean(value).toLowerCase();
}

function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const radius = 3958.8;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function scoreCandidateForJob(candidate: Candidate, job: Job) {
  const jobText = [
    job.title,
    job.description,
    job.requirements,
    job.role_hook,
    ...(job.responsibilities || []),
    ...(job.fit_signals || []),
    job.process_note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const candidateText = [
    candidate.name,
    candidate.linkedin,
    candidate.resume_url,
    candidate.location_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 45;

  const keywords = Array.from(
    new Set(
      jobText
        .split(/\s+/)
        .map((word) => word.replace(/[^a-z0-9]/g, ""))
        .filter((word) => word.length > 5)
    )
  ).slice(0, 60);

  const matches = keywords.filter((word) => candidateText.includes(word)).length;

  if (matches >= 10) score += 20;
  else if (matches >= 5) score += 12;
  else score -= 8;

  if (candidateText.includes("automotive") || candidateText.includes("dealership")) {
    score += 12;
  }

  if (candidateText.includes("sales") || candidateText.includes("customer")) {
    score += 8;
  }

  if (
    candidateText.includes("technician") ||
    candidateText.includes("ase") ||
    candidateText.includes("diagnostic")
  ) {
    score += 12;
  }

  if (
    candidateText.includes("available") ||
    candidateText.includes("weekend") ||
    candidateText.includes("full-time")
  ) {
    score += 6;
  }

  if (!candidate.resume_url) score -= 15;

  return Math.max(0, Math.min(100, score));
}

async function getPlacedEmails() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("email,status")
    .in("status", PLACED_STATUSES);

  if (error) {
    console.error("Failed to load placed application emails:", error);
    return new Set<string>();
  }

  return new Set(
    (data || [])
      .map((row) => normalizeEmail(row.email))
      .filter(Boolean)
  );
}

async function runMatching() {
  const placedEmails = await getPlacedEmails();

  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select(
      "id,name,email,phone,linkedin,location_text,latitude,longitude,resume_url,status"
    )
    .neq("status", "placed");

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  const eligibleCandidates = ((candidates || []) as Candidate[]).filter(
    (candidate) => {
      const email = normalizeEmail(candidate.email);
      return (
        email &&
        !placedEmails.has(email) &&
        candidate.latitude !== null &&
        candidate.longitude !== null
      );
    }
  );

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      "id,title,slug,location,type,salary,description,requirements,role_hook,responsibilities,fit_signals,process_note,publish_mode,public_dealer_name,public_location,latitude,longitude"
    )
    .eq("is_active", true)
    .eq("publish_status", "published");

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const activeJobs = ((jobs || []) as Job[]).filter(
    (job) => job.latitude !== null && job.longitude !== null
  );

  let evaluated = 0;
  let matched = 0;
  let skippedPlaced = placedEmails.size;
  let skippedNoLocation = 0;

  for (const candidate of eligibleCandidates) {
    if (candidate.latitude === null || candidate.longitude === null) {
      skippedNoLocation++;
      continue;
    }

    for (const job of activeJobs) {
      if (job.latitude === null || job.longitude === null) continue;

      evaluated++;

      const distance = haversineMiles(
        candidate.latitude,
        candidate.longitude,
        job.latitude,
        job.longitude
      );

      if (distance > MAX_DISTANCE_MILES) continue;

      const fitScore = scoreCandidateForJob(candidate, job);

      const { error: upsertError } = await supabaseAdmin
        .schema("nata")
        .from("candidate_matches")
        .upsert(
          {
            candidate_id: candidate.id,
            job_id: job.id,
            distance_miles: Number(distance.toFixed(1)),
            fit_score: fitScore,
            match_status: "pending",
          },
          {
            onConflict: "candidate_id,job_id",
          }
        );

      if (upsertError) {
        console.error("Candidate match upsert failed:", upsertError);
        continue;
      }

      matched++;
    }
  }

  return {
    success: true,
    evaluated,
    matched,
    eligibleCandidates: eligibleCandidates.length,
    activeJobs: activeJobs.length,
    skippedPlaced,
    skippedNoLocation,
    radiusMiles: MAX_DISTANCE_MILES,
  };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.NATA_MATCH_RUNNER_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runMatching();

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/nata/run-matching failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Candidate matching failed",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
