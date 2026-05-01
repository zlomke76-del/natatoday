import Nav from "../components/Nav";

const roles = ["Service Technicians", "Service Advisors", "Sales Consultants", "BDC Representatives", "Parts Advisors", "Multiple roles"];
const needs = ["ASE certification visibility", "OEM certification tracking", "Master Certified technician priority", "Entry-level training pathway", "Interview scheduling support", "Candidate pre-screening"];
const dealerRoles = ["Dealer Principal", "General Manager", "Service Director", "Fixed Ops Director", "Sales Manager", "HR / Recruiting"];
const groupSizes = ["1 dealership", "2–5 dealerships", "6–15 dealerships", "16+ dealerships / group"];
const plans = [
  ["starter", "Starter Pipeline", "$995/mo", "One store with light-to-moderate hiring needs."],
  ["active", "Active Pipeline", "$1,295/mo", "Stores actively hiring across sales and fixed ops."],
  ["full", "Full Pipeline Coverage", "$1,595/mo", "High-volume stores or groups with ongoing hiring pressure."],
];

function Field({ label, name, placeholder, type = "text", required = true }: { label: string; name: string; placeholder: string; type?: string; required?: boolean }) {
  return <label style={field}><span style={labelStyle}>{label}</span><input name={name} type={type} placeholder={placeholder} required={required} style={input} /></label>;
}
function SelectField({ label, name, options }: { label: string; name: string; options: string[] }) {
  return <label style={field}><span style={labelStyle}>{label}</span><select name={name} required style={input} defaultValue=""><option value="" disabled>Select</option>{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>;
}
function CheckPill({ name, value }: { name: string; value: string }) {
  return <label style={pill}><input name={name} value={value} type="checkbox" style={{ accentColor: "#1473ff" }} /><span>{value}</span></label>;
}
function Step({ n, title, copy }: { n: string; title: string; copy: string }) {
  return <div style={card}><span style={kicker}>Step {n}</span><strong>{title}</strong><p style={muted}>{copy}</p></div>;
}

export default function PricingIntakeEnrollmentPage({ searchParams }: { searchParams?: { checkout?: string } }) {
  return (
    <main className="shell">
      <Nav />
      <section style={wrap}>
        {searchParams?.checkout === "success" ? <div style={success}><strong>Enrollment received.</strong><span>NATA Today has the subscription signal. Next step: finish dealer setup and open the hiring pipeline.</span></div> : null}
        {searchParams?.checkout === "canceled" ? <div style={warn}><strong>Checkout canceled.</strong><span>Your intake was not completed. You can update the details below and try again.</span></div> : null}

        <div style={heroGrid}>
          <section style={panel}>
            <div className="eyebrow">Dealer enrollment</div>
            <h1 style={title}>Start with the roles your store needs filled.</h1>
            <p className="lede" style={{ maxWidth: 780 }}>NATA Today captures the dealership context that drives hiring: priority roles, technician certification needs, interview volume, and where qualified candidates should go next.</p>
            <div style={steps}>
              <Step n="01" title="Store context" copy="Dealership, location, contact, group size, and hiring pressure." />
              <Step n="02" title="Role priorities" copy="Technicians, advisors, sales, BDC, parts, certifications, and screening needs." />
              <Step n="03" title="Pipeline activation" copy="Subscription starts and intake metadata passes to Stripe for onboarding visibility." />
            </div>
          </section>
          <aside style={side}><span style={bluePill}>Payment follows context</span><h2 style={sideTitle}>This is not a generic pricing page.</h2><p style={muted}>The intake is the pipeline initializer. It gives Don and the NATA team visibility into who the client is, what jobs are open, and how urgent the hiring pressure is before subscription handoff completes.</p></aside>
        </div>

        <form action="/api/stripe/checkout" method="post" style={form}>
          <div style={formHeader}><div><div className="eyebrow" style={{ marginBottom: 10 }}>Structured intake</div><h2 style={formTitle}>Dealership setup details</h2><p style={muted}>Complete the intake, choose the monthly plan, then continue to Stripe checkout.</p></div><div style={callout}><span>Primary outcome</span><strong>Qualified candidate routing</strong></div></div>

          <div style={band}><span style={kicker}>Store information</span><div style={grid}><Field label="Dealership name" name="dealershipName" placeholder="Jersey Village CDJR" /><Field label="Website" name="website" placeholder="https://yourdealership.com" required={false} /><Field label="City" name="city" placeholder="Houston" /><Field label="State" name="state" placeholder="TX" /></div></div>
          <div style={band}><span style={kicker}>Hiring contact</span><div style={grid}><Field label="Primary contact" name="primaryContact" placeholder="Name" /><Field label="Email" name="email" type="email" placeholder="name@dealership.com" /><Field label="Phone" name="phone" type="tel" placeholder="(555) 555-5555" /><SelectField label="Your role" name="dealerRole" options={dealerRoles} /></div></div>
          <div style={band}><span style={kicker}>Hiring pressure</span><div style={grid}><SelectField label="Dealer group size" name="dealerGroupSize" options={groupSizes} /><Field label="Monthly hiring target" name="monthlyHiringTarget" placeholder="Example: 4–8 hires" /><label style={field}><span style={labelStyle}>Urgency</span><select name="urgency" required style={input} defaultValue="standard"><option value="standard">Standard</option><option value="high">High</option><option value="critical">Critical</option></select></label></div></div>
          <div style={band}><span style={kicker}>Priority roles</span><div style={pillGrid}>{roles.map((r) => <CheckPill key={r} name="rolesNeeded" value={r} />)}</div></div>
          <div style={band}><span style={kicker}>Certification and screening needs</span><div style={pillGrid}>{needs.map((n) => <CheckPill key={n} name="certificationNeeds" value={n} />)}</div></div>
          <div style={band}><span style={kicker}>Plan selection</span><div style={planGrid}>{plans.map(([key, name, price, copy]) => <label key={key} style={plan}><input type="radio" name="plan" value={key} defaultChecked={key === "active"} style={{ accentColor: "#1473ff" }} /><div><strong>{name}</strong><div style={priceStyle}>{price}</div><p style={muted}>{copy}</p></div></label>)}</div></div>
          <div style={band}><span style={kicker}>Notes for NATA</span><textarea name="notes" placeholder="Tell us what roles are most urgent, what has not worked before, or who should receive candidate handoffs." style={textarea} rows={5} /></div>
          <div style={submit}><div style={muted}>Secure checkout is handled by Stripe. Intake details are passed as subscription metadata for onboarding visibility.</div><button type="submit" className="btn btn-primary" style={{ border: 0, cursor: "pointer" }}>Continue to Stripe</button></div>
        </form>
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = { width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "54px 0 90px" };
const heroGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, .48fr)", gap: 28, alignItems: "stretch" };
const panel: React.CSSProperties = { padding: 34, borderRadius: 30, border: "1px solid rgba(255,255,255,.12)", background: "linear-gradient(145deg, rgba(20,115,255,.13), rgba(255,255,255,.04))" };
const title: React.CSSProperties = { fontSize: "clamp(44px, 6vw, 72px)", lineHeight: .95, margin: 0 };
const steps: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 28 };
const card: React.CSSProperties = { padding: 18, borderRadius: 20, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)" };
const kicker: React.CSSProperties = { display: "block", color: "#fbbf24", fontSize: 12, fontWeight: 950, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 14 };
const muted: React.CSSProperties = { color: "#9fb1cc", lineHeight: 1.55, margin: "8px 0 0" };
const side: React.CSSProperties = { padding: 28, borderRadius: 30, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" };
const bluePill: React.CSSProperties = { display: "inline-flex", padding: "8px 12px", borderRadius: 999, background: "rgba(20,115,255,.22)", color: "#dbeafe", fontSize: 12, fontWeight: 900 };
const sideTitle: React.CSSProperties = { margin: "18px 0 0", fontSize: 34, lineHeight: 1, letterSpacing: "-.05em" };
const form: React.CSSProperties = { marginTop: 26, padding: 30, borderRadius: 30, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)" };
const formHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 22, marginBottom: 24 };
const formTitle: React.CSSProperties = { margin: 0, fontSize: 34, letterSpacing: "-.04em" };
const callout: React.CSSProperties = { minWidth: 260, padding: 18, borderRadius: 20, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" };
const band: React.CSSProperties = { padding: 22, borderRadius: 24, border: "1px solid rgba(255,255,255,.1)", background: "rgba(3,10,20,.35)", marginTop: 16 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 };
const field: React.CSSProperties = { display: "grid", gap: 7 };
const labelStyle: React.CSSProperties = { color: "#e8f2ff", fontSize: 13, fontWeight: 850 };
const input: React.CSSProperties = { width: "100%", minHeight: 48, borderRadius: 14, border: "1px solid rgba(255,255,255,.14)", background: "#07101f", color: "#fff", padding: "0 14px", outline: "none" };
const pillGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const pill: React.CSSProperties = { minHeight: 46, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 999, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.055)", color: "#dbeafe", fontSize: 13, fontWeight: 750 };
const planGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 };
const plan: React.CSSProperties = { display: "flex", gap: 12, padding: 18, borderRadius: 22, border: "1px solid rgba(255,255,255,.14)", background: "rgba(255,255,255,.06)" };
const priceStyle: React.CSSProperties = { marginTop: 10, fontSize: 26, fontWeight: 950 };
const textarea: React.CSSProperties = { width: "100%", borderRadius: 16, border: "1px solid rgba(255,255,255,.14)", background: "#07101f", color: "#fff", padding: 14, outline: "none", resize: "vertical" };
const submit: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginTop: 20 };
const success: React.CSSProperties = { display: "grid", gap: 4, padding: 18, marginBottom: 18, borderRadius: 18, background: "rgba(34,197,94,.13)", border: "1px solid rgba(34,197,94,.28)" };
const warn: React.CSSProperties = { display: "grid", gap: 4, padding: 18, marginBottom: 18, borderRadius: 18, background: "rgba(251,191,36,.13)", border: "1px solid rgba(251,191,36,.28)" };
