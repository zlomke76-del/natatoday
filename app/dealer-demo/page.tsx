import Image from "next/image";
import Link from "next/link";
import Nav from "../components/Nav";

type Role = {
  title: string;
  count: number;
  priority: "Critical" | "High" | "Medium";
  detail: string;
};

type Candidate = {
  slug: string;
  name: string;
  initials: string;
  role: string;
  status: string;
  progress: number;
  badge: string;
  scheduled: string;
  certification: string;
  experience: string;
  image: string;
  highlight: string;
  dealerValue: string;
};

const roles: Role[] = [
  {
    title: "Service Technician",
    count: 5,
    priority: "Critical",
    detail: "ASE / OEM certification visible before interview",
  },
  {
    title: "Sales Consultant",
    count: 8,
    priority: "High",
    detail: "Showroom-ready candidates with communication notes",
  },
  {
    title: "BDC Representative",
    count: 5,
    priority: "Medium",
    detail: "Phone fit, follow-up discipline, and CRM readiness",
  },
  {
    title: "Service Advisor",
    count: 3,
    priority: "High",
    detail: "Lane communication and customer handling signals",
  },
];

const candidates: Candidate[] = [
  {
    slug: "derrick-hayes",
    name: "Derrick Hayes",
    initials: "DH",
    role: "Service Technician",
    status: "Master Certified",
    progress: 100,
    badge: "#1473ff",
    scheduled: "Thursday · 9:00 AM",
    certification: "ASE Master · CDJR Level 3",
    experience: "8 years · diagnostics + drivability",
    image: "/images/derrick_hayes_01.png",
    highlight: "Hard-to-find technician talent",
    dealerValue: "Certification, shop fit, and interview timing are already organized for the service manager.",
  },
  {
    slug: "maria-lopez",
    name: "Maria Lopez",
    initials: "ML",
    role: "Sales Consultant",
    status: "Interview Ready",
    progress: 100,
    badge: "#22c55e",
    scheduled: "Thursday · 10:30 AM",
    certification: "NATA showroom ready",
    experience: "Retail sales · customer rapport",
    image: "/images/maria_lopez_01.png",
    highlight: "Sales candidate ready",
    dealerValue: "Communication fit and showroom readiness are clear before the sales manager meets her.",
  },
  {
    slug: "ethan-brooks",
    name: "Ethan Brooks",
    initials: "EB",
    role: "BDC Representative",
    status: "Final Screen",
    progress: 82,
    badge: "#fbbf24",
    scheduled: "Scheduling now",
    certification: "Phone screen complete",
    experience: "Customer support · CRM follow-up",
    image: "/images/ethan_brooks_01.png",
    highlight: "BDC candidate in final screen",
    dealerValue: "Phone presence and follow-up discipline are visible before the BDC manager spends time.",
  },
  {
    slug: "jordan-miles",
    name: "Jordan Miles",
    initials: "JM",
    role: "Service Advisor",
    status: "Pre-Screened",
    progress: 56,
    badge: "#60a5fa",
    scheduled: "Needs training completion",
    certification: "Lane readiness in progress",
    experience: "Service lane support · customer communication",
    image: "/images/jordan_miles_01.png",
    highlight: "Advisor candidate in progress",
    dealerValue: "The dealer can see what is ready and what still needs work before committing interview time.",
  },
];

const friction = [
  {
    title: "We pre-screen before your managers spend time",
    copy: "NATA reviews communication, role fit, availability, certification level, and dealership readiness before candidates reach the store.",
  },
  {
    title: "Technician quality is visible",
    copy: "Service candidates can be sorted by ASE/OEM certification, experience, tool readiness, preferred lane, and shop fit.",
  },
  {
    title: "We make the handoff easy",
    copy: "Your dealership receives qualified candidates with context and interview timing already coordinated. You focus on the hire.",
  },
];

