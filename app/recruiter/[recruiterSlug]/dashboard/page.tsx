import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type AnyRow = Record<string, any>;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function RecruiterDashboard({
  params,
}: {
  params: { recruiterSlug: string };
}) {
  noStore();

  const { recruiterSlug } = params;

  const { data: recruiter, error: recruiterError } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", recruiterSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (recruiterError) {
    console.error("Failed to load recruiter:", recruiterError);
  }

  if (!recruiter) {
    return (
      <main className="shell">
        <Nav />
        <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "60px 0" }}>
          <div className="eyebrow">Recruiter Control Center</div>
          <h1>Recruiter not found.</h1>
          <p style={{ color: "#cfe2ff" }}>This recruiter workspace does not exist or is inactive.</p>
        </section>
      </main>
    );
  }

  const { data: applicationsData, error: applicationsError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("recruiter_id", recruiter.id)
    .in("screening_status", [
      "virtual_invited",
      "virtual_scheduled",
      "needs_review",
      "virtual_completed",
    ])
    .order("created_at", { ascending: false });

  if (applicationsError) {
    console.error("Failed to load recruiter queue:", applicationsError);
  }

  const applications = (applicationsData || []) as AnyRow[];

  return (
    <main className="shell">
      <Nav />

      <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "60px 0" }}>
        <div className="eyebrow">Recruiter Control Center</div>

        <h1>{recruiter.name} — Interview Pipeline</h1>

        <p style={{ color: "#cfe2ff", maxWidth: 760 }}>
          Conduct virtual interviews, document notes, generate packets, and schedule manager interviews before candidates reach the dealer board.
        </p>

        <div className="section-kicker" style={{ marginTop: 44 }}>
          Interview Queue
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {applications.length === 0 ? (
            <div
              style={{
                padding: 28,
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
                color: "#cfe2ff",
              }}
            >
              No assigned candidates are currently waiting for this recruiter.
            </div>
          ) : (
            applications.map((application) => (
              <article
                key={application.id}
                style={{
                  padding: 24,
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 20,
                  alignItems: "center",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>
                    {application.name || application.candidate_name || application.email || "Candidate"}
                  </h2>

                  <p style={{ margin: "8px 0 0", color: "#cfe2ff" }}>
                    {application.role || "Candidate"} ·{" "}
                    {application.virtual_interview_status ||
                      application.screening_status ||
                      application.status ||
                      "new"}
                  </p>

                  <p style={{ margin: "10px 0 0", color: "#9fb1cc" }}>
                    {application.decision_reason || "Ready for recruiter review."}
                  </p>
                </div>

                <Link
                  href={`/recruiter/${recruiterSlug}/interviews/${application.id}`}
                  className="btn btn-primary"
                >
                  Open studio
                </Link>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
