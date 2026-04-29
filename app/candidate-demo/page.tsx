import Link from "next/link";
import Nav from "../components/Nav";

const readiness = [
  ["Status", "Certified Ready"],
  ["Role fit", "Sales Consultant"],
  ["Communication", "Strong"],
  ["Availability", "Immediate"],
];

const training = [
  ["Meet & greet", "Complete"],
  ["Needs discovery", "Complete"],
  ["Vehicle walkaround", "Complete"],
  ["Follow-up discipline", "Complete"],
];

export default function CandidateDemoPage() {
  return (
    <main className="shell">
      <Nav />

      <section
        style={{
          width: "min(1180px, calc(100% - 40px))",
          margin: "0 auto",
          padding: "54px 0 90px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 34,
              padding: 38,
              background:
                "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.035))",
              boxShadow: "0 28px 90px rgba(0,0,0,0.34)",
            }}
          >
            <div className="eyebrow">Candidate readiness profile</div>

            <h1
              style={{
                marginTop: 0,
                fontSize: "clamp(54px, 7vw, 92px)",
                lineHeight: 0.92,
              }}
            >
              Maria Lopez
            </h1>

            <p className="lede" style={{ maxWidth: 680 }}>
              Sales Consultant candidate · Houston market · interview-ready
              after completing NATA showroom readiness modules.
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 28,
              }}
            >
              <span className="trust-pill">Certified Ready</span>
              <span className="trust-pill">Houston market</span>
              <span className="trust-pill">Immediate availability</span>
            </div>
          </section>

          <aside
            style={{
              border: "1px solid rgba(251,191,36,0.32)",
              borderRadius: 34,
              padding: 34,
              background:
                "radial-gradient(circle at top right, rgba(251,191,36,0.22), transparent 36%), rgba(255,255,255,0.06)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.32)",
            }}
          >
            <div
              style={{
                width: 96,
                height: 96,
                borderRadius: 28,
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #1473ff, #fbbf24)",
                color: "#fff",
                fontSize: 34,
                fontWeight: 900,
                boxShadow: "0 18px 48px rgba(20,115,255,0.34)",
              }}
            >
              ML
            </div>

            <h2 style={{ margin: "26px 0 10px", fontSize: 30 }}>
              Dealer-ready candidate
            </h2>

            <p style={{ margin: 0, color: "#bfd6f5", lineHeight: 1.6 }}>
              Clear profile, visible readiness, and direct dealer action in one
              clean view.
            </p>
          </aside>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            marginTop: 18,
          }}
        >
          <InfoPanel title="Readiness summary" items={readiness} />
          <InfoPanel title="Training progress" items={training} />
        </div>

        <section
          style={{
            marginTop: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 30,
            padding: 30,
            background: "rgba(255,255,255,0.055)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 28 }}>Dealer action</h2>

          <p style={{ maxWidth: 760, color: "#cfe2ff", lineHeight: 1.65 }}>
            Maria is presented as a realistic V1 demo candidate: screened,
            trained, and ready for a dealership interview. The dealer gets a
            clean decision view instead of another loose applicant record.
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="#">
              Request interview
            </Link>

            <Link className="btn btn-secondary" href="/dealer-demo">
              Back to dashboard
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}

function InfoPanel({
  title,
  items,
}: {
  title: string;
  items: string[][];
}) {
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 30,
        padding: 28,
        background: "rgba(255,255,255,0.055)",
      }}
    >
      <h2 style={{ margin: "0 0 18px", fontSize: 26 }}>{title}</h2>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              padding: "14px 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <span style={{ color: "#bfd6f5" }}>{label}</span>
            <strong style={{ color: "#fff" }}>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
