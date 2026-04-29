import Link from "next/link";
import Nav from "./components/Nav";

const cards = [
  {
    title: "Recruit with structure",
    copy: "Turn interest into organized candidate profiles with role fit, availability, and dealership readiness visible from the start.",
  },
  {
    title: "Train with purpose",
    copy: "Move beyond passive content. Show progress, completion, and readiness signals dealers can actually use.",
  },
  {
    title: "Place with confidence",
    copy: "Give managers a clear view of who is interview-ready, who needs work, and where every candidate stands.",
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

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Automotive recruiting + training</div>

          <h1>Build the next dealership workforce.</h1>

          <p className="lede">
            NATA Today helps dealers recruit, train, certify, and place stronger candidates with a cleaner,
            faster, more visible hiring experience.
          </p>

          <div className="hero-actions">
            <Link className="btn btn-primary" href="/dealer-demo">
              View Dealer Demo
            </Link>
            <Link className="btn btn-secondary" href="/candidate-demo">
              See Candidate Profile
            </Link>
          </div>

          <div className="trust-row" aria-label="NATA Today capabilities">
            <span className="trust-pill">Recruiting pipeline</span>
            <span className="trust-pill">Training visibility</span>
            <span className="trust-pill">Certified-ready candidates</span>
          </div>
        </div>

        <div className="hero-card" aria-label="Automotive workforce visual">
          <div className="road">
            <div className="car">
              <div className="car-top" />
              <div className="car-body" />
              <div className="wheel one" />
              <div className="wheel two" />
            </div>
          </div>

          <div className="signal-card">
            <div className="signal">
              <b>12 active candidates</b>
              <span>in current dealer pipeline</span>
            </div>
            <div className="signal">
              <b>7 certified ready</b>
              <span>prepared for interviews</span>
            </div>
            <div className="signal">
              <b>3 open dealer roles</b>
              <span>matched by priority</span>
            </div>
          </div>
        </div>
      </section>

      <section id="system" className="section-light">
        <div className="wrap">
          <h2 className="section-title">Not another hiring form. A clearer operating layer.</h2>
          <p className="section-copy">
            The V1 demo keeps the logic simple on purpose. It shows the face of the future first:
            dealer visibility, candidate readiness, and a system that can grow into real data later.
          </p>

          <div className="grid-3">
            {cards.map((card) => (
              <article className="card-light" key={card.title}>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="outcomes" className="section-light section-tight">
        <div className="wrap">
          <h2 className="section-title">What dealers should see immediately.</h2>
          <p className="section-copy">
            A modern NATA Today should make the value tangible before a sales call: who is ready,
            what roles are open, and what action should happen next.
          </p>

          <div className="metric-row">
            {metrics.map((metric) => (
              <div className="metric" key={metric.label}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">NATA Today V1 demo · Static Next.js build · Ready for Vercel</div>
      </footer>
    </main>
  );
}
