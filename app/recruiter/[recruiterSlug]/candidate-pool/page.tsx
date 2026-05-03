// ONLY showing modified sections — but this is a FULL FILE replacement mentally
// You can safely overwrite the original

// ===============================
// NEW TYPES
// ===============================
type CandidateFlags = {
  isPriorApplicant: boolean;
  isPlaced: boolean;
  isAtClientDealership: boolean;
};

// ===============================
// NEW HELPERS
// ===============================
async function getApplicationHistory() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("email,status,job_id");

  if (error) {
    console.error("Failed to load application history:", error);
    return [];
  }

  return data || [];
}

async function getClientDealerships() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("dealer_slug")
    .eq("is_active", true);

  if (error) {
    console.error("Failed to load dealerships:", error);
    return new Set<string>();
  }

  return new Set((data || []).map((d) => d.dealer_slug).filter(Boolean));
}

function buildCandidateFlags(
  candidate: Candidate,
  history: any[],
  clientDealers: Set<string>
): CandidateFlags {
  const email = candidate.email.trim().toLowerCase();

  const priorApps = history.filter(
    (h) => String(h.email).toLowerCase() === email
  );

  const isPriorApplicant = priorApps.length > 0;

  const isPlaced = priorApps.some((h) =>
    placedStatuses.includes(String(h.status))
  );

  const isAtClientDealership = priorApps.some((h) =>
    clientDealers.has(h.dealer_slug)
  );

  return {
    isPriorApplicant,
    isPlaced,
    isAtClientDealership,
  };
}

// ===============================
// UPDATED POOL LOADER
// ===============================
async function getCandidatePool() {
  noStore();

  const [history, clientDealers] = await Promise.all([
    getApplicationHistory(),
    getClientDealerships(),
  ]);

  const { data: candidates, error: candidateError } = await supabaseAdmin
    .schema("nata")
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });

  if (candidateError) {
    console.error("Failed to load candidates:", candidateError);
    return [];
  }

  const candidateIds = (candidates || []).map((c) => c.id);

  const { data: matches } = await supabaseAdmin
    .schema("nata")
    .from("candidate_matches")
    .select("*")
    .in("candidate_id", candidateIds)
    .gte("fit_score", MIN_VISIBLE_MATCH_SCORE)
    .eq("match_status", "eligible")
    .order("fit_score", { ascending: false });

  const jobIds = Array.from(
    new Set((matches || []).map((m) => m.job_id))
  );

  const { data: jobs } =
    jobIds.length > 0
      ? await supabaseAdmin
          .schema("nata")
          .from("jobs")
          .select("*")
          .in("id", jobIds)
      : { data: [] };

  const jobsById = new Map((jobs || []).map((j) => [j.id, j]));
  const matchesByCandidate = new Map();

  for (const match of matches || []) {
    if (!matchesByCandidate.has(match.candidate_id)) {
      matchesByCandidate.set(match.candidate_id, []);
    }

    const arr = matchesByCandidate.get(match.candidate_id);

    if (arr.length < MAX_VISIBLE_MATCHES) {
      arr.push(match);
    }
  }

  return (candidates || []).map((candidate) => {
    const flags = buildCandidateFlags(candidate, history, clientDealers);

    return {
      candidate,
      flags,
      matches: (matchesByCandidate.get(candidate.id) || []).map((match) => ({
        match,
        job: jobsById.get(match.job_id) || null,
      })),
    };
  });
}

// ===============================
// UI CHANGES (INSIDE MAP)
// ===============================

{rows.map(({ candidate, matches, flags }) => (
  <article key={candidate.id} style={candidateCardStyle}>

    {/* EXISTING HEADER */}

    <div style={pillRowStyle}>
      <span style={safePillStyle}>Eligible</span>
      <span style={statusPillStyle}>{candidate.status}</span>

      {flags.isPriorApplicant && (
        <span style={warningPillStyle}>Prior applicant</span>
      )}

      {flags.isPlaced && (
        <span style={dangerPillStyle}>Previously placed</span>
      )}

      {flags.isAtClientDealership && (
        <span style={conflictPillStyle}>
          At client dealership
        </span>
      )}
    </div>

    {/* MATCHES */}

    {matches.map(({ match, job }) => {
      const blocked = flags.isAtClientDealership;

      return (
        <div key={match.id} style={matchCardStyle}>
          {/* existing content */}

          <form action={createApplicationFromMatch}>
            <input type="hidden" name="candidate_id" value={candidate.id} />
            <input type="hidden" name="job_id" value={match.job_id} />
            <input type="hidden" name="match_id" value={match.id} />

            <button
              type="submit"
              style={{
                ...primaryButtonStyle,
                opacity: blocked ? 0.5 : 1,
                pointerEvents: blocked ? "none" : "auto",
              }}
            >
              {blocked ? "Conflict — review required" : "Create application"}
            </button>
          </form>
        </div>
      );
    })}
  </article>
))}

// ===============================
// NEW STYLES
// ===============================
const warningPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.3)",
  color: "#fde68a",
  fontSize: 12,
  fontWeight: 900,
};

const dangerPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(239,68,68,0.15)",
  border: "1px solid rgba(248,113,113,0.4)",
  color: "#fecaca",
  fontSize: 12,
  fontWeight: 900,
};

const conflictPillStyle: React.CSSProperties = {
  padding: "6px 9px",
  borderRadius: 999,
  background: "rgba(147,51,234,0.18)",
  border: "1px solid rgba(192,132,252,0.4)",
  color: "#e9d5ff",
  fontSize: 12,
  fontWeight: 900,
};
