import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type AnyRow = Record<string, any>;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function label(value: unknown, fallback = "Unassigned") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "Not scheduled";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Not scheduled";
  }
}

function getNextAction(app: AnyRow) {
  if (!app.virtual_interview_completed_at) return "Complete virtual interview";
  if (!app.interview_packet_ready) return "Generate packet";
  if (!app.dealer_interview_at) return "Schedule dealer interview";
  if (app.status === "dealer_interview_scheduled") return "Ready for dealer";
  return "Review candidate";
}

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
        <section
          style={{
            width: "min(1180px, calc(100% - 40px))",
            margin: "0 auto",
            padding: "60px 0",
          }}
        >
          <div className="eyebrow">Recruiter Control Center</div>
          <h1>Recruiter not found.</h1>
          <p style={{ color: "#cfe2ff" }}>
            This recruiter workspace does not exist or is inactive.
          </p>
        </section>
      </main>
    );
  }

  const { data: jobsData, error: jobsError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (jobsError) {
    console.error("Failed to load jobs:", jobsError);
  }

  const { data: applicationsData, error: applicationsError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("recruiter_id", recruiter.id)
    .order("created_at", { ascending: false });

  if (applicationsError) {
    console.error("Failed to load recruiter applications:", applicationsError);
  }

  const jobs = (jobsData || []) as AnyRow[];
  const applications = (applicationsData || []) as AnyRow[];

  const openJobs = jobs.filter(
    (job) =>
      job.is_active !== false &&
      !job.filled_at &&
      job.publish_status !== "closed" &&
      job.publish_status !== "filled"
  );

  const dealers = Array.from(
    new Set(
      openJobs.map((job) =>
        label(job.dealer_slug || job.public_dealer_name, "unknown-dealer")
      )
    )
  ).map((dealerSlug) => {
    const dealerJobs = openJobs.filter(
      (job) =>
        label(job.dealer_slug || job.public_dealer_name, "unknown-dealer") ===
        dealerSlug
    );

    const dealerJobIds = new Set(dealerJobs.map((job) => job.id));
    const dealerApps = applications.filter((app) => dealerJobIds.has(app.job_id));

    const readyForDealer = dealerApps.filter(
      (app) =>
        app.status === "dealer_interview_scheduled" &&
        app.dealer_interview_at &&
        app.interview_packet_ready
    );

    const needsInterview = dealerApps.filter(
      (app) => !app.virtual_interview_completed_at
    );

    const packetPending = dealerApps.filter(
      (app) => app.virtual_interview_completed_at && !app.interview_packet_ready
    );

    let priority = "Monitor";

    if (dealerJobs.length > 0 && readyForDealer.length === 0) {
      priority = "High";
    }

    if (dealerJobs.length > 0 && needsInterview.length > 0) {
      priority = "Action";
    }

    return {
      dealerSlug,
      dealerName: label(
        dealerJobs[0]?.public_dealer_name || dealerJobs[0]?.dealer_slug,
        dealerSlug
      ),
      openJobs: dealerJobs.length,
      pipeline: dealerApps.length,
      needsInterview: needsInterview.length,
      packetPending: packetPending.length,
      readyForDealer: readyForDealer.length,
      priority,
    };
  });

  const needsInterview = applications.filter(
    (app) => !app.virtual_interview_completed_at
  );

  const packetPending = applications.filter(
    (app) => app.virtual_interview_completed_at && !app.interview_packet_ready
  );

  const dealerScheduled = applications.filter(
    (app) =>
      app.status === "dealer_interview_scheduled" &&
      app.dealer_interview_at &&
      app.interview_packet_ready
  );

  const blocked = applications.filter(
    (app) =>
      app.status !== "dealer_interview_scheduled" &&
      (app.virtual_interview_completed_at || app.interview_packet_ready) &&
      (!app.dealer_interview_at || !app.interview_packet_ready)
  );

  return (
    <main className="shell">
      <Nav />

      <section
        style={{
          width: "min(1180px, calc(100% - 40px))",
          margin: "0 auto",
          padding: "60px 0",
        }}
      >
        <div className="eyebrow">Recruiter Control Center</div>

        <h1>{recruiter.name} — Operations Command Center</h1>

        <p style={{ color: "#cfe2ff", maxWidth: 820 }}>
          Daily visibility for dealer demand, open jobs, candidate movement,
          interviews, packet readiness, and dealer handoff status.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 14,
            marginTop: 34,
          }}
        >
          {[
            ["Active clients", dealers.length],
            ["Open jobs", openJobs.length],
            ["Assigned candidates", applications.length],
            ["Need interviews", needsInterview.length],
            ["Ready for dealer", dealerScheduled.length],
          ].map(([title, value]) => (
            <div
              key={String(title)}
              style={{
                padding: 20,
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ color: "#9fb1cc", fontSize: 13 }}>{title}</div>
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>
          Dealer Priority Board
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {dealers.length === 0 ? (
            <div
              style={{
                padding: 24,
                borderRadius: 20,
                background: "rgba(255,255,255,0.05)",
                color: "#cfe2ff",
              }}
            >
              No active dealer jobs are currently open.
            </div>
          ) : (
            dealers.map((dealer) => (
              <article
                key={dealer.dealerSlug}
                style={{
                  padding: 22,
                  borderRadius: 22,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  display: "grid",
                  gridTemplateColumns: "1.4fr repeat(5, .7fr)",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 21 }}>
                    {dealer.dealerName}
                  </h2>
                  <p style={{ margin: "6px 0 0", color: "#9fb1cc" }}>
                    {dealer.dealerSlug}
                  </p>
                </div>

                <strong>{dealer.openJobs}</strong>
                <strong>{dealer.pipeline}</strong>
                <strong>{dealer.needsInterview}</strong>
                <strong>{dealer.packetPending}</strong>

                <span
                  style={{
                    display: "inline-flex",
                    justifyContent: "center",
                    padding: "8px 12px",
                    borderRadius: 999,
                    background:
                      dealer.priority === "Action"
                        ? "#1473ff"
                        : "rgba(255,255,255,0.08)",
                    fontWeight: 900,
                  }}
                >
                  {dealer.priority}
                </span>
              </article>
            ))
          )}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>
          Today’s Work
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {[
            ["Interviews to complete", needsInterview.length],
            ["Packets pending", packetPending.length],
            ["Blocked handoffs", blocked.length],
          ].map(([title, value]) => (
            <div
              key={String(title)}
              style={{
                padding: 24,
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <div
                style={{
                  color: "#fbbf24",
                  fontWeight: 900,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: 42, fontWeight: 950, marginTop: 12 }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>
          Candidate Queue
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
            applications.map((application) => {
              const job = jobs.find((item) => item.id === application.job_id);
              const nextAction = getNextAction(application);

              return (
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
                      {application.name || application.email || "Candidate"}
                    </h2>

                    <p style={{ margin: "8px 0 0", color: "#cfe2ff" }}>
                      {label(job?.title || application.role, "Candidate")} ·{" "}
                      {label(
                        job?.public_dealer_name || job?.dealer_slug,
                        "Dealer pending"
                      )}
                    </p>

                    <p style={{ margin: "10px 0 0", color: "#9fb1cc" }}>
                      Status: {application.status || "new"} · Virtual:{" "}
                      {application.virtual_interview_status || "not_scheduled"} ·
                      Packet:{" "}
                      {application.interview_packet_ready ? "ready" : "not ready"} ·
                      Dealer: {formatDate(application.dealer_interview_at)}
                    </p>

                    <p
                      style={{
                        margin: "10px 0 0",
                        color: "#fbbf24",
                        fontWeight: 800,
                      }}
                    >
                      Next action: {nextAction}
                    </p>
                  </div>

                  <Link
                    href={`/recruiter/${recruiterSlug}/interviews/${application.id}`}
                    className="btn btn-primary"
                  >
                    Open studio
                  </Link>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
