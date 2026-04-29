import Link from "next/link";
import Nav from "../components/Nav";

const roles = [
  { title: "Sales Consultant", count: 8, priority: "High" },
  { title: "BDC Representative", count: 5, priority: "Medium" },
  { title: "Service Advisor", count: 3, priority: "High" },
];

const candidates = [
  { name: "Maria Lopez", role: "Sales Consultant", status: "Certified Ready", progress: 100, badge: "#22c55e" },
  { name: "Ethan Brooks", role: "BDC Representative", status: "Training 82%", progress: 82, badge: "#fbbf24" },
  { name: "Jordan Miles", role: "Service Advisor", status: "Screened", progress: 56, badge: "#60a5fa" },
  { name: "Avery Coleman", role: "Sales Consultant", status: "Interview Requested", progress: 100, badge: "#111827" },
];

export default function DealerDemoPage() {
  return (
    <main className="shell">
      <Nav />

      <section
        style={{
          width: "min(1180px, calc(100% - 40px))",
          margin: "0 auto",
          padding: "46px 0 90px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.13)",
              borderRadius: 36,
              padding: 40,
              background:
                "radial-gradient(circle at top right, rgba(20,115,255,0.24), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))",
              boxShadow: "0 28px 90px rgba(0,0,0,0.35)",
            }}
          >
            <div className="eyebrow">Dealer demo</div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(54px, 6vw, 86px)",
                lineHeight: 0.94,
              }}
            >
              NATA candidate command center
            </h1>

            <p className="lede" style={{ maxWidth: 680 }}>
              A dealership-facing dashboard for seeing who is trained, who is
              ready, and where every candidate stands.
            </p>

            <div className="hero-actions">
              <Link href="/candidate-demo" className="btn btn-primary">
                Open candidate profile
              </Link>

              <Link href="/" className="btn btn-secondary">
                Back to system
              </Link>
            </div>
          </section>

          <aside
            style={{
              border: "1px solid rgba(251,191,36,0.30)",
              borderRadius: 36,
              padding: 32,
              background:
                "radial-gradient(circle at top right, rgba(251,191,36,0.24), transparent 36%), rgba(255,255,255,0.06)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.32)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 30 }}>
              What the dealer sees
            </h2>

            <p style={{ color: "#bfd6f5", lineHeight: 1.6 }}>
              Instead of loose applications, the dealer gets organized candidate
              visibility with role fit, progress, readiness, and next action.
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 22 }}>
              {["Role demand", "Candidate readiness", "Training progress", "Interview action"].map(
                (item) => (
                  <div
                    key={item}
                    style={{
                      padding: "15px 16px",
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      fontWeight: 800,
                    }}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
          </aside>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginTop: 18,
          }}
        >
          <Metric value="24" label="active candidates" />
          <Metric value="8" label="certified ready" />
          <Metric value="6" label="interviews requested" />
          <Metric value="3" label="open roles" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.85fr 1.15fr",
            gap: 18,
            marginTop: 18,
          }}
        >
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 30,
              padding: 28,
              background: "rgba(255,255,255,0.055)",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 28 }}>Open roles</h2>

            <div style={{ display: "grid", gap: 12 }}>
              {roles.map((role) => (
                <div
                  key={role.title}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    alignItems: "center",
                    padding: "16px",
                    borderRadius: 20,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: 16 }}>
                      {role.title}
                    </strong>
                    <span style={{ color: "#bfd6f5", fontSize: 13 }}>
                      {role.count} candidates matched
                    </span>
                  </div>

                  <span
                    style={{
                      borderRadius: 999,
                      padding: "8px 12px",
                      background:
                        role.priority === "High"
                          ? "rgba(251,191,36,0.18)"
                          : "rgba(96,165,250,0.16)",
                      color: role.priority === "High" ? "#fbbf24" : "#93c5fd",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {role.priority}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 30,
              padding: 28,
              background: "rgba(255,255,255,0.055)",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: 28 }}>
              Candidate pipeline
            </h2>

            <div style={{ display: "grid", gap: 12 }}>
              {candidates.map((candidate) => (
                <article
                  key={candidate.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 18,
                    alignItems: "center",
                    padding: 18,
                    borderRadius: 22,
                    background: "rgba(255,255,255,0.075)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: 20 }}>
                      {candidate.name}
                    </h3>

                    <p
                      style={{
                        margin: "5px 0 12px",
                        color: "#bfd6f5",
                      }}
                    >
                      {candidate.role}
                    </p>

                    <div
                      style={{
                        height: 9,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.10)",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          display: "block",
                          width: `${candidate.progress}%`,
                          height: "100%",
                          borderRadius: 999,
                          background:
                            "linear-gradient(90deg, #1473ff, #fbbf24)",
                        }}
                      />
                    </div>
                  </div>

                  <span
                    style={{
                      borderRadius: 999,
                      padding: "9px 13px",
                      background: candidate.badge,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {candidate.status}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: 26,
        padding: "26px 18px",
        background: "#ffffff",
        color: "#0f172a",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
      }}
    >
      <strong
        style={{
          display: "block",
          fontSize: 42,
          lineHeight: 1,
          letterSpacing: "-0.06em",
        }}
      >
        {value}
      </strong>
      <span style={{ display: "block", marginTop: 10, color: "#526071" }}>
        {label}
      </span>
    </div>
  );
}
