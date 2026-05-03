import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

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
};

type ApplicationHistory = {
  id?: string;
  email: string | null;
  status: string | null;
  job_id: string | null;
  current_employer?: string | null;
  current_dealer_slug?: string | null;
};

type CandidateFlags = {
  isPriorApplicant: boolean;
  isPlaced: boolean;
  isAtClientDealership: boolean;
  currentClientDealers: string[];
  priorStatuses: string[];
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

async function getRecruiter(recruiterSlug: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,name,slug")
    .eq("slug", recruiterSlug)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recruiter:", error);
  }

  return data as Recruiter | null;
}

async function getApplicationHistory() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id,email,status,job_id");

  if (error) {
    console.error("Failed to load application history:", error);
    return [] as ApplicationHistory[];
  }

  return (data || []) as ApplicationHistory[];
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

  return new Map((data || []).map((job) => [String(job.id), job as Job]));
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

  const currentClientDealers = Array.from(
    new Set(
      priorApps
        .map((item) => {
          const directDealer =
            normalize(item.current_dealer_slug) ||
            normalize(item.current_employer);

          if (directDealer && clientDealers.has(directDealer)) {
            return clientDealers.get(directDealer) || displayDealerName(directDealer);
          }

          const job = item.job_id ? historyJobsById.get(String(item.job_id)) : null;
          const jobDealerSlug = normalize(job?.dealer_slug);

          if (jobDealerSlug && clientDealers.has(jobDealerSlug)) {
            return clientDealers.get(jobDealerSlug) || displayDealerName(jobDealerSlug);
          }

          return "";
        })
        .filter(Boolean),
    ),
  );

  return {
    isPriorApplicant: priorApps.length > 0,
    isPlaced:
      normalize(candidate.status) === "placed" ||
      priorApps.some((item) => placedStatuses.includes(normalize(item.status))),
    isAtClientDealership: currentClientDealers.length > 0,
    currentClientDealers,
    priorStatuses,
  };
}

async function getCandidatePool() {
  noStore();

  const [history, clientDealers] = await Promise.all([
    getApplicationHistory(),
    getClientDealerships(),
  ]);

  const historyJobsById = await getHistoryJobs(history);

  const { data: candidates, error: candidateError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });

  if (candidateError) {
    console.error("Failed to load candidates:", candidateError);
    return [] as CandidatePoolRow[];
  }

  const safeCandidates = (candidates || []) as Candidate[];
  const candidateIds = safeCandidates.map((candidate) => candidate.id);

  const { data: matches, error: matchError } =
    candidateIds.length > 0
      ? await supabaseAdmin
          .schema("nata")
          .from("candidate_matches")
          .select("*")
          .in("candidate_id", candidateIds)
          .gte("fit_score", MIN_VISIBLE_MATCH_SCORE)
          .eq("match_status", "eligible")
          .order("fit_score", { ascending: false })
      : { data: [], error: null };

  if (matchError) {
    console.error("Failed to load candidate matches:", matchError);
  }

  const jobIds = Array.from(
    new Set(((matches || []) as Match[]).map((match) => match.job_id)),
  );

  const { data: jobs, error: jobError } =
    jobIds.length > 0
      ? await supabaseAdmin
          .schema("nata")
          .from("jobs")
          .select(
            "id,title,location,public_dealer_name,public_location,publish_mode,dealer_slug",
          )
          .in("id", jobIds)
      : { data: [], error: null };

  if (jobError) {
    console.error("Failed to load matched jobs:", jobError);
  }

  const jobsById = new Map((jobs || []).map((job) => [job.id, job as Job]));
  const matchesByCandidate = new Map<string, Match[]>();

  for (const match of (matches || []) as Match[]) {
    if (!matchesByCandidate.has(match.candidate_id)) {
      matchesByCandidate.set(match.candidate_id, []);
    }

    const currentMatches = matchesByCandidate.get(match.candidate_id) || [];

    if (currentMatches.length < MAX_VISIBLE_MATCHES) {
      currentMatches.push(match);
      matchesByCandidate.set(match.candidate_id, currentMatches);
    }
  }

  return safeCandidates.map((candidate) => ({
    candidate,
    flags: buildCandidateFlags({
      candidate,
      history,
      historyJobsById,
      clientDealers,
    }),
    matches: (matchesByCandidate.get(candidate.id) || []).map((match) => ({
      match,
      job: jobsById.get(match.job_id) || null,
    })),
  }));
}

