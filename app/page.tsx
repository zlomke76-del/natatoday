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
    title: "Candidates enter one system",
    copy: "Applicants, referrals, walk-ins, technician leads, and campaigns are captured and structured into a single controlled pipeline — not scattered across inboxes.",
  },
  {
    number: "02",
    title: "Only qualified candidates move forward",
    copy: "Each candidate is reviewed, pre-screened, and evaluated for role fit, communication, availability, and certification level before your team ever sees them.",
  },
  {
    number: "03",
    title: "Readiness is established before the interview",
    copy: "Candidates arrive with visible readiness signals — training progress, service experience, certification level, and role alignment — before the conversation begins.",
  },
  {
    number: "04",
    title: "Managers meet candidates worth hiring",
    copy: "Your team is not filtering or guessing. They are confirming fit with candidates who have already been prepared for the role.",
  },
];

const proofCards = [
  {
    title: "Technician pipeline control",
    copy: "Hard-to-find service talent is organized by certification level, experience, availability, and role fit before your store invests time.",
  },
  {
    title: "Manager time protected",
    copy: "Your team is not chasing applicants or sorting through noise. They focus only on candidates who have earned the interview.",
  },
  {
    title: "Interviews become decisions",
    copy: "The interview is no longer the first filter. It becomes the moment your dealership confirms the right hire.",
  },
];

const metrics = [
  { value: "60–80%", label: "reduction in unqualified interviews" },
  { value: "Faster", label: "time-to-fill on critical roles" },
  { value: "Full", label: "technician pipeline visibility" },
  { value: "More", label: "manager time spent on hiring decisions" },
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

      {/* HERO */}
      <section className="hero hero-bg">
        <div className="hero-overlay" />

        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">Automotive recruiting + training</div>

            <h1>
              NATA Today removes the friction of hiring.{" "}
              <span className="accent">
                You only meet candidates worth your time.
              </span>
            </h1>

            <p className="lede">
              Candidates are screened, evaluated, and prepared before your managers ever get involved — so your team spends time making hiring decisions, not sorting through applicants.
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

      {/* PROCESS */}
      <section id="system" className="process-section">
        <div className="wrap">
          <div className="section-kicker">Where the work gets removed</div>

          <div className="process-hero">
            <h2>You don’t sort candidates. You meet the right ones.</h2>
            <p>
              The dealership still makes the hiring decision — but only after candidates have been screened, organized, and prepared. For technicians, certification level, service experience, and readiness are visible before any time is spent.
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

          {/* CONTRAST BLOCK */}
          <div className="contrast-block">
            <div className="contrast-col">
              <h4>Without NATA Today</h4>
              <ul>
                <li>Managers sort through applicants</li>
                <li>Interviews are the first filter</li>
                <li>Time is spent on the wrong candidates</li>
              </ul>
            </div>

            <div className="contrast-col highlight">
              <h4>With NATA Today</h4>
              <ul>
                <li>Candidates are filtered before you see them</li>
                <li>Interviews confirm, not discover</li>
                <li>Manager time is protected and focused</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* OUTCOMES */}
      <section id="outcomes" className="outcome-section">
        <div className="wrap">
          <div className="outcome-heading">
            <div className="section-kicker dark">
              What changes for the dealer
            </div>
            <h2>Fewer interviews. Better conversations. Faster hires.</h2>
            <p>
              NATA Today is not another tool to manage. It removes the work that slows hiring down — especially when technician roles directly impact service capacity and revenue.
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
                Your team gets candidates who have already been screened, prepared, and matched to the role — including technician certification and readiness when it matters most.
              </p>
            </div>
            <Link className="btn btn-primary" href="/dealer-demo">
              See the Dealer View
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap">NATA Today · Powered by clarity</div>
      </footer>
    </main>
  );
}
