import Nav from "@/app/components/Nav";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export default async function RecruiterDashboard({
  params,
}: {
  params: { recruiterSlug: string };
}) {
  const { recruiterSlug } = params;

  // get recruiter
  const { data: recruiter } = await supabaseAdmin
    .from("nata.recruiters")
    .select("*")
    .eq("slug", recruiterSlug)
    .single();

  if (!recruiter) {
    return (
      <main className="shell">
        <Nav />
        <div style={{ padding: 40 }}>Recruiter not found</div>
      </main>
    );
  }

  // get assigned candidates
  const { data: applications } = await supabaseAdmin
    .from("nata.applications")
    .select("*")
    .eq("recruiter_id", recruiter.id)
    .in("status", ["virtual_invited", "virtual_completed", "packet_ready"])
    .order("created_at", { ascending: true });

  return (
    <main className="shell">
      <Nav />

      <section style={{ padding: "60px 0" }}>
        <div style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto" }}>
          <div className="eyebrow">Recruiter Control Center</div>

          <h1 style={{ marginBottom: 12 }}>
            {recruiter.name} — Interview Pipeline
          </h1>

          <p style={{ color: "#cfe2ff", marginBottom: 40 }}>
            Conduct interviews, generate packets, and move candidates forward.
          </p>

          {/* INTERVIEW QUEUE */}
          <div className="section-kicker">Interview Queue</div>

          <div style={{ display: "grid", gap: 18 }}>
            {applications?.map((app) => (
              <div
                key={app.id}
                style={{
                  padding: 24,
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 20,
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {app.name}
                  </div>

                  <div style={{ color: "#9fb1cc", marginTop: 6 }}>
                    {app.role || "Candidate"} · {app.status}
                  </div>

                  <div style={{ color: "#cfe2ff", marginTop: 10 }}>
                    {app.decision_reason || "Ready for interview"}
                  </div>
                </div>

                <a
                  href={`/recruiter/${recruiterSlug}/interviews/${app.id}`}
                  className="btn btn-primary"
                >
                  Open studio
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