export default async function RecruiterCandidatePoolPage({
  params,
}: {
  params: { recruiterSlug: string };
}) {
  const recruiter = await getRecruiter(params.recruiterSlug);
  const rows = await getCandidatePool();

  async function createApplicationFromMatch(formData: FormData) {
    "use server";

    const candidateId = clean(formData.get("candidate_id"));
    const jobId = clean(formData.get("job_id"));
    const matchId = clean(formData.get("match_id"));
    const relationshipFlag = clean(formData.get("relationship_flag"));

    if (!candidateId || !jobId) {
      throw new Error("Candidate and job are required.");
    }

    if (relationshipFlag === "client_conflict") {
      throw new Error(
        "Candidate is flagged as working with a current client dealership. Recruiter approval workflow is required before creating a new application.",
      );
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
          decision_reason:
            relationshipFlag === "prior_history"
              ? "Created from NATA candidate pool match. Candidate has prior application or placement history; recruiter review required before outreach."
              : "Created from NATA candidate pool match.",
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
            <h1 style={titleStyle}>Available talent radar.</h1>
            <p style={ledeStyle}>
              Active, prior, and previously placed candidates may be surfaced
              with relationship flags. Only the top {MAX_VISIBLE_MATCHES} eligible
              matches at or above {MIN_VISIBLE_MATCH_SCORE} are shown.
            </p>
          </div>

          <div style={guardrailCardStyle}>
            <div style={guardrailTitleStyle}>Safeguards active</div>
            <div style={guardrailTextStyle}>
              Prior applicants and placed candidates are classified instead of
              hidden. Current client-dealership conflicts are flagged and gated
              before a new application can be created.
            </div>
          </div>
        </div>

        <div style={statsGridStyle}>
          <Stat label="Visible candidates" value={rows.length} />
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
              <h2 style={{ margin: 0 }}>No candidates yet.</h2>
              <p style={{ color: "#9fb4d6", lineHeight: 1.6 }}>
                Candidate pool submissions will appear here after they are added
                and matched against active dealership roles.
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
                        Match threshold: {MIN_VISIBLE_MATCH_SCORE}+
                      </span>

                      {flags.isPriorApplicant ? (
                        <span style={warningPillStyle}>Prior applicant</span>
                      ) : null}

                      {flags.isPlaced ? (
                        <span style={dangerPillStyle}>Previously placed</span>
                      ) : null}

                      {flags.isAtClientDealership ? (
                        <span style={conflictPillStyle}>
                          Current client dealership
                        </span>
                      ) : null}
                    </div>

                    {flags.isAtClientDealership ? (
                      <div style={conflictNoticeStyle}>
                        Candidate appears connected to{" "}
                        {flags.currentClientDealers.join(", ")}. Create
                        application is gated until recruiter approval workflow is
                        added.
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
                        const blocked = flags.isAtClientDealership;
                        const relationshipFlag = flags.isAtClientDealership
                          ? "client_conflict"
                          : flags.isPriorApplicant || flags.isPlaced
                            ? "prior_history"
                            : "";

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

                              <form action={createApplicationFromMatch}>
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
                                  value={relationshipFlag}
                                />
                                <button
                                  type="submit"
                                  disabled={blocked}
                                  style={
                                    blocked
                                      ? disabledButtonStyle
                                      : primaryButtonStyle
                                  }
                                >
                                  {blocked
                                    ? "Conflict — review required"
                                    : relationshipFlag === "prior_history"
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
  maxWidth: 760,
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
  minHeight: 36,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(20,115,255,0.45)",
  background: "#1473ff",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  minHeight: 36,
  padding: "0 12px",
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

const matchScoreWrapStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 6,
  minWidth: 150,
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
