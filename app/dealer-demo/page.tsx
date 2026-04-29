import Link from "next/link";
import Nav from "../components/Nav";

const roles = [
  { title: "Sales Consultant", count: 8, priority: "High" },
  { title: "BDC Representative", count: 5, priority: "Medium" },
  { title: "Service Advisor", count: 3, priority: "High" },
];

const candidates = [
  {
    name: "Maria Lopez",
    role: "Sales Consultant",
    status: "Interview Ready",
    progress: 100,
    badge: "#22c55e",
    scheduled: "Thursday · 10:30 AM",
  },
  {
    name: "Ethan Brooks",
    role: "BDC Representative",
    status: "Final Screen",
    progress: 82,
    badge: "#fbbf24",
    scheduled: "Scheduling now",
  },
  {
    name: "Jordan Miles",
    role: "Service Advisor",
    status: "Pre-Screened",
    progress: 56,
    badge: "#60a5fa",
    scheduled: "Needs training completion",
  },
  {
    name: "Avery Coleman",
    role: "Sales Consultant",
    status: "Interview Set",
    progress: 100,
    badge: "#111827",
    scheduled: "Friday · 2:00 PM",
  },
];

const friction = [
  {
    title: "We pre-screen",
    copy: "Candidates are reviewed for communication, role fit, availability, and dealership readiness before they ever reach your store.",
  },
  {
    title: "We train",
    copy: "NATA candidates complete structured readiness modules so they arrive prepared for the showroom, BDC, or service lane.",
  },
  {
    title: "We arrange interviews",
    copy: "Your dealership receives qualified candidates with interview timing already coordinated. You focus on hiring, not chasing.",
  },
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
            gridTemplateColumns: "1.08fr 0.92fr",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.13)",
              borderRadius: 36,
              padding: 42,
              background:
                "radial-gradient(circle at top right, rgba(20,115,255,0.28), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.105), rgba(255,255,255,0.035))",
              boxShadow: "0 28px 90px rgba(0,0,0,0.35)",
            }}
          >
            <div className="eyebrow">Dealer demo</div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(52px, 5.9vw, 84px)",
                lineHeight: 0.94,
                maxWidth: 820,
              }}
            >
              We send you interview-ready candidates.
            </h1>

            <p className="lede" style={{ maxWidth: 710 }}>
              NATA pre-screens, interviews, trains, and qualifies candidates before
              they reach your dealership. You do not sort resumes. You meet people
              already prepared for an in-person interview.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 26,
              }}
            >
              <span className="trust-pill">No resume chasing</span>
              <span className="trust-pill">No cold applicant pile</span>
              <span className="trust-pill">Interviews arranged for you</span>
            </div>

            <div className="hero-actions">
              <Link href="/candidate-demo" className="btn btn-primary">
                View a ready candidate
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
                "radial-gradient(circle at top right, rgba(251,191,36,0.25), transparent 38%), rgba(255,255,255,0.06)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.32)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 38,
                padding: "0 14px",
                borderRadius: 999,
                background: "rgba(34,197,94,0.16)",
                color: "#86efac",
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              Next interview arriving
            </div>

            <h2 style={{ margin: "22px 0 8px", fontSize: 34, lineHeight: 1 }}>
              Thursday at 10:30 AM
            </h2>

            <p style={{ color: "#bfd6f5", lineHeight: 1.6, margin: 0 }}>
              Maria Lopez is already screened, trained, and ready to meet the
              dealership in person.
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
              {[
                ["Candidate", "Maria Lopez"],
                ["Role", "Sales Consultant"],
                ["Readiness", "Certified Ready"],
                ["Dealer action", "Meet candidate"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "15px 16px",
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <span style={{ color: "#bfd6f5" }}>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginTop: 18,
          }}
        >
          {friction.map((item) => (
            <section
              key={item.title}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 28,
                padding: 26,
                background: "rgba(255,255,255,0.055)",
                boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
              }}
            >
              <h3 style={{ margin: 0, fontSize: 24 }}>{item.title}</h3>
              <p style={{ color: "#bfd6f5", lineHeight: 1.62, marginBottom: 0 }}>
                {item.copy}
              </p>
            </section>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginTop: 18,
          }}
        >
          <Metric value="24" label="pre-screened candidates" />
          <Metric value="8" label="interview-ready now" />
          <Metric value="6" label="interviews arranged" />
          <Metric value="3" label="roles being filled" />
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
            <h2 style={{ margin: "0 0 8px", fontSize: 28 }}>
              Where we are sending candidates
            </h2>
            <p style={{ color: "#bfd6f5", lineHeight: 1.55, marginTop: 0 }}>
              NATA aligns screened candidates to the roles your dealership needs.
            </p>

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
            <h2 style={{ margin: "0 0 8px", fontSize: 28 }}>
              Interview-ready candidates
            </h2>
            <p style={{ color: "#bfd6f5", lineHeight: 1.55, marginTop: 0 }}>
              Every candidate below has already moved through NATA screening,
              readiness review, and interview coordination.
            </p>

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

                    <p style={{ margin: "5px 0 6px", color: "#bfd6f5" }}>
                      {candidate.role}
                    </p>

                    <p
                      style={{
                        margin: "0 0 12px",
                        color: "#fbbf24",
                        fontSize: 13,
                        fontWeight: 900,
                      }}
                    >
                      {candidate.scheduled}
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
                          background: "linear-gradient(90deg, #1473ff, #fbbf24)",
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
