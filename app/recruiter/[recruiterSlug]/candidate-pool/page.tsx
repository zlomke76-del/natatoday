import Link from "next/link";
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
  created_at: string;
};

type Job = {
  id: string;
  title: string | null;
  location: string | null;
  public_dealer_name: string | null;
  public_location: string | null;
  publish_mode: string | null;
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

async function getPlacedCandidateEmails() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("email,status")
    .in("status", placedStatuses);

  if (error) {
    console.error("Failed to load placed candidates:", error);
    return new Set<string>();
  }

  return new Set(
    (data || [])
      .map((row) => String(row.email || "").trim().toLowerCase())
      .filter(Boolean)
  );
}

async function getCandidatePool() {
  noStore();

  const placedEmails = await getPlacedCandidateEmails();

  const { data: candidates, error: candidateError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("*")
    .neq("status", "placed")
    .order("created_at", { ascending: false });

  if (candidateError) {
    console.error("Failed to load candidates:", candidateError);
    return [];
  }

  const safeCandidates = ((candidates || []) as Candidate[]).filter(
    (candidate) => !placedEmails.has(candidate.email.trim().toLowerCase())
  );

  const candidateIds = safeCandidates.map((candidate) => candidate.id);

  if (candidateIds.length === 0) return [];

  const { data: matches, error: matchError } = await supabaseAdmin
    .schema("nata")
    .from("candidate_matches")
    .select("*")
    .in("candidate_id", candidateIds)
    .gte("fit_score", MIN_VISIBLE_MATCH_SCORE)
    .order("fit_score", { ascending: false });

  if (matchError) {
    console.error("Failed to load candidate matches:", matchError);
  }

  const jobIds = Array.from(
    new Set(((matches || []) as Match[]).map((match) => match.job_id))
  );

  const { data: jobs, error: jobError } =
    jobIds.length > 0
      ? await supabaseAdmin
          .schema("nata")
          .from("jobs")
          .select(
            "id,title,location,public_dealer_name,public_location,publish_mode"
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
  const rows = await getCandidatePool();

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
              Active candidates who have not been previously placed. Only the
              top {MAX_VISIBLE_MATCHES} eligible matches at or above {MIN_VISIBLE_MATCH_SCORE} are surfaced.
            </p>
          </div>

          <div style={guardrailCardStyle}>
            <div style={guardrailTitleStyle}>Safeguards active</div>
            <div style={guardrailTextStyle}>
              Prior placed candidates are excluded by candidate status and prior
              application history. No solicitation is triggered from this dashboard.
            </div>
          </div>
        </div>

        <div style={statsGridStyle}>
          <Stat label="Eligible candidates" value={rows.length} />
          <Stat
            label="Top-match candidates"
            value={rows.filter((row) => row.matches.length > 0).length}
          />
          <Stat
            label="Needs matching"
            value={rows.filter((row) => row.matches.length === 0).length}
          />
        </div>

        <div style={listStyle}>
          {rows.length === 0 ? (
            <div style={emptyStyle}>
              <h2 style={{ margin: 0 }}>No eligible candidates yet.</h2>
              <p style={{ color: "#9fb4d6", lineHeight: 1.6 }}>
                Candidate pool submissions will appear here after they are added
                and confirmed not previously placed.
              </p>
            </div>
          ) : (
            rows.map(({ candidate, matches }) => (
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
                      <span style={safePillStyle}>Eligible</span>
                      <span style={statusPillStyle}>{candidate.status}</span>
                      <span style={thresholdPillStyle}>
                        Match threshold: {MIN_VISIBLE_MATCH_SCORE}+
                      </span>
                    </div>
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
                      {matches.map(({ match, job }) => (
                        <div key={match.id} style={matchCardStyle}>
                          <div>
                            <div style={matchTitleStyle}>
                              {job?.title || "Matched role"}
                            </div>
                            <div style={matchMetaStyle}>
                              {job?.publish_mode === "confidential"
                                ? "Confidential Dealership"
                                : job?.public_dealer_name || "Dealership"}{" "}
                              · {job?.public_location || job?.location || "Location"}
                            </div>
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
                          </div>
                        </div>
                      ))}
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

const matchScoreWrapStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 4,
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