export default function DealerDemoPage() {
  const featuredCandidate = candidates[0];

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
              Stop sorting applicants. Start meeting the right ones.
            </h1>

            <p className="lede" style={{ maxWidth: 720 }}>
              NATA pre-screens, interviews, trains, and organizes candidates before they reach your dealership. For technicians, certification level and service readiness are surfaced up front so your team is not guessing who can actually help the shop.
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
                marginTop: 26,
              }}
            >
              <span className="trust-pill">Technician pipeline</span>
              <span className="trust-pill">ASE / OEM level visible</span>
              <span className="trust-pill">Multiple candidate profiles</span>
              <span className="trust-pill">Interviews arranged for you</span>
            </div>

            <div className="hero-actions">
              <Link href="/candidate-demo?profile=derrick-hayes" className="btn btn-primary">
                View technician profile
              </Link>

              <Link href="/candidate-demo?profile=ethan-brooks" className="btn btn-secondary">
                Switch demo profile
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
                background: "rgba(239,68,68,0.18)",
                color: "#fca5a5",
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              {featuredCandidate.highlight}
            </div>

            <div style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 24 }}>
              <CandidateAvatar candidate={featuredCandidate} size={92} />
              <div>
                <h2 style={{ margin: "0 0 8px", fontSize: 34, lineHeight: 1 }}>
                  {featuredCandidate.name}
                </h2>
                <p style={{ margin: 0, color: "#fbbf24", fontWeight: 900 }}>
                  {featuredCandidate.certification}
                </p>
              </div>
            </div>

            <p style={{ color: "#bfd6f5", lineHeight: 1.6, margin: "22px 0 0" }}>
              Technician hiring is one of the dealership’s hardest pressure points. This view makes certification, shop fit, and readiness obvious before the service manager gives up time.
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
              {[
                ["Candidate", featuredCandidate.name],
                ["Role", featuredCandidate.role],
                ["Certification", featuredCandidate.certification],
                ["Experience", featuredCandidate.experience],
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
                  <strong style={{ textAlign: "right" }}>{value}</strong>
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
          <Metric value="5" label="technician candidates" />
          <Metric value="3" label="certification levels" />
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
              Where candidates are being matched
            </h2>
            <p style={{ color: "#bfd6f5", lineHeight: 1.55, marginTop: 0 }}>
              NATA aligns screened candidates to the roles your dealership needs, with technician certification called out where it matters most.
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
                      {role.count} candidates matched · {role.detail}
                    </span>
                  </div>

                  <span
                    style={{
                      borderRadius: 999,
                      padding: "8px 12px",
                      background:
                        role.priority === "Critical"
                          ? "rgba(239,68,68,0.18)"
                          : role.priority === "High"
                            ? "rgba(251,191,36,0.18)"
                            : "rgba(96,165,250,0.16)",
                      color:
                        role.priority === "Critical"
                          ? "#fca5a5"
                          : role.priority === "High"
                            ? "#fbbf24"
                            : "#93c5fd",
                      fontSize: 12,
                      fontWeight: 900,
                      whiteSpace: "nowrap",
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
              Demo candidate profiles
            </h2>
            <p style={{ color: "#bfd6f5", lineHeight: 1.55, marginTop: 0 }}>
              Click into different profiles to show the dealer how readiness changes by role. Technician certification stays front and center where it matters.
            </p>

            <div style={{ display: "grid", gap: 12 }}>
              {candidates.map((candidate) => (
                <article
                  key={candidate.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 16,
                    alignItems: "center",
                    padding: 18,
                    borderRadius: 22,
                    background:
                      candidate.slug === "derrick-hayes"
                        ? "linear-gradient(135deg, rgba(20,115,255,0.18), rgba(255,255,255,0.075))"
                        : "rgba(255,255,255,0.075)",
                    border:
                      candidate.slug === "derrick-hayes"
                        ? "1px solid rgba(96,165,250,0.45)"
                        : "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <CandidateAvatar candidate={candidate} size={58} />

                  <div>
                    <h3 style={{ margin: 0, fontSize: 20 }}>
                      {candidate.name}
                    </h3>

                    <p style={{ margin: "5px 0 6px", color: "#bfd6f5" }}>
                      {candidate.role} · {candidate.certification}
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

                  <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
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

                    <Link
                      href={`/candidate-demo?profile=${candidate.slug}`}
                      style={{
                        color: "#ffffff",
                        fontSize: 13,
                        fontWeight: 900,
                        textDecoration: "underline",
                        textUnderlineOffset: 4,
                      }}
                    >
                      View profile
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function CandidateAvatar({
  candidate,
  size,
}: {
  candidate: { name: string; initials: string; image: string };
  size: number;
}) {
  if (candidate.image) {
    return (
      <Image
        src={candidate.image}
        alt={candidate.name}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.24),
          objectFit: "cover",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.32)",
        }}
        priority={size > 80}
      />
    );
  }

  return (
    <div
      aria-label={`${candidate.name} initials`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1473ff, #0f172a)",
        color: "#ffffff",
        fontSize: Math.round(size * 0.34),
        fontWeight: 950,
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.32)",
      }}
    >
      {candidate.initials}
    </div>
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
