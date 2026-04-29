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

      <section className="candidate-demo-page">
        <div className="candidate-hero-grid">
          <section
            className={`candidate-hero-card ${
              activeProfile.slug === "derrick-hayes" ? "candidate-hero-card-tech" : ""
            }`}
          >
            <div className="eyebrow">{activeProfile.eyebrow}</div>

            <h1 className="candidate-title-name">{activeProfile.name}</h1>

            <p className="lede candidate-summary">{activeProfile.summary}</p>

            {activeProfile.hotButton ? (
              <p className="candidate-hot-button">{activeProfile.hotButton}</p>
            ) : null}

            <div className="candidate-badge-row">
              {activeProfile.badges.map((badge) => (
                <span className="trust-pill" key={badge}>
                  {badge}
                </span>
              ))}
            </div>
          </section>

          <aside className="candidate-side-card">
            <CandidateAvatar candidate={activeProfile} size={124} />

            <div className="candidate-side-copy">
              <h2>{activeProfile.title}</h2>

              <p>
                NATA organizes the role-specific context before the dealer invests manager time.
              </p>
            </div>
          </aside>
        </div>

        <div className="candidate-info-grid">
          <InfoPanel title="Readiness summary" items={activeProfile.readiness} />
          <InfoPanel title="NATA work completed" items={activeProfile.training} />
          <InfoPanel title="Role profile" items={activeProfile.roleProfile} />
        </div>

        <section className="candidate-section-card dealer-action-card">
          <h2>Dealer action</h2>

          <p>{activeProfile.dealerAction}</p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="#">
              {activeProfile.primaryCta}
            </Link>

            <Link className="btn btn-secondary" href="/dealer-demo">
              Back to dealer view
            </Link>
          </div>
        </section>

        <section className="candidate-section-card profile-switch-section">
          <h2>Switch demo profile</h2>
          <p>
            Compare candidates by role, readiness, certification, and dealer value before anyone spends manager time.
          </p>

          <div className="profile-switch-grid">
            {profiles.map((profile) => {
              const isActive = profile.slug === activeProfile.slug;

              return (
                <Link
                  href={`/candidate-demo?profile=${profile.slug}`}
                  key={profile.slug}
                  className={`profile-switch-card ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <CandidateAvatar candidate={profile} size={54} />
                  <strong>{profile.name}</strong>
                  <span>{profile.readiness[1]?.[1] ?? "Candidate"}</span>
                  <b>{profile.readiness[2]?.[1] ?? "Readiness visible"}</b>
                </Link>
              );
            })}
          </div>
        </section>
      </section>

      <style>{`
        .candidate-demo-page {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 54px 0 90px;
        }

        .candidate-hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
          gap: 22px;
          align-items: stretch;
        }

        .candidate-hero-card {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 34px;
          padding: 38px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.035));
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.34);
        }

        .candidate-hero-card-tech {
          background: radial-gradient(circle at top right, rgba(251, 191, 36, 0.22), transparent 36%), linear-gradient(145deg, rgba(20, 115, 255, 0.14), rgba(255, 255, 255, 0.04));
        }

        .candidate-title-name {
          margin-top: 0;
          font-size: clamp(54px, 7vw, 92px);
          line-height: 0.92;
        }

        .candidate-summary {
          max-width: 760px;
        }

        .candidate-hot-button {
          margin-top: 18px;
          max-width: 680px;
          color: #ffffff;
          font-size: 20px;
          font-weight: 900;
          line-height: 1.35;
        }

        .candidate-badge-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 28px;
        }

        .candidate-side-card {
          border: 1px solid rgba(251, 191, 36, 0.32);
          border-radius: 34px;
          padding: 34px;
          background: radial-gradient(circle at top right, rgba(251, 191, 36, 0.22), transparent 36%), rgba(255, 255, 255, 0.06);
          box-shadow: 0 28px 90px rgba(0, 0, 0, 0.32);
        }

        .candidate-side-copy h2 {
          margin: 26px 0 10px;
          font-size: 30px;
          line-height: 1.05;
        }

        .candidate-side-copy p {
          margin: 0;
          color: #bfd6f5;
          line-height: 1.6;
        }

        .candidate-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          margin-top: 18px;
        }

        .candidate-info-panel {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 30px;
          padding: 28px;
          background: rgba(255, 255, 255, 0.055);
        }

        .candidate-info-panel h2 {
          margin: 0 0 18px;
          font-size: 26px;
        }

        .candidate-info-list {
          display: grid;
          gap: 12px;
        }

        .candidate-info-row {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.09);
        }

        .candidate-info-row span {
          color: #bfd6f5;
        }

        .candidate-info-row strong {
          color: #ffffff;
          text-align: right;
        }

        .candidate-section-card {
          margin-top: 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 30px;
          padding: 30px;
          background: rgba(255, 255, 255, 0.055);
        }

        .dealer-action-card h2,
        .profile-switch-section h2 {
          margin: 0 0 8px;
          font-size: 28px;
        }

        .dealer-action-card p {
          max-width: 880px;
          color: #cfe2ff;
          line-height: 1.65;
        }

        .profile-switch-section {
          background: rgba(255, 255, 255, 0.045);
        }

        .profile-switch-section p {
          max-width: 780px;
          margin-top: 0;
          color: #bfd6f5;
          line-height: 1.55;
        }

        .profile-switch-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .profile-switch-card {
          display: grid;
          gap: 10px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.10);
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
        }

        .profile-switch-card:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(96, 165, 250, 0.42);
        }

        .profile-switch-card.active {
          background: rgba(20, 115, 255, 0.20);
          border-color: rgba(96, 165, 250, 0.50);
        }

        .profile-switch-card strong {
          color: #ffffff;
        }

        .profile-switch-card span {
          color: #bfd6f5;
          font-size: 13px;
        }

        .profile-switch-card b {
          color: #fbbf24;
          font-size: 12px;
          font-weight: 900;
        }

        .candidate-avatar {
          display: block;
          object-fit: cover;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32);
        }

        .candidate-initials {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1473ff, #0f172a);
          color: #ffffff;
          font-weight: 950;
          border: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.32);
        }

        @media (max-width: 980px) {
          .candidate-demo-page {
            width: min(100% - 32px, 1180px);
            padding: 38px 0 70px;
          }

          .candidate-hero-grid,
          .candidate-info-grid,
          .profile-switch-grid {
            grid-template-columns: 1fr;
          }

          .candidate-hero-card,
          .candidate-side-card,
          .candidate-info-panel,
          .candidate-section-card {
            border-radius: 26px;
            padding: 24px;
          }

          .candidate-title-name {
            font-size: clamp(44px, 14vw, 64px);
            line-height: 0.95;
            letter-spacing: -0.055em;
          }

          .candidate-side-card {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 18px;
            align-items: center;
          }

          .candidate-side-copy h2 {
            margin: 0 0 8px;
            font-size: 24px;
          }

          .candidate-side-copy p {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 680px) {
          .candidate-demo-page {
            width: min(100% - 28px, 1180px);
            padding: 28px 0 56px;
          }

          .candidate-hero-card,
          .candidate-side-card,
          .candidate-info-panel,
          .candidate-section-card {
            border-radius: 22px;
            padding: 20px;
          }

          .candidate-badge-row .trust-pill {
            width: 100%;
            justify-content: center;
          }

          .candidate-side-card {
            grid-template-columns: 1fr;
          }

          .candidate-info-row {
            display: grid;
            gap: 6px;
          }

          .candidate-info-row strong {
            text-align: left;
          }

          .profile-switch-card {
            grid-template-columns: auto 1fr;
            align-items: center;
          }

          .profile-switch-card span,
          .profile-switch-card b {
            grid-column: 2;
          }
        }
      `}</style>
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
  const radius = Math.round(size * 0.24);

  if (candidate.image) {
    return (
      <Image
        src={candidate.image}
        alt={candidate.name}
        width={size}
        height={size}
        className="candidate-avatar"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
        }}
        priority={size > 100}
      />
    );
  }

  return (
    <div
      aria-label={`${candidate.name} initials`}
      className="candidate-initials"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        fontSize: Math.round(size * 0.34),
      }}
    >
      {candidate.initials}
    </div>
  );
}

function InfoPanel({ title, items }: { title: string; items: string[][] }) {
  return (
    <section className="candidate-info-panel">
      <h2>{title}</h2>

      <div className="candidate-info-list">
        {items.map(([label, value]) => (
          <div className="candidate-info-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
