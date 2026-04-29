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

      {/* HERO */}
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
              We recruit the right people, train them to perform, and help your dealership win.
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
              <span>Train</span>
              <span>Certify</span>
              <span>Place</span>
              <span>Track</span>
            </div>
          </div>
        </div>
      </section>

      {/* SYSTEM */}
      <section id="system" className="section-light">
        <div className="wrap">
          <h2 className="section-title">Not another hiring form. A clearer operating layer.</h2>
          <p className="section-copy">
            Dealer visibility, candidate readiness, and a system designed to scale into real-world data.
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

      {/* OUTCOMES */}
      <section id="outcomes" className="section-light section-tight">
        <div className="wrap">
          <h2 className="section-title">What dealers should see immediately.</h2>

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
        <div className="wrap">NATA Today · Powered by clarity</div>
      </footer>
    </main>
  );
}
