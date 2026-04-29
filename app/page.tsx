import Link from "next/link";
import Nav from "./components/Nav";

const roles = ["Sales Consultant", "BDC Representative", "Service Advisor", "Parts Advisor"];

const steps = [
  {
    number: "01",
    title: "Candidate interest comes in",
    copy: "Applicants, referrals, walk-ins, and campaign responses move into one structured intake instead of scattered inboxes and notes.",
  },
  {
    number: "02",
    title: "NATA screens and interviews first",
    copy: "We review candidates before the dealership spends manager time. Serious people move forward. Noise gets filtered out.",
  },
  {
    number: "03",
    title: "Training creates readiness signals",
    copy: "Progress, completion, confidence, and role alignment become visible so the store knows who is actually prepared.",
  },
  {
    number: "04",
    title: "Dealer gets interview-ready candidates",
    copy: "The handoff is clean: who they are, where they fit, what they completed, and why they are worth meeting in person.",
  },
];

const proofCards = [
  {
    title: "Less manager drag",
    copy: "Your managers are not chasing every applicant or guessing who is serious. They see organized people who have already been reviewed.",
  },
  {
    title: "Cleaner candidate handoff",
    copy: "Each candidate arrives with role fit, readiness, training progress, and notes that make the next conversation easier.",
  },
  {
    title: "Better use of interviews",
    copy: "The in-person interview becomes a decision point, not the first filter.",
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

      <section className="hero hero-bg">
        <div className="hero-overlay" />

        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow">Automotive recruiting + training</div>

            <h1>
              America’s #1 Automotive Recruiting & Training{" "}
              <span className="accent">Platform</span>
            </h1>

            <p className="lede">
              We recruit, screen, interview, train, and prepare candidates before
              your dealership spends manager time.
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
              <span>Train</span>
              <span>Place</span>
            </div>
          </div>
        </div>
      </section>

      <section id="system" className="process-section">
        <div className="wrap">
          <div className="section-kicker">Where the friction gets removed</div>

          <div className="process-hero">
            <h2>We do the work before the dealer says yes to an interview.</h2>
            <p>
              The dealership still makes the hiring decision. NATA Today improves
              what reaches that decision: cleaner candidates, clearer readiness,
              and better use of manager time.
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
            <div className="section-kicker dark">What the dealer sees</div>
            <h2>A cleaner pipeline. A sharper handoff. A better interview.</h2>
            <p>
              NATA Today gives dealerships a practical operating layer for recruiting
              and training, not another passive form waiting for someone to follow up.
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
                Give managers candidates who have already been organized, screened,
                trained, and prepared for the conversation that matters.
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
