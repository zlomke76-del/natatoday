import Link from "next/link";
import Nav from "./components/Nav";

const roles = ["Sales Consultant", "BDC Representative", "Service Advisor", "Parts Advisor"];

const steps = [
  {
    number: "01",
    title: "Candidates come in",
    copy: "Applicants, referrals, walk-ins, and campaigns feed into one organized pipeline instead of scattered inboxes.",
  },
  {
    number: "02",
    title: "We filter and qualify",
    copy: "We review and interview candidates before your managers spend time. Serious people move forward. Noise gets removed.",
  },
  {
    number: "03",
    title: "Readiness becomes clear",
    copy: "Training, role fit, and confidence become visible so you know who is actually prepared.",
  },
  {
    number: "04",
    title: "You meet the right people",
    copy: "You get a clean shortlist with context — not a pile of unknown applicants.",
  },
];

const proofCards = [
  {
    title: "Less manager time wasted",
    copy: "Your team is not chasing every applicant or guessing who is serious. They focus on candidates worth meeting.",
  },
  {
    title: "Clearer candidate handoff",
    copy: "Each person arrives with role fit, readiness, and context already defined.",
  },
  {
    title: "Interviews become decisions",
    copy: "The interview is no longer the first filter — it’s where you decide yes or no.",
  },
];

const metrics = [
  { value: "24", label: "candidates in pipeline" },
  { value: "8", label: "ready for interview" },
  { value: "91%", label: "training completion" },
  { value: "3", label: "priority roles open" },
];

export default function Home() {
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
              Stop sorting through applicants.{" "}
              <span className="accent">Start meeting the right ones.</span>
            </h1>

            <p className="lede">
              NATA Today handles recruiting, screening, and preparation before your team gets involved — so your managers spend time on real candidates, not guesswork.
            </p>

            <div className="hero-actions">
              <Link className="btn btn-primary" href="/dealer-demo">
                View Dealer Demo
              </Link>
              <Link className="btn btn-secondary" href="/pricing">
                See Pricing
              </Link>
            </div>

            <div className="icon-row">
              <span>Recruit</span>
              <span>Screen</span>
              <span>Interview</span>
              <span>Train</span>
              <span>Place</span>
            </div>
          </div>
        </div>
      </section>

      {/* SYSTEM */}
      <section id="system" className="process-section">
        <div className="wrap">
          <div className="section-kicker">Where the work gets removed</div>

          <div className="process-hero">
            <h2>You don’t sort candidates. You meet the ones that matter.</h2>
            <p>
              The dealership still makes the hiring decision — but only after candidates have been reviewed, organized, and prepared. No more starting from zero.
            </p>
          </div>

          <div className="role-strip">
            {roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>

          <div className="process-grid">
            {steps.map((step) => (
              <article className="process-card" key={step.number}>
                <div className="step-number">{step.number}</div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* OUTCOMES */}
      <section id="outcomes" className="outcome-section">
        <div className="wrap">
          <div className="outcome-heading">
            <div className="section-kicker dark">What changes for the dealer</div>
            <h2>A cleaner pipeline. Less noise. Better hires.</h2>
            <p>
              NATA Today doesn’t add another tool to manage — it removes the work that slows hiring down.
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
                Your team gets candidates who have already been organized, screened, and prepared for a real conversation.
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
