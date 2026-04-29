import Link from "next/link";
import Nav from "../components/Nav";

const readiness = [
  ["Status", "Interview Ready"],
  ["Role fit", "Service Technician"],
  ["Certification", "ASE Master · CDJR Level 3"],
  ["Availability", "Two weeks"],
];

const training = [
  ["NATA pre-screen", "Complete"],
  ["Technical experience review", "Complete"],
  ["Certification level", "Verified by candidate record"],
  ["In-person coordination", "Thursday · 9:00 AM"],
];

const serviceProfile = [
  ["Primary skill", "Diagnostics + drivability"],
  ["Shop experience", "8 years"],
  ["Tool readiness", "Owns core tool set"],
  ["Preferred lane", "Main shop / used-car recon"],
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
            <div className="eyebrow">Technician readiness profile</div>

            <h1
              style={{
                marginTop: 0,
                fontSize: "clamp(54px, 7vw, 92px)",
                lineHeight: 0.92,
              }}
            >
              Derrick Hayes
            </h1>

            <p className="lede" style={{ maxWidth: 700 }}>
              Service Technician candidate · Houston market · ASE Master · CDJR Level 3 · pre-screened, reviewed, and ready for an in-person dealership interview.
            </p>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 28,
              }}
            >
              <span className="trust-pill">ASE Master</span>
              <span className="trust-pill">CDJR Level 3</span>
              <span className="trust-pill">Thursday · 9:00 AM</span>
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
                borderRadius: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #1473ff, #0f172a)",
                color: "#ffffff",
                fontSize: 34,
                fontWeight: 950,
                boxShadow: "0 18px 48px rgba(0,0,0,0.35)",
              }}
              aria-label="Derrick Hayes initials"
            >
              DH
            </div>

            <h2 style={{ margin: "26px 0 10px", fontSize: 30 }}>
              Ready for the service manager
            </h2>

            <p style={{ margin: 0, color: "#bfd6f5", lineHeight: 1.6 }}>
              NATA has already organized the technician-specific context: certification level, shop experience, availability, and where Derrick best fits.
            </p>
          </aside>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 18,
            marginTop: 18,
          }}
        >
          <InfoPanel title="Readiness summary" items={readiness} />
          <InfoPanel title="NATA process completed" items={training} />
          <InfoPanel title="Service profile" items={serviceProfile} />
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

          <p style={{ maxWidth: 840, color: "#cfe2ff", lineHeight: 1.65 }}>
            The dealership does not start by chasing or screening. Derrick arrives as a technician candidate with certification level, service fit, and interview timing already prepared for the service manager.
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="#">
              Confirm technician interview
            </Link>

            <Link className="btn btn-secondary" href="/dealer-demo">
              Back to dealer view
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}

function InfoPanel({ title, items }: { title: string; items: string[][] }) {
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
            <strong style={{ color: "#fff", textAlign: "right" }}>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
