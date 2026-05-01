import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../components/Nav";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type AnyRow = Record<string, any>;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function candidateName(application: AnyRow) {
  return String(application.name || application.candidate_name || application.email || "Candidate");
}

function statusLabel(application: AnyRow) {
  return String(application.virtual_interview_status || application.screening_status || application.status || "new");
}

async function loadRecruiterQueue() {
  noStore();

  const { data: applicationsData, error: applicationsError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .in("screening_status", ["virtual_invited", "virtual_scheduled", "needs_review", "virtual_completed"])
    .order("created_at", { ascending: false });

  if (applicationsError) {
    console.error("Failed to load recruiter queue:", applicationsError);
  }

  const applications = (applicationsData || []) as AnyRow[];
  const jobIds = Array.from(new Set(applications.map((app) => String(app.job_id)).filter(Boolean)));

  let jobs: AnyRow[] = [];

  if (jobIds.length > 0) {
    const { data: jobsData, error: jobsError } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .in("id", jobIds);

    if (jobsError) {
      console.error("Failed to load queue jobs:", jobsError);
    } else {
      jobs = (jobsData || []) as AnyRow[];
    }
  }

  const jobById = new Map(jobs.map((job) => [String(job.id), job]));

  return applications.map((application) => ({
    application,
    job: jobById.get(String(application.job_id)),
  }));
}

export default async function RecruiterDashboardPage() {
  const queue = await loadRecruiterQueue();

  return (
    <main className="shell">
      <Nav />

      <section className="wrap" style={{ padding: "46px 0 90px" }}>
        <div className="eyebrow">Recruiter Control Center</div>
        <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>
          Virtual interviews and packet handoff.
        </h1>
        <p className="lede" style={{ maxWidth: 760 }}>
          This is Don’s operating cockpit: conduct virtual interviews, document notes, generate packets, and schedule manager interviews before candidates reach the dealer board.
        </p>

        <section style={{ marginTop: 34 }}>
          <div className="eyebrow">Interview queue</div>

          {queue.length > 0 ? (
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              {queue.map(({ application, job }) => (
                <article
                  key={application.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 18,
                    alignItems: "center",
                    padding: 22,
                    borderRadius: 24,
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, color: "#fff", fontSize: 24 }}>
                      {candidateName(application)}
                    </h2>
                    <p style={{ margin: "6px 0 0", color: "#bfd6f5" }}>
                      {job?.title || "Open role"} · {statusLabel(application)}
                    </p>
                    <p style={{ margin: "10px 0 0", color: "#9fb4d6", lineHeight: 1.5 }}>
                      {application.screening_summary || application.cover_note || "Candidate is ready for recruiter review."}
                    </p>
                  </div>

                  <Link
                    className="btn btn-primary"
                    href={`/recruiter/interviews/${application.id}`}
                    style={{ textDecoration: "none" }}
                  >
                    Open studio
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div
              style={{
                marginTop: 16,
                padding: 28,
                borderRadius: 24,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#cfe2ff",
              }}
            >
              No virtual interviews are currently queued.
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
