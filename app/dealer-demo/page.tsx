import Link from "next/link";
import Nav from "../components/Nav";

const roles = [
  { title: "Sales Consultant", count: 8, priority: "High" },
  { title: "BDC Representative", count: 5, priority: "Medium" },
  { title: "Service Advisor", count: 3, priority: "High" },
];

const candidates = [
  { name: "Maria Lopez", role: "Sales Consultant", status: "Certified Ready", progress: 100, badge: "green" },
  { name: "Ethan Brooks", role: "BDC Representative", status: "Training 82%", progress: 82, badge: "gold" },
  { name: "Jordan Miles", role: "Service Advisor", status: "Screened", progress: 56, badge: "" },
  { name: "Avery Coleman", role: "Sales Consultant", status: "Interview Requested", progress: 100, badge: "dark" },
];

export default function DealerDemoPage() {
  return (
    <main className="page">
      <div className="topbar"><Nav /></div>
      <section className="dashboard">
        <div className="dash-header">
          <div>
            <div className="eyebrow">Dealer demo</div>
            <h1>NATA candidate command center</h1>
            <p>Static V1 dashboard showing the management experience before Supabase logic is added.</p>
          </div>
          <Link className="btn btn-primary" href="/candidate-demo">Open candidate profile</Link>
        </div>

        <div className="metric-row" style={{ marginBottom: 18 }}>
          <div className="metric"><strong>24</strong><span>active candidates</span></div>
          <div className="metric"><strong>8</strong><span>certified ready</span></div>
          <div className="metric"><strong>6</strong><span>interviews requested</span></div>
          <div className="metric"><strong>3</strong><span>open roles</span></div>
        </div>

        <div className="dash-grid">
          <aside className="panel">
            <h2>Open roles</h2>
            {roles.map((role) => (
              <div className="role" key={role.title}>
                <div>
                  <strong>{role.title}</strong>
                  <p style={{ margin: "4px 0 0", color: "#64748b" }}>{role.count} candidates matched</p>
                </div>
                <span className={role.priority === "High" ? "badge gold" : "badge"}>{role.priority}</span>
              </div>
            ))}
          </aside>

          <section className="panel">
            <h2>Candidate pipeline</h2>
            {candidates.map((candidate) => (
              <Link className="candidate" href="/candidate-demo" key={candidate.name}>
                <div>
                  <h3>{candidate.name}</h3>
                  <p>{candidate.role}</p>
                  <div className="progress"><span style={{ width: `${candidate.progress}%` }} /></div>
                </div>
                <span className={`badge ${candidate.badge}`}>{candidate.status}</span>
              </Link>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}
