import Link from "next/link";
import Nav from "./components/Nav";

const roles = [
  "Sales Consultant",
  "BDC Representative",
  "Service Advisor",
  "Parts Advisor",
  "Service Technician",
  "Master Certified Tech",
];

const steps = [
  {
    number: "01",
    title: "Candidates come in",
    copy: "Applicants, referrals, walk-ins, technician leads, and campaigns feed into one organized pipeline instead of scattered inboxes.",
  },
  {
    number: "02",
    title: "We filter and qualify",
    copy: "We review fit, communication, availability, certification level, and role readiness before your managers spend time.",
  },
  {
    number: "03",
    title: "Readiness becomes clear",
    copy: "Training progress, interview readiness, service experience, and certification signals are visible before handoff.",
  },
  {
    number: "04",
    title: "You meet prepared candidates",
    copy: "Your team gets a clean shortlist with context — not a pile of unknown applicants or unqualified technician leads.",
  },
];

const proofCards = [
  {
    title: "Technician pipeline support",
    copy: "Hard-to-find service talent is organized by experience, certification level, availability, and fit before your store invests manager time.",
  },
  {
    title: "Less manager time wasted",
    copy: "Your team is not chasing every applicant or guessing who is serious. They focus on candidates worth meeting.",
  },
  {
    title: "Interviews become decisions",
    copy: "The interview is no longer the first filter. It becomes the point where your dealership confirms the right fit.",
  },
];

const metrics = [
  { value: "24", label: "candidates in pipeline" },
  { value: "8", label: "ready for interview" },
  { value: "5", label: "technician candidates tracked" },
  { value: "3", label: "certification levels visible" },
];

export default function Home() {
  const imageMap: Record<string, string> = {
    "01": "/images/manager_01.png",
    "02": "/images/salesperson_01.png",
    "03": "/images/technician_01.png",
    "04": "/images/salespeople_01.png",
  };

  return (
    <main className="shell">
      <Nav />

      <section className="hero hero-bg">
        <div className="hero-overlay" />

        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">Automotive recruiting + training</div>

            <h1>
              Stop sorting through applicants.{" "}
              <span className="accent">Start meeting the right ones.</span>
            </h1>

            <p className="lede">
              NATA Today helps dealerships recruit, screen, and prepare harder-to-find talent — from sales and BDC to service advisors and technicians — before your managers spend time chasing applicants.
            </p>

            <div className="hero-actions">
              <Link className="btn btn-primary" href="/dealer-demo">
                View Dealer Demo
              </Link>
              <Link className="btn btn-secondary" href="/pricing">
                See Pricing
              </Link>
            </div>

            <div className="icon-row" aria-label="NATA Today workflow">
              <span>Recruit</span>
              <span>Screen</span>
              <span>Interview</span>
              <span>Certify</span>
              <span>Place</span>
            </div>
          </div>
        </div>
      </section>

      <section id="system" className="process-section">
        <div className="wrap">
          <div className="section-kicker">Where the work gets removed</div>

          <div className="process-hero">
            <h2>You don’t sort candidates. You meet the ones that matter.</h2>
            <p>
              The dealership still makes the hiring decision — but only after candidates have been reviewed, organized, and prepared. For technicians, that means certification level, service experience, availability, and readiness are visible before anyone burns time on the wrong conversation.
            </p>
          </div>

          <div className="role-strip" aria-label="Roles supported">
            {roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>

          <div className="process-grid">
            {steps.map((step) => (
              <article className="process-card" key={step.number}>
                
                {/* IMAGE HEADER */}
                <div className="process-image-wrap">
                  <img
                    src={imageMap[step.number]}
                    alt={step.title}
                    className="process-image"
                  />
                </div>

                <div className="step-number">{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="outcomes" className="outcome-section">
        <div className="wrap">
          <div className="outcome-heading">
            <div className="section-kicker dark">What changes for the dealer</div>
            <h2>A cleaner pipeline. Less noise. Better hires.</h2>
            <p>
              NATA Today does not add another tool to manage. It removes the work that slows hiring down — especially when the open role is a technician and every missed fit costs the service department real capacity.
            </p>
          </div>

          <div className="grid-3">
            {proofCards.map((card) => (
              <article className="card-light" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>

          <div className="metric-row">
            {metrics.map((metric) => (
              <div className="metric" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>

          <div className="closing-band">
            <div>
              <span>Dealer-ready recruiting</span>
              <h3>Stop starting from zero with every applicant.</h3>
              <p>
                Your team gets candidates who have already been organized, screened, prepared, and matched to the role — including technician certification level when that is what matters most.
              </p>
            </div>
            <Link className="btn btn-primary" href="/dealer-demo">
              See the Dealer View
            </Link>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">NATA Today · Powered by clarity</div>
      </footer>
    </main>
  );
}
