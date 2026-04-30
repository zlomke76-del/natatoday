import Link from "next/link";
import Nav from "../components/Nav";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

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
  publish_mode: string | null;
  public_dealer_name: string | null;
  public_location: string | null;
  confidential_note: string | null;
  published_by: string | null;
  publish_status: string | null;
};

function getDealerName(job: Job) {
  if (job.publish_mode === "confidential") {
    return "Confidential Dealership";
  }

  return job.public_dealer_name || "Jersey Village Chrysler Jeep Dodge Ram";
}

function getDisplayLocation(job: Job) {
  if (job.publish_mode === "confidential") {
    return job.public_location || "Houston, TX Market";
  }

  return job.public_location || job.location || "Dealership location";
}

async function getJobs(): Promise<Job[]> {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      "id,title,slug,location,type,salary,description,requirements,dealer_slug,created_at,publish_mode,public_dealer_name,public_location,confidential_note,published_by,publish_status"
    )
    .eq("is_active", true)
    .eq("publish_status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load published dealership jobs:", error);
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
        <div className="eyebrow">Dealership Careers</div>

        <h1>Open dealership roles published by Solace.</h1>

        <p className="lede">
          These are active hiring requests published by Solace on behalf of
          dealership partners. Some dealerships are listed publicly. Others are
          handled confidentially when discretion is required.
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
                Open dealership roles will appear here when active requests are
                published.
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const isConfidential = job.publish_mode === "confidential";
              const dealerName = getDealerName(job);
              const displayLocation = getDisplayLocation(job);

              return (
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
                    <div style={{ maxWidth: 780 }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            padding: "7px 10px",
                            borderRadius: 999,
                            background: isConfidential
                              ? "rgba(251,191,36,0.14)"
                              : "rgba(20,115,255,0.14)",
                            border: isConfidential
                              ? "1px solid rgba(251,191,36,0.28)"
                              : "1px solid rgba(20,115,255,0.24)",
                            color: isConfidential ? "#fbbf24" : "#d7e8ff",
                            fontSize: 12,
                            fontWeight: 950,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          {isConfidential
                            ? "Confidential search"
                            : "Public dealership role"}
                        </span>

                        <span style={{ color: "#9fb4d6", fontSize: 13 }}>
                          Published by {job.published_by || "Solace"}
                        </span>
                      </div>

                      <h2 style={{ margin: 0 }}>{job.title}</h2>

                      <p style={{ margin: "10px 0 0", color: "#cfe2ff" }}>
                        {dealerName} · {displayLocation}
                        {job.type ? ` · ${job.type}` : ""}
                      </p>

                      {job.description ? (
                        <p
                          style={{
                            margin: "14px 0 0",
                            color: "#9fb4d6",
                            lineHeight: 1.6,
                          }}
                        >
                          {job.description}
                        </p>
                      ) : null}

                      {isConfidential ? (
                        <p
                          style={{
                            margin: "14px 0 0",
                            color: "#f8d98b",
                            lineHeight: 1.6,
                          }}
                        >
                          {job.confidential_note ||
                            "This role is being handled confidentially on behalf of a dealership. Candidate information is reviewed before any dealership handoff."}
                        </p>
                      ) : null}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 12,
                        justifyItems: "end",
                      }}
                    >
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

                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: 42,
                          padding: "0 18px",
                          borderRadius: 999,
                          background: "linear-gradient(135deg, #1473ff, #0757c9)",
                          color: "#fff",
                          fontWeight: 900,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Apply for this role
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
