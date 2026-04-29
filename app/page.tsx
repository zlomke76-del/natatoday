import Link from "next/link";
import Nav from "./components/Nav";

const cards = [
  {
    eyebrow: "Recruit",
    title: "Source dealership-ready people before your team burns time.",
    copy: "NATA Today turns raw interest into structured candidate profiles with role fit, availability, communication notes, and readiness signals visible from the start.",
  },
  {
    eyebrow: "Train",
    title: "Move candidates through a visible readiness path.",
    copy: "Managers see who is learning, who is stalling, and who is ready to meet the store. No guessing. No spreadsheet chasing. No black box pipeline.",
  },
  {
    eyebrow: "Place",
    title: "Only send people who are prepared for the dealership floor.",
    copy: "We pre-screen, interview, train, and organize candidates before the in-person interview is arranged with the dealership.",
  },
];

const metrics = [
  { value: "24", label: "candidates organized in pipeline" },
  { value: "8", label: "ready for dealer interview" },
  { value: "91%", label: "training completion visibility" },
  { value: "3", label: "priority roles being filled" },
];

const workflow = [
  {
    step: "01",
    title: "Candidate interest comes in",
    copy: "Applicants, referrals, walk-ins, and recruiting campaigns feed into one structured system instead of scattered inboxes and notes.",
  },
  {
    step: "02",
    title: "NATA screens and interviews first",
    copy: "The dealership does not waste time guessing who is serious. Candidates are reviewed, organized, and advanced before the store gets involved.",
  },
  {
    step: "03",
    title: "Training creates readiness signals",
    copy: "Progress, completion, confidence, and role alignment become visible so the dealer knows who is actually prepared.",
  },
  {
    step: "04",
    title: "Dealer receives interview-ready candidates",
    copy: "The store gets a cleaner handoff: who they are, what they fit, where they stand, and why they are worth meeting in person.",
  },
];

const roles = ["Sales Consultant", "BDC Representative", "Service Advisor", "Parts Advisor"];

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
              Your next dealership hire should arrive already moving.
            </h1>

            <p className="lede">
              NATA Today recruits, pre-screens, interviews, trains, and organizes candidates before your dealership spends time on the in-person interview.
            </p>

            <div className="hero-actions">
              <Link className="btn btn-primary" href="/dealer-demo">
                View Dealer Demo
              </Link>
              <Link className="btn btn-secondary" href="/candidate-demo">
                View Candidate Path
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
      <section id="system" className="section-light">
        <div className="wrap">
          <div className="section-kicker">The operating layer</div>
          <h2 className="section-title">
            Dealers do not need another form. They need fewer bad interviews.
          </h2>
          <p className="section-copy">
            The old process makes managers chase applicants, judge readiness manually, and waste interviews on people who were never prepared. NATA Today moves that work upstream.
          </p>

          <div className="grid-3">
            {cards.map((card) => (
              <article className="card-light" key={card.title}>
                <span>{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="section-dark">
        <div className="wrap split-section">
          <div>
            <div className="section-kicker">Where the friction gets removed</div>
            <h2 className="section-title dark-title">
              We do the work before the dealer says yes to an interview.
            </h2>
            <p className="section-copy dark-copy">
              The dealership still makes the hiring decision. NATA Today improves what reaches that decision: cleaner candidates, clearer readiness, and better use of manager time.
            </p>
            <div className="role-row">
              {roles.map((role) => (
                <span key={role}>{role}</span>
              ))}
            </div>
          </div>

          <div className="workflow-card">
            {workflow.map((item) => (
              <article className="workflow-step" key={item.step}>
                <strong>{item.step}</strong>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* OUTCOMES */}
      <section id="outcomes" className="section-light section-tight">
        <div className="wrap">
          <div className="section-kicker">What the dealer sees</div>
          <h2 className="section-title">A cleaner pipeline. A sharper handoff. A better interview.</h2>
          <p className="section-copy">
            The value is not more applicants. The value is knowing who is worth the manager’s time and why.
          </p>

          <div className="metric-row">
            {metrics.map((metric) => (
              <div className="metric" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>

          <div className="closing-panel">
            <div>
              <h2>Built for dealerships that need people ready to perform.</h2>
              <p>
                Recruiting is not the finish line. Readiness is. NATA Today gives dealers a more disciplined way to find, prepare, and place automotive talent.
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
