import Image from "next/image";
import Link from "next/link";
import Nav from "../components/Nav";

type CandidateProfile = {
  slug: string;
  name: string;
  initials: string;
  image: string;
  eyebrow: string;
  title: string;
  summary: string;
  badges: string[];
  readiness: string[][];
  training: string[][];
  roleProfile: string[][];
  dealerAction: string;
  primaryCta: string;
  hotButton?: string;
};

const profiles: CandidateProfile[] = [
  {
    slug: "derrick-hayes",
    name: "Derrick Hayes",
    initials: "DH",
    image: "/images/derrick_hayes_01.png",
    eyebrow: "Technician readiness profile",
    title: "Master-certified technician ready for the service manager",
    summary:
      "Service Technician candidate · Houston market · ASE Master · CDJR Level 3 · pre-screened, reviewed, and ready for an in-person dealership interview.",
    badges: ["ASE Master", "CDJR Level 3", "Hard-to-Find Talent", "Thursday · 9:00 AM"],
    readiness: [
      ["Status", "Interview Ready"],
      ["Role fit", "Service Technician"],
      ["Certification", "ASE Master · CDJR Level 3"],
      ["Availability", "Two weeks"],
    ],
    training: [
      ["NATA pre-screen", "Complete"],
      ["Technical experience review", "Complete"],
      ["Certification level", "Visible in candidate record"],
      ["In-person coordination", "Thursday · 9:00 AM"],
    ],
    roleProfile: [
      ["Primary skill", "Diagnostics + drivability"],
      ["Shop experience", "8 years"],
      ["Tool readiness", "Owns core tool set"],
      ["Preferred lane", "Main shop / used-car recon"],
    ],
    dealerAction:
      "Derrick arrives as a technician candidate with certification level, service fit, and interview timing already prepared for the service manager. This is the kind of hard-to-find profile dealers care about most.",
    primaryCta: "Confirm technician interview",
    hotButton: "Fills a high-value service bay faster.",
  },
  {
    slug: "maria-lopez",
    name: "Maria Lopez",
    initials: "ML",
    image: "/images/maria_lopez_01.png",
    eyebrow: "Sales readiness profile",
    title: "Ready for the sales manager",
    summary:
      "Sales Consultant candidate · customer-facing experience · showroom-ready communication · pre-screened and ready for an in-person interview.",
    badges: ["Showroom Ready", "Customer-facing", "Interview Ready", "Thursday · 10:30 AM"],
    readiness: [
      ["Status", "Interview Ready"],
      ["Role fit", "Sales Consultant"],
      ["Certification", "NATA showroom ready"],
      ["Availability", "Immediate"],
    ],
    training: [
      ["NATA pre-screen", "Complete"],
      ["Communication review", "Complete"],
      ["Role alignment", "Sales floor"],
      ["In-person coordination", "Thursday · 10:30 AM"],
    ],
    roleProfile: [
      ["Primary skill", "Customer rapport"],
      ["Experience", "Retail sales + follow-up"],
      ["CRM readiness", "Strong"],
      ["Best fit", "New/used sales floor"],
    ],
    dealerAction:
      "Maria arrives with sales fit, communication notes, and interview timing already prepared for the sales manager.",
    primaryCta: "Confirm sales interview",
  },
  {
    slug: "ethan-brooks",
    name: "Ethan Brooks",
    initials: "EB",
    image: "/images/ethan_brooks_01.png",
    eyebrow: "BDC readiness profile",
    title: "Final screen for the BDC manager",
    summary:
      "BDC Representative candidate · phone fit reviewed · follow-up discipline in progress · nearly ready for dealer interview coordination.",
    badges: ["Phone Screen Complete", "82% Ready", "CRM Discipline", "Scheduling now"],
    readiness: [
      ["Status", "Final Screen"],
      ["Role fit", "BDC Representative"],
      ["Certification", "Phone screen complete"],
      ["Availability", "One week"],
    ],
    training: [
      ["NATA pre-screen", "Complete"],
      ["Phone presence", "Complete"],
      ["Follow-up workflow", "In progress"],
      ["In-person coordination", "Scheduling now"],
    ],
    roleProfile: [
      ["Primary skill", "Phone follow-up"],
      ["Experience", "Customer support"],
      ["CRM readiness", "In progress"],
      ["Best fit", "Internet / BDC desk"],
    ],
    dealerAction:
      "Ethan is close to interview-ready, with remaining follow-up workflow readiness clearly visible before the dealer spends time.",
    primaryCta: "Review BDC readiness",
  },
  {
    slug: "jordan-miles",
    name: "Jordan Miles",
    initials: "JM",
    image: "/images/jordan_miles_01.png",
    eyebrow: "Service advisor readiness profile",
    title: "Service lane candidate in progress",
    summary:
      "Service Advisor candidate · lane communication reviewed · training still in progress · visible readiness before interview handoff.",
    badges: ["Pre-Screened", "Lane Readiness", "Advisor Track", "Training in progress"],
    readiness: [
      ["Status", "Pre-Screened"],
      ["Role fit", "Service Advisor"],
      ["Certification", "Lane readiness in progress"],
      ["Availability", "Two weeks"],
    ],
    training: [
      ["NATA pre-screen", "Complete"],
      ["Advisor communication", "Complete"],
      ["Objection handling", "In progress"],
      ["In-person coordination", "Pending completion"],
    ],
    roleProfile: [
      ["Primary skill", "Customer communication"],
      ["Experience", "Service lane support"],
      ["Write-up readiness", "Developing"],
      ["Best fit", "Express lane / advisor desk"],
    ],
    dealerAction:
      "Jordan is visible as a developing candidate, so the dealership knows what is ready and what still needs work before an interview.",
    primaryCta: "Review advisor progress",
  },
];

