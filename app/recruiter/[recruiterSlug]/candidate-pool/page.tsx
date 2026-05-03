import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type SearchParams = Record<string, string | string[] | undefined>;

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string;
  linkedin: string | null;
  location_text: string | null;
  status: string;
  resume_url: string | null;
  profile_photo_url: string | null;
  created_at: string;
  updated_at?: string | null;
};

type Match = {
  id: string;
  candidate_id: string;
  job_id: string;
  distance_miles: number | null;
  fit_score: number | null;
  match_status: string;
  match_reason: string | null;
  created_at: string;
  updated_at?: string | null;
};

type Job = {
  id: string;
  title: string | null;
  location: string | null;
  public_dealer_name: string | null;
  public_location: string | null;
  publish_mode: string | null;
  dealer_slug: string | null;
};

type Recruiter = {
  id: string;
  name: string | null;
  slug: string | null;
  role?: string | null;
};

type ApplicationHistory = {
  id: string;
  email: string | null;
  status: string | null;
  job_id: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

type CandidateFlags = {
  isPriorApplicant: boolean;
  isPlaced: boolean;
  isRecentlyPlaced: boolean;
  isStalePlaced: boolean;
  isAtClientDealership: boolean;
  recentClientDealerSlugs: string[];
  recentClientDealers: string[];
  stalePlacedDealers: string[];
  priorStatuses: string[];
  latestPlacedAt: string | null;
};

type CandidatePoolRow = {
  candidate: Candidate;
  flags: CandidateFlags;
  matches: Array<{
    match: Match;
    job: Job | null;
  }>;
};

const MIN_VISIBLE_MATCH_SCORE = 70;
const MAX_VISIBLE_MATCHES = 5;
const PAGE_SIZE = 50;
const MATCH_FETCH_MULTIPLIER = 4;
const PLACEMENT_DECAY_YEARS = 2;

const placedStatuses = [
  "placed",
  "hired",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
];

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function getParam(searchParams: SearchParams | undefined, key: string, fallback = "") {
  const value = searchParams?.[key];
  if (Array.isArray(value)) return value[0] || fallback;
  return value || fallback;
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function displayDealerName(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPlacedStatus(value: unknown) {
  return placedStatuses.includes(normalize(value));
}

function parseDate(value: unknown) {
  if (!value || typeof value !== "string") return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isOlderThanDecayWindow(value: unknown) {
  const date = parseDate(value);

  if (!date) return false;

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - PLACEMENT_DECAY_YEARS);

  return date < cutoff;
}

function formatShortDate(value: unknown) {
  const date = parseDate(value);

  if (!date) return "date unknown";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}

function safePositiveInteger(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function buildQueryString(input: Record<string, string | number | null | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function getRecruiter(recruiterSlug: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,name,slug,role")
    .eq("slug", recruiterSlug)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recruiter:", error);
  }

  return data as Recruiter | null;
}

async function getClientDealerships() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("dealer_slug,public_dealer_name")
    .eq("is_active", true);

  if (error) {
    console.error("Failed to load client dealerships:", error);
    return new Map<string, string>();
  }

  const dealerMap = new Map<string, string>();

  for (const row of data || []) {
    const slug = normalize(row.dealer_slug);
    if (!slug) continue;

    dealerMap.set(
      slug,
      typeof row.public_dealer_name === "string" && row.public_dealer_name.trim()
        ? row.public_dealer_name.trim()
        : displayDealerName(slug),
    );
  }

  return dealerMap;
}

async function getJobIdsForRole(role: string) {
  const normalizedRole = normalize(role);

  if (!normalizedRole || normalizedRole === "all") return null;

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("id")
    .eq("is_active", true)
    .eq("publish_status", "published")
    .is("filled_at", null)
    .ilike("title", `%${normalizedRole}%`);

  if (error) {
    console.error("Failed to load role-filtered jobs:", error);
    return [] as string[];
  }

  return (data || []).map((job) => String(job.id));
}

async function getCandidateIdsForSearch(search: string) {
  const value = search.trim();
  if (!value) return null;

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id")
    .textSearch("search_text", value, { type: "plain" })
    .limit(5000);

  if (!error) {
    return (data || []).map((candidate) => String(candidate.id));
  }

  console.error("Candidate text search failed; falling back to ilike search:", error);

  const safe = value.replace(/[%_]/g, "");
  const pattern = `%${safe}%`;

  const fallback = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("id")
    .or(`name.ilike.${pattern},email.ilike.${pattern},location_text.ilike.${pattern}`)
    .limit(5000);

  if (fallback.error) {
    console.error("Candidate fallback search failed:", fallback.error);
    return [] as string[];
  }

  return (fallback.data || []).map((candidate) => String(candidate.id));
}

async function getApplicationHistory(emails: string[]) {
  if (emails.length === 0) return [] as ApplicationHistory[];

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id,email,status,job_id,created_at,updated_at")
    .in("email", emails);

  if (error) {
    console.error("Failed to load application history:", error);
    return [] as ApplicationHistory[];
  }

  return (data || []) as ApplicationHistory[];
}

async function getHistoryJobs(history: ApplicationHistory[]) {
  const jobIds = Array.from(
    new Set(
      history
        .map((item) => String(item.job_id || "").trim())
        .filter(Boolean),
    ),
  );

  if (jobIds.length === 0) return new Map<string, Job>();

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("id,title,location,public_dealer_name,public_location,publish_mode,dealer_slug")
    .in("id", jobIds);

  if (error) {
    console.error("Failed to load application-history jobs:", error);
    return new Map<string, Job>();
  }

  return new Map<string, Job>((data || []).map((job: any) => [String(job.id), job as Job]));
}

function buildCandidateFlags(input: {
  candidate: Candidate;
  history: ApplicationHistory[];
  historyJobsById: Map<string, Job>;
  clientDealers: Map<string, string>;
}): CandidateFlags {
  const { candidate, history, historyJobsById, clientDealers } = input;
  const email = normalize(candidate.email);

  const priorApps = history.filter((item) => normalize(item.email) === email);
  const priorStatuses = Array.from(
    new Set(
      priorApps
        .map((item) => String(item.status || "").trim())
        .filter(Boolean),
    ),
  );

  const placedApps = priorApps.filter((item) => isPlacedStatus(item.status));
  const latestPlaced = placedApps
    .map((item) => item.updated_at || item.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(String(b)).getTime() - new Date(String(a)).getTime())[0] || null;

  const isStalePlaced = Boolean(latestPlaced && isOlderThanDecayWindow(latestPlaced));
  const isRecentlyPlaced = placedApps.length > 0 && !isStalePlaced;

  const recentClientDealerSlugs: string[] = [];
  const recentClientDealers: string[] = [];
  const stalePlacedDealers: string[] = [];

  for (const app of placedApps) {
    const job = app.job_id ? historyJobsById.get(String(app.job_id)) : null;
    const dealerSlug = normalize(job?.dealer_slug);

    if (!dealerSlug || !clientDealers.has(dealerSlug)) continue;

    const dealerName = clientDealers.get(dealerSlug) || displayDealerName(dealerSlug);
    const placementDate = app.updated_at || app.created_at;
    const stale = isOlderThanDecayWindow(placementDate);

    if (stale) {
      stalePlacedDealers.push(dealerName);
    } else {
      recentClientDealerSlugs.push(dealerSlug);
      recentClientDealers.push(dealerName);
    }
  }

  return {
    isPriorApplicant: priorApps.length > 0,
    isPlaced: placedApps.length > 0 || normalize(candidate.status) === "placed",
    isRecentlyPlaced,
    isStalePlaced,
    isAtClientDealership: recentClientDealerSlugs.length > 0,
    recentClientDealerSlugs: Array.from(new Set(recentClientDealerSlugs)),
    recentClientDealers: Array.from(new Set(recentClientDealers)),
    stalePlacedDealers: Array.from(new Set(stalePlacedDealers)),
    priorStatuses,
    latestPlacedAt: latestPlaced,
  };
}

function getMatchProtection(job: Job | null, flags: CandidateFlags) {
  const jobDealerSlug = normalize(job?.dealer_slug);
  const sameRooftop = Boolean(jobDealerSlug && flags.recentClientDealerSlugs.includes(jobDealerSlug));

  if (sameRooftop) {
    return {
      blocked: true,
      overrideAllowed: false,
      relationshipFlag: "same_rooftop",
      label: "Dealer Protection Mode",
      note: "Candidate appears connected to the same rooftop. This match is blocked.",
    };
  }

  if (flags.isAtClientDealership) {
    return {
      blocked: false,
      overrideAllowed: true,
      relationshipFlag: "client_conflict",
      label: "Client relationship",
      note: "Candidate appears connected to another active client dealership. Don override required.",
    };
  }

  if (flags.isRecentlyPlaced) {
    return {
      blocked: false,
      overrideAllowed: true,
      relationshipFlag: "recent_placement",
      label: "Recent placement",
      note: "Candidate was placed within the last 2 years. Don override required.",
    };
  }

  if (flags.isStalePlaced) {
    return {
      blocked: false,
      overrideAllowed: false,
      relationshipFlag: "stale_placement",
      label: "Time decay applied",
      note: "Placement history is older than 2 years and treated as advisory.",
    };
  }

  if (flags.isPriorApplicant) {
    return {
      blocked: false,
      overrideAllowed: false,
      relationshipFlag: "prior_history",
      label: "Prior applicant",
      note: "Candidate has prior NATA history. Proceed with awareness.",
    };
  }

  return {
    blocked: false,
    overrideAllowed: false,
    relationshipFlag: "",
    label: "",
    note: "",
  };
}

function applyRiskFilter(rows: CandidatePoolRow[], risk: string) {
  if (!risk || risk === "all") return rows;

  return rows.filter((row) => {
    if (risk === "clear") {
      return !row.flags.isPriorApplicant && !row.flags.isPlaced && !row.flags.isAtClientDealership;
    }

    if (risk === "prior_history") return row.flags.isPriorApplicant;
    if (risk === "recent_placement") return row.flags.isRecentlyPlaced;
    if (risk === "stale_placement") return row.flags.isStalePlaced;
    if (risk === "client_conflict") return row.flags.isAtClientDealership;

    return true;
  });
}

async function getCandidatePool(searchParams: SearchParams | undefined) {
  noStore();

  const page = safePositiveInteger(getParam(searchParams, "page", "1"), 1);
  const role = normalize(getParam(searchParams, "role", "all"));
  const risk = normalize(getParam(searchParams, "risk", "all"));
  const search = getParam(searchParams, "search", "").trim();
  const minScore = Number(getParam(searchParams, "minScore", String(MIN_VISIBLE_MATCH_SCORE))) || MIN_VISIBLE_MATCH_SCORE;

  const matchLimit = PAGE_SIZE * MATCH_FETCH_MULTIPLIER;
  const matchOffset = (page - 1) * matchLimit;

  const [roleJobIds, searchCandidateIds] = await Promise.all([
    getJobIdsForRole(role),
    getCandidateIdsForSearch(search),
  ]);

  if (roleJobIds && roleJobIds.length === 0) {
    return { rows: [] as CandidatePoolRow[], page, hasNext: false, role, risk, search, minScore };
  }

  if (searchCandidateIds && searchCandidateIds.length === 0) {
    return { rows: [] as CandidatePoolRow[], page, hasNext: false, role, risk, search, minScore };
  }

  let matchQuery = supabaseAdmin
    .schema("nata")
    .from("candidate_matches")
    .select("*")
    .eq("match_status", "eligible")
    .gte("fit_score", minScore)
    .order("fit_score", { ascending: false })
    .order("updated_at", { ascending: false })
    .range(matchOffset, matchOffset + matchLimit - 1);

  if (roleJobIds) {
    matchQuery = matchQuery.in("job_id", roleJobIds);
  }

  if (searchCandidateIds) {
    matchQuery = matchQuery.in("candidate_id", searchCandidateIds);
  }

  const { data: matches, error: matchError } = await matchQuery;

  if (matchError) {
    console.error("Failed to load candidate matches:", matchError);
    return { rows: [] as CandidatePoolRow[], page, hasNext: false, role, risk, search, minScore };
  }

  const rawMatches = (matches || []) as Match[];
  const candidateIds = Array.from(new Set(rawMatches.map((match) => match.candidate_id)));
  const jobIds = Array.from(new Set(rawMatches.map((match) => match.job_id)));

  if (candidateIds.length === 0) {
    return { rows: [] as CandidatePoolRow[], page, hasNext: false, role, risk, search, minScore };
  }

  const [candidateResult, jobResult, clientDealers] = await Promise.all([
    supabaseAdmin.schema("nata").from("candidates").select("*").in("id", candidateIds),
    jobIds.length
      ? supabaseAdmin
          .schema("nata")
          .from("jobs")
          .select("id,title,location,public_dealer_name,public_location,publish_mode,dealer_slug")
          .in("id", jobIds)
      : Promise.resolve({ data: [], error: null }),
    getClientDealerships(),
  ]);

  if (candidateResult.error) {
    console.error("Failed to load candidates:", candidateResult.error);
    return { rows: [] as CandidatePoolRow[], page, hasNext: false, role, risk, search, minScore };
  }

  if (jobResult.error) {
    console.error("Failed to load matched jobs:", jobResult.error);
  }

  const candidates = (candidateResult.data || []) as Candidate[];
  const jobs = (jobResult.data || []) as Job[];
  const emails = Array.from(new Set(candidates.map((candidate) => candidate.email).filter(Boolean)));
  const history = await getApplicationHistory(emails);
  const historyJobsById = await getHistoryJobs(history);

  const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const matchesByCandidate = new Map<string, Match[]>();

  for (const match of rawMatches) {
    if (!matchesByCandidate.has(match.candidate_id)) {
      matchesByCandidate.set(match.candidate_id, []);
    }

    const currentMatches = matchesByCandidate.get(match.candidate_id) || [];

    if (currentMatches.length < MAX_VISIBLE_MATCHES) {
      currentMatches.push(match);
      matchesByCandidate.set(match.candidate_id, currentMatches);
    }
  }

  const groupedRows = Array.from(matchesByCandidate.entries())
    .map(([candidateId, candidateMatches]) => {
      const candidate = candidatesById.get(candidateId);
      if (!candidate) return null;

      return {
        candidate,
        flags: buildCandidateFlags({
          candidate,
          history,
          historyJobsById,
          clientDealers,
        }),
        matches: candidateMatches.map((match) => ({
          match,
          job: jobsById.get(match.job_id) || null,
        })),
      } satisfies CandidatePoolRow;
    })
    .filter((row): row is CandidatePoolRow => Boolean(row));

  const riskFilteredRows = applyRiskFilter(groupedRows, risk).slice(0, PAGE_SIZE);

  return {
    rows: riskFilteredRows,
    page,
    hasNext: rawMatches.length === matchLimit,
    role,
    risk,
    search,
    minScore,
  };
}

export default async function RecruiterCandidatePoolPage({
  params,
  searchParams,
}: {
  params: { recruiterSlug: string };
  searchParams?: SearchParams;
}) {
  const recruiter = await getRecruiter(params.recruiterSlug);
  const pool = await getCandidatePool(searchParams);
  const rows = pool.rows;
  const isDon = normalize(params.recruiterSlug).includes("don") || normalize(recruiter?.role).includes("admin");

  async function createApplicationFromMatch(formData: FormData) {
    "use server";

    const candidateId = clean(formData.get("candidate_id"));
    const jobId = clean(formData.get("job_id"));
    const matchId = clean(formData.get("match_id"));
    const relationshipFlag = clean(formData.get("relationship_flag"));
    const overrideRelationship = clean(formData.get("override_relationship")) === "yes";

    if (!candidateId || !jobId) {
      throw new Error("Candidate and job are required.");
    }

    if (relationshipFlag === "same_rooftop") {
      throw new Error("Dealer Protection Mode blocked this match because the candidate appears connected to the same rooftop.");
    }

    if (["client_conflict", "recent_placement"].includes(relationshipFlag) && !overrideRelationship) {
      throw new Error("Don override is required before creating an application for this flagged candidate.");
    }

    const { data: candidate, error: candidateError } = await supabaseAdmin
      .schema("nata")
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .maybeSingle();

    if (candidateError) throw new Error(candidateError.message);
    if (!candidate) throw new Error("Candidate not found.");

    const { data: job, error: jobError } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);
    if (!job) throw new Error("Job not found.");

    const { data: existing } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("id")
      .eq("job_id", jobId)
      .eq("email", candidate.email)
      .limit(1);

    const reason =
      relationshipFlag === "client_conflict"
        ? "Created from NATA candidate pool match with Don override. Candidate has active client-dealership relationship flag."
        : relationshipFlag === "recent_placement"
          ? "Created from NATA candidate pool match with Don override. Candidate has recent placement history."
          : relationshipFlag === "stale_placement"
            ? "Created from NATA candidate pool match. Prior placement is older than two years and treated as advisory."
            : relationshipFlag === "prior_history"
              ? "Created from NATA candidate pool match. Candidate has prior application history."
              : "Created from NATA candidate pool match.";

    if (!existing?.length) {
      const { error: insertError } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .insert({
          job_id: jobId,
          name: candidate.name,
          email: candidate.email,
          phone: candidate.phone,
          linkedin: candidate.linkedin,
          resume_url: candidate.resume_url,
          profile_photo_url: candidate.profile_photo_url,
          status: "new",
          screening_status: "new",
          virtual_interview_status: "not_scheduled",
          fit_score: Number(clean(formData.get("fit_score"))) || null,
          decision_reason: reason,
          assigned_recruiter: recruiter?.name || params.recruiterSlug,
          recruiter_id: recruiter?.id || null,
        });

      if (insertError) throw new Error(insertError.message);
    }

    if (matchId) {
      const { error: matchUpdateError } = await supabaseAdmin
        .schema("nata")
        .from("candidate_matches")
        .update({
          match_status: "application_created",
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchId);

      if (matchUpdateError) {
        console.error("Failed to update candidate match:", matchUpdateError);
      }
    }

    redirect(`/recruiter/${params.recruiterSlug}/dashboard`);
  }

  const baseQuery = {
    role: pool.role === "all" ? "" : pool.role,
    risk: pool.risk === "all" ? "" : pool.risk,
    search: pool.search,
    minScore: pool.minScore,
  };

  return (
    <main style={pageStyle}>
      <div style={wrapStyle}>
        <Link
          href={`/recruiter/${params.recruiterSlug}/dashboard`}
          style={backLinkStyle}
        >
          ← Back to recruiter dashboard
        </Link>

        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>NATA Candidate Pool</div>
            <h1 style={titleStyle}>Talent radar built for scale.</h1>
            <p style={ledeStyle}>
              Query-ranked candidate inventory. The page loads a bounded working
              set instead of rendering the whole pool, so it remains usable at
              20,000+ candidates.
            </p>
          </div>

          <div style={guardrailCardStyle}>
            <div style={guardrailTitleStyle}>Protection mode active</div>
            <div style={guardrailTextStyle}>
              Prior applicants and placed candidates are surfaced with flags.
              Same-rooftop conflicts are blocked. Recent placements or active
              client-dealership conflicts require Don override.
            </div>
          </div>
        </div>

        <form action="" style={filterBarStyle}>
          <input
            type="search"
            name="search"
            defaultValue={pool.search}
            placeholder="Search name, email, location, resume signals..."
            style={filterInputStyle}
          />
          <select name="role" defaultValue={pool.role} style={filterSelectStyle}>
            <option value="all">All roles</option>
            <option value="sales">Sales</option>
            <option value="service advisor">Service advisor</option>
            <option value="technician">Technician</option>
            <option value="bdc">BDC</option>
            <option value="parts">Parts</option>
            <option value="finance">Finance</option>
          </select>
          <select name="risk" defaultValue={pool.risk} style={filterSelectStyle}>
            <option value="all">All risk states</option>
            <option value="clear">Clear only</option>
            <option value="prior_history">Prior applicants</option>
            <option value="recent_placement">Recent placement</option>
            <option value="stale_placement">2+ year decay</option>
            <option value="client_conflict">Client conflict</option>
          </select>
          <input
            type="number"
            name="minScore"
            min={0}
            max={100}
            defaultValue={pool.minScore}
            style={scoreInputStyle}
            aria-label="Minimum match score"
          />
          <button type="submit" style={primaryButtonStyle}>
            Apply
          </button>
        </form>

        <div style={statsGridStyle}>
          <Stat label="Loaded candidates" value={rows.length} />
          <Stat
            label="Top-match candidates"
            value={rows.filter((row) => row.matches.length > 0).length}
          />
          <Stat
            label="Relationship flags"
            value={
              rows.filter(
                (row) =>
                  row.flags.isPriorApplicant ||
                  row.flags.isPlaced ||
                  row.flags.isAtClientDealership,
              ).length
            }
          />
        </div>

        <div style={listStyle}>
          {rows.length === 0 ? (
            <div style={emptyStyle}>
              <h2 style={{ margin: 0 }}>No candidates matched this view.</h2>
              <p style={{ color: "#9fb4d6", lineHeight: 1.6 }}>
                Adjust the score, role, risk, or search filters. Candidate pool
                submissions are matched into indexed rows before appearing here.
              </p>
            </div>
          ) : (
            rows.map(({ candidate, matches, flags }) => (
              <article key={candidate.id} style={candidateCardStyle}>
                <div style={candidateTopStyle}>
                  <div style={avatarStyle}>
                    {candidate.profile_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={candidate.profile_photo_url}
                        alt=""
                        style={avatarImageStyle}
                      />
                    ) : (
                      candidate.name.slice(0, 1).toUpperCase()
                    )}
                  </div>

                  <div>
                    <h2 style={candidateNameStyle}>{candidate.name}</h2>
                    <p style={candidateMetaStyle}>
                      {candidate.location_text || "Location not provided"} ·{" "}
                      {candidate.email} · {candidate.phone}
                    </p>
                    <div style={pillRowStyle}>
                      <span style={safePillStyle}>Visible</span>
                      <span style={statusPillStyle}>{candidate.status}</span>
                      <span style={thresholdPillStyle}>
                        Match threshold: {pool.minScore}+
                      </span>

                      {flags.isPriorApplicant ? (
                        <span style={warningPillStyle}>Prior applicant</span>
                      ) : null}

                      {flags.isRecentlyPlaced ? (
                        <span style={dangerPillStyle}>Recent placement</span>
                      ) : null}

                      {flags.isStalePlaced ? (
                        <span style={decayPillStyle}>2+ year decay</span>
                      ) : null}

                      {flags.isAtClientDealership ? (
                        <span style={conflictPillStyle}>
                          Current client dealership
                        </span>
                      ) : null}
                    </div>

                    {flags.isAtClientDealership ? (
                      <div style={conflictNoticeStyle}>
                        Candidate appears connected to {" "}
                        {flags.recentClientDealers.join(", ")}. Same-rooftop
                        matches are blocked. Other client conflicts require Don
                        override before application creation.
                      </div>
                    ) : flags.isStalePlaced ? (
                      <div style={decayNoticeStyle}>
                        Prior placement from {formatShortDate(flags.latestPlacedAt)}
                        {flags.stalePlacedDealers.length
                          ? ` (${flags.stalePlacedDealers.join(", ")})`
                          : ""} is older than {PLACEMENT_DECAY_YEARS} years and
                        downgraded to advisory risk.
                      </div>
                    ) : flags.isPriorApplicant || flags.isPlaced ? (
                      <div style={historyNoticeStyle}>
                        Candidate has prior NATA history
                        {flags.priorStatuses.length
                          ? `: ${flags.priorStatuses.join(", ")}`
                          : "."}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={actionRowStyle}>
                  {candidate.resume_url ? (
                    <a
                      href={candidate.resume_url}
                      target="_blank"
                      rel="noreferrer"
                      style={secondaryButtonStyle}
                    >
                      View resume
                    </a>
                  ) : null}

                  {candidate.linkedin ? (
                    <a
                      href={
                        candidate.linkedin.startsWith("http")
                          ? candidate.linkedin
                          : `https://${candidate.linkedin}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      style={secondaryButtonStyle}
                    >
                      LinkedIn
                    </a>
                  ) : null}
                </div>

                <div style={matchSectionStyle}>
                  <div style={sectionTitleStyle}>Top eligible role matches</div>

                  {matches.length === 0 ? (
                    <div style={noMatchStyle}>
                      No eligible top-match roles recorded yet.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {matches.map(({ match, job }) => {
                        const protection = getMatchProtection(job, flags);
                        const canOverride = protection.overrideAllowed && isDon;

                        return (
                          <div key={match.id} style={matchCardStyle}>
                            <div>
                              <div style={matchTitleStyle}>
                                {job?.title || "Matched role"}
                              </div>
                              <div style={matchMetaStyle}>
                                {job?.publish_mode === "confidential"
                                  ? "Confidential Dealership"
                                  : job?.public_dealer_name || "Dealership"}{" "}
                                ·{" "}
                                {job?.public_location ||
                                  job?.location ||
                                  "Location"}
                              </div>
                              {match.match_reason ? (
                                <div style={reasonStyle}>
                                  {match.match_reason}
                                </div>
                              ) : null}
                              {protection.relationshipFlag ? (
                                <div
                                  style={
                                    protection.blocked
                                      ? conflictInlineStyle
                                      : protection.relationshipFlag === "stale_placement"
                                        ? decayInlineStyle
                                        : warningInlineStyle
                                  }
                                >
                                  {protection.label}: {protection.note}
                                </div>
                              ) : null}
                            </div>

                            <div style={matchScoreWrapStyle}>
                              <span style={scoreStyle}>
                                {match.fit_score ?? "—"}
                              </span>
                              <span style={distanceStyle}>
                                {match.distance_miles
                                  ? `${Math.round(match.distance_miles)} mi`
                                  : "distance n/a"}
                              </span>

                              <form action={createApplicationFromMatch} style={formStackStyle}>
                                <input
                                  type="hidden"
                                  name="candidate_id"
                                  value={candidate.id}
                                />
                                <input
                                  type="hidden"
                                  name="job_id"
                                  value={match.job_id}
                                />
                                <input
                                  type="hidden"
                                  name="match_id"
                                  value={match.id}
                                />
                                <input
                                  type="hidden"
                                  name="fit_score"
                                  value={String(match.fit_score || "")}
                                />
                                <input
                                  type="hidden"
                                  name="relationship_flag"
                                  value={protection.relationshipFlag}
                                />

                                {canOverride ? (
                                  <label style={overrideLabelStyle}>
                                    <input
                                      type="checkbox"
                                      name="override_relationship"
                                      value="yes"
                                    />
                                    Don override reviewed
                                  </label>
                                ) : null}

                                <button
                                  type="submit"
                                  disabled={protection.blocked || (protection.overrideAllowed && !isDon)}
                                  style={
                                    protection.blocked || (protection.overrideAllowed && !isDon)
                                      ? disabledButtonStyle
                                      : canOverride
                                        ? overrideButtonStyle
                                        : primaryButtonStyle
                                  }
                                >
                                  {protection.blocked
                                    ? "Same rooftop blocked"
                                    : protection.overrideAllowed && !isDon
                                      ? "Don override required"
                                      : canOverride
                                        ? "Override + create"
                                        : protection.relationshipFlag === "stale_placement"
                                          ? "Create — time-decayed"
                                          : protection.relationshipFlag === "prior_history"
                                            ? "Create with history flag"
                                            : "Create application"}
                                </button>
                              </form>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        <div style={paginationStyle}>
          {pool.page > 1 ? (
            <Link
              href={`/recruiter/${params.recruiterSlug}/candidate-pool${buildQueryString({
                ...baseQuery,
                page: pool.page - 1,
              })}`}
              style={secondaryButtonStyle}
            >
              ← Previous
            </Link>
          ) : null}

          <span style={pageIndicatorStyle}>Page {pool.page}</span>

          {pool.hasNext ? (
            <Link
              href={`/recruiter/${params.recruiterSlug}/candidate-pool${buildQueryString({
                ...baseQuery,
                page: pool.page + 1,
              })}`}
              style={primaryLinkStyle}
            >
              Next 50 →
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statCardStyle}>
      <div style={statValueStyle}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 20% 0%, rgba(20,115,255,0.2), transparent 34%), #07111f",
  color: "#fff",
  padding: "42px 0 80px",
};

const wrapStyle: React.CSSProperties = {
  width: "min(1240px, calc(100% - 40px))",
  margin: "0 auto",
};

const backLinkStyle: React.CSSProperties = {
  color: "#93c5fd",
  textDecoration: "none",
  fontWeight: 850,
};

const headerStyle: React.CSSProperties = {
  marginTop: 28,
  display: "grid",
  gridTemplateColumns: "1fr minmax(300px, 420px)",
  gap: 24,
  alignItems: "end",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 12,
};

const titleStyle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "clamp(44px, 6vw, 76px)",
  lineHeight: 0.92,
  letterSpacing: "-0.055em",
};

const ledeStyle: React.CSSProperties = {
  color: "#bfd6f5",
  maxWidth: 780,
  fontSize: 18,
  lineHeight: 1.6,
};

const guardrailCardStyle: React.CSSProperties = {
  borderRadius: 24,
  padding: 20,
  background: "rgba(22,163,74,0.12)",
  border: "1px solid rgba(74,222,128,0.24)",
};

const guardrailTitleStyle: React.CSSProperties = {
  color: "#bbf7d0",
  fontWeight: 950,
  fontSize: 18,
};

const guardrailTextStyle: React.CSSProperties = {
  color: "#dcfce7",
  marginTop: 8,
  lineHeight: 1.5,
  fontSize: 14,
};

const filterBarStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 1fr) 170px 190px 92px auto",
  gap: 10,
  marginTop: 28,
  padding: 14,
  borderRadius: 22,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const filterInputStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(2,6,23,0.5)",
  color: "#fff",
  padding: "0 12px",
  outline: "none",
};

const filterSelectStyle: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(2,6,23,0.9)",
  color: "#fff",
  padding: "0 10px",
  outline: "none",
};

const scoreInputStyle: React.CSSProperties = {
  ...filterInputStyle,
  width: "100%",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 14,
  marginTop: 28,
};

const statCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 20,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const statValueStyle: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 950,
};

const statLabelStyle: React.CSSProperties = {
  color: "#9fb4d6",
  marginTop: 4,
  fontWeight: 800,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 28,
};

const emptyStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 28,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
};

const candidateCardStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 24,
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.035))",
  border: "1px solid rgba(255,255,255,0.12)",
};

const candidateTopStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "64px 1fr",
  gap: 16,
  alignItems: "center",
};

const avatarStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "rgba(20,115,255,0.22)",
  border: "1px solid rgba(147,197,253,0.22)",
  color: "#dbeafe",
  fontWeight: 950,
  overflow: "hidden",
};

const avatarImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const candidateNameStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
};

const candidateMetaStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#bfd6f5",
};

const pillRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 10,
};

const safePillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(22,163,74,0.14)",
  border: "1px solid rgba(74,222,128,0.22)",
  color: "#bbf7d0",
  fontSize: 12,
  fontWeight: 950,
};

const statusPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(147,197,253,0.12)",
  border: "1px solid rgba(147,197,253,0.2)",
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "capitalize",
};

const thresholdPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.22)",
  color: "#fef3c7",
  fontSize: 12,
  fontWeight: 950,
};

const warningPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.3)",
  color: "#fde68a",
  fontSize: 12,
  fontWeight: 950,
};

const dangerPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(239,68,68,0.15)",
  border: "1px solid rgba(248,113,113,0.4)",
  color: "#fecaca",
  fontSize: 12,
  fontWeight: 950,
};

const conflictPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(147,51,234,0.18)",
  border: "1px solid rgba(192,132,252,0.4)",
  color: "#e9d5ff",
  fontSize: 12,
  fontWeight: 950,
};

const decayPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(14,165,233,0.16)",
  border: "1px solid rgba(56,189,248,0.32)",
  color: "#bae6fd",
  fontSize: 12,
  fontWeight: 950,
};

const historyNoticeStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(250,204,21,0.08)",
  border: "1px solid rgba(250,204,21,0.18)",
  color: "#fde68a",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
};

const conflictNoticeStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(147,51,234,0.12)",
  border: "1px solid rgba(192,132,252,0.22)",
  color: "#e9d5ff",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
};

const decayNoticeStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 14,
  background: "rgba(14,165,233,0.1)",
  border: "1px solid rgba(56,189,248,0.2)",
  color: "#bae6fd",
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 16,
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 999,
  background: "rgba(147,197,253,0.12)",
  border: "1px solid rgba(147,197,253,0.22)",
  color: "#dbeafe",
  fontWeight: 900,
  textDecoration: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(20,115,255,0.45)",
  background: "#1473ff",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};

const primaryLinkStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
};

const overrideButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: "#7c3aed",
  border: "1px solid rgba(192,132,252,0.5)",
};

const disabledButtonStyle: React.CSSProperties = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(148,163,184,0.12)",
  color: "#cbd5e1",
  fontWeight: 950,
  cursor: "not-allowed",
};

const matchSectionStyle: React.CSSProperties = {
  marginTop: 20,
  paddingTop: 18,
  borderTop: "1px solid rgba(255,255,255,0.1)",
};

const sectionTitleStyle: React.CSSProperties = {
  color: "#f8fbff",
  fontWeight: 950,
  marginBottom: 12,
};

const noMatchStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: 14,
  background: "rgba(2,6,23,0.42)",
  border: "1px dashed rgba(255,255,255,0.18)",
  color: "#9fb4d6",
};

const matchCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  borderRadius: 18,
  padding: 14,
  background: "rgba(2,6,23,0.44)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const matchTitleStyle: React.CSSProperties = {
  color: "#fff",
  fontWeight: 950,
};

const matchMetaStyle: React.CSSProperties = {
  color: "#9fb4d6",
  marginTop: 4,
  fontSize: 13,
};

const reasonStyle: React.CSSProperties = {
  color: "#bfd6f5",
  marginTop: 7,
  fontSize: 12,
  lineHeight: 1.45,
};

const conflictInlineStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#fecaca",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 800,
};

const warningInlineStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#fde68a",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 800,
};

const decayInlineStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#bae6fd",
  fontSize: 12,
  lineHeight: 1.4,
  fontWeight: 800,
};

const matchScoreWrapStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 6,
  minWidth: 170,
};

const scoreStyle: React.CSSProperties = {
  color: "#facc15",
  fontSize: 24,
  fontWeight: 950,
};

const distanceStyle: React.CSSProperties = {
  color: "#bfd6f5",
  fontSize: 12,
  fontWeight: 850,
};

const formStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  justifyItems: "end",
};

const overrideLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  color: "#e9d5ff",
  fontSize: 12,
  fontWeight: 850,
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
  marginTop: 30,
};

const pageIndicatorStyle: React.CSSProperties = {
  color: "#bfd6f5",
  fontWeight: 900,
};
