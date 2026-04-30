import Link from "next/link";
import Nav from "../components/Nav";

async function getJobs() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const res = await fetch(`${appUrl}/api/nata/jobs`, {
    cache: "no-store"
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.jobs || [];
}

export default async function CareersPage() {
  const jobs = await getJobs();

  return (
    <main className="shell">
      <Nav />

      <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "72px 0 96px" }}>
        <div className="eyebrow">Careers</div>

        <h1>Build the next dealership workforce.</h1>

        <p className="lede">
          Join the team helping dealerships recruit, train, and place stronger candidates with structure,
          clarity, and measurable outcomes.
        </p>

        <div style={{ display: "grid", gap: 18, marginTop: 40 }}>
          {jobs.length === 0 ? (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 28,
                padding: 28,
                background: "rgba(255,255,255,0.06)"
              }}
            >
              <h2 style={{ margin: 0 }}>No open roles yet.</h2>
              <p style={{ color: "#cfe2ff", lineHeight: 1.6 }}>
                Check back soon. We are building the foundation now.
              </p>
            </div>
          ) : (
            jobs.map((job: any) => (
              <Link
                key={job.id}
                href={`/careers/${job.slug}`}
                style={{
                  display: "block",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 28,
                  padding: 28,
                  background: "rgba(255,255,255,0.06)"
                }}
              >
                <h2 style={{ margin: 0 }}>{job.title}</h2>
                <p style={{ margin: "10px 0 0", color: "#cfe2ff" }}>
                  {job.location} {job.type ? `· ${job.type}` : ""}
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
