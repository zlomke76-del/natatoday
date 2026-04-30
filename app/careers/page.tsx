import Link from "next/link";
import Nav from "../components/Nav";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Job = {
  id: string;
  title: string | null;
  slug: string | null;
  location: string | null;
  type: string | null;
  salary: string | null;
  description: string | null;
  requirements: string | null;
  dealer_slug: string | null;
  created_at: string | null;
};

async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      "id,title,slug,location,type,salary,description,requirements,dealer_slug,created_at"
    )
    .eq("dealer_slug", "jersey-village-cdjr")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load JV careers jobs:", error);
    return [];
  }

  return data || [];
}

export default async function CareersPage() {
  const jobs = await getJobs();

  return (
    <main className="shell">
      <Nav />

      <section
        style={{
          width: "min(1180px, calc(100% - 40px))",
          margin: "0 auto",
          padding: "72px 0 96px",
        }}
      >
        <div className="eyebrow">Careers</div>

        <h1>Build the next dealership workforce.</h1>

        <p className="lede">
          Open roles for Jersey Village Chrysler Jeep Dodge Ram are posted here
          as active hiring requests move into the recruiting pipeline.
        </p>

        <div style={{ display: "grid", gap: 18, marginTop: 40 }}>
          {jobs.length === 0 ? (
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 28,
                padding: 28,
                background: "rgba(255,255,255,0.06)",
              }}
            >
              <h2 style={{ margin: 0 }}>No open roles yet.</h2>
              <p style={{ color: "#cfe2ff", lineHeight: 1.6 }}>
                Check back soon. Open dealership roles will appear here when
                active requests are published.
              </p>
            </div>
          ) : (
            jobs.map((job) => (
              <Link
                key={job.id}
                href={`/careers/${job.slug}`}
                style={{
                  display: "block",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 28,
                  padding: 28,
                  background: "rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 18,
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0 }}>{job.title}</h2>

                    <p style={{ margin: "10px 0 0", color: "#cfe2ff" }}>
                      {job.location}
                      {job.type ? ` · ${job.type}` : ""}
                    </p>

                    {job.description ? (
                      <p
                        style={{
                          margin: "14px 0 0",
                          color: "#9fb4d6",
                          lineHeight: 1.6,
                          maxWidth: 760,
                        }}
                      >
                        {job.description}
                      </p>
                    ) : null}
                  </div>

                  {job.salary ? (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 999,
                        background: "rgba(20,115,255,0.14)",
                        border: "1px solid rgba(20,115,255,0.24)",
                        color: "#d7e8ff",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.salary}
                    </div>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
