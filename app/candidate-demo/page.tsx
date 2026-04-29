import Link from "next/link";
import Nav from "../components/Nav";

export default function CandidateDemoPage() {
  return (
    <main className="page">
      <div className="topbar"><Nav /></div>
      <section className="profile">
        <div className="profile-hero">
          <div>
            <div className="eyebrow">Candidate readiness profile</div>
            <h1 style={{ color: "white", marginBottom: 10 }}>Maria Lopez</h1>
            <p style={{ color: "#cbd5e1", margin: 0, lineHeight: 1.55 }}>
              Sales Consultant candidate · Houston market · Interview-ready after completing NATA showroom readiness modules.
            </p>
          </div>
          <div className="avatar">ML</div>
        </div>

        <div className="profile-grid">
          <article className="panel">
            <h2>Readiness summary</h2>
            <ul className="clean">
              <li><span>Status</span><strong>Certified Ready</strong></li>
              <li><span>Role fit</span><strong>Sales Consultant</strong></li>
              <li><span>Communication</span><strong>Strong</strong></li>
              <li><span>Availability</span><strong>Immediate</strong></li>
            </ul>
          </article>

          <article className="panel">
            <h2>Training progress</h2>
            <ul className="clean">
              <li><span>Meet & greet</span><strong>Complete</strong></li>
              <li><span>Needs discovery</span><strong>Complete</strong></li>
              <li><span>Vehicle walkaround</span><strong>Complete</strong></li>
              <li><span>Follow-up discipline</span><strong>Complete</strong></li>
            </ul>
          </article>
        </div>

        <article className="panel" style={{ marginTop: 18 }}>
          <h2>Dealer action</h2>
          <p style={{ color: "#64748b", lineHeight: 1.6, marginTop: 0 }}>
            Maria is presented as a realistic V1 demo candidate: screened, trained, and ready for a dealership interview. This page is intentionally static so the visual model can be approved before database logic is introduced.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/dealer-demo">Request interview</Link>
            <Link className="btn btn-secondary" style={{ color: "#0f172a", borderColor: "#cbd5e1" }} href="/dealer-demo">Back to dashboard</Link>
          </div>
        </article>
      </section>
    </main>
  );
}