export default function CandidateDemoPage({
  searchParams,
}: {
  searchParams?: { profile?: string };
}) {
  const activeProfile =
    profiles.find((profile) => profile.slug === searchParams?.profile) ?? profiles[0];

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
                activeProfile.slug === "derrick-hayes"
                  ? "radial-gradient(circle at top right, rgba(251,191,36,0.22), transparent 36%), linear-gradient(145deg, rgba(20,115,255,0.14), rgba(255,255,255,0.04))"
                  : "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.035))",
              boxShadow: "0 28px 90px rgba(0,0,0,0.34)",
            }}
          >
            <div className="eyebrow">{activeProfile.eyebrow}</div>

            <h1
              style={{
                marginTop: 0,
                fontSize: "clamp(54px, 7vw, 92px)",
                lineHeight: 0.92,
              }}
            >
              {activeProfile.name}
            </h1>

            <p className="lede" style={{ maxWidth: 760 }}>
              {activeProfile.summary}
            </p>

            {activeProfile.hotButton ? (
              <p
                style={{
                  marginTop: 18,
                  maxWidth: 680,
                  color: "#ffffff",
                  fontSize: 20,
                  fontWeight: 900,
                  lineHeight: 1.35,
                }}
              >
                {activeProfile.hotButton}
              </p>
            ) : null}

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginTop: 28,
              }}
            >
              {activeProfile.badges.map((badge) => (
                <span className="trust-pill" key={badge}>
                  {badge}
                </span>
              ))}
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
            <CandidateAvatar candidate={activeProfile} size={124} />

            <h2 style={{ margin: "26px 0 10px", fontSize: 30, lineHeight: 1.05 }}>
              {activeProfile.title}
            </h2>

            <p style={{ margin: 0, color: "#bfd6f5", lineHeight: 1.6 }}>
              NATA organizes the role-specific context before the dealer invests manager time.
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
          <InfoPanel title="Readiness summary" items={activeProfile.readiness} />
          <InfoPanel title="NATA work completed" items={activeProfile.training} />
          <InfoPanel title="Role profile" items={activeProfile.roleProfile} />
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

          <p style={{ maxWidth: 880, color: "#cfe2ff", lineHeight: 1.65 }}>
            {activeProfile.dealerAction}
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="#">
              {activeProfile.primaryCta}
            </Link>

            <Link className="btn btn-secondary" href="/dealer-demo">
              Back to dealer view
            </Link>
          </div>
        </section>

        <section
          style={{
            marginTop: 18,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 30,
            padding: 30,
            background: "rgba(255,255,255,0.045)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 28 }}>Switch demo profile</h2>
          <p style={{ marginTop: 0, color: "#bfd6f5", lineHeight: 1.55 }}>
            Use these profiles to show the dealer how NATA surfaces different readiness signals by role. Derrick makes the technician certification value obvious; Ethan and Jordan show the broader pipeline.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {profiles.map((profile) => {
              const isActive = profile.slug === activeProfile.slug;

              return (
                <Link
                  href={`/candidate-demo?profile=${profile.slug}`}
                  key={profile.slug}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 16,
                    borderRadius: 22,
                    background: isActive ? "rgba(20,115,255,0.20)" : "rgba(255,255,255,0.06)",
                    border: isActive
                      ? "1px solid rgba(96,165,250,0.50)"
                      : "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <CandidateAvatar candidate={profile} size={54} />
                  <strong style={{ color: "#ffffff" }}>{profile.name}</strong>
                  <span style={{ color: "#bfd6f5", fontSize: 13 }}>
                    {profile.readiness[1]?.[1] ?? "Candidate"}
                  </span>
                  <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 900 }}>
                    {profile.readiness[2]?.[1] ?? "Readiness visible"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
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
        priority={size > 100}
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
