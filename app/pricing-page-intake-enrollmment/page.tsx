import Nav from "../components/Nav";

const plans = [
  {
    key: "starter",
    name: "Starter Pipeline",
    price: "$995/mo",
    copy: "For one dealership location with light-to-moderate hiring needs.",
  },
  {
    key: "active",
    name: "Active Pipeline",
    price: "$1,295/mo",
    copy: "For one dealership location actively hiring across sales or fixed ops.",
  },
  {
    key: "full",
    name: "Full Pipeline Coverage",
    price: "$1,595/mo",
    copy: "For one high-volume dealership location with ongoing hiring pressure.",
  },
];

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={field}>
      <span style={labelStyle}>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        style={input}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label style={field}>
      <span style={labelStyle}>{label}</span>
      <select name={name} required style={input} defaultValue="">
        <option value="" disabled>
          Select
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Step({ n, title, copy }: { n: string; title: string; copy: string }) {
  return (
    <div style={card}>
      <span style={kicker}>Step {n}</span>
      <strong>{title}</strong>
      <p style={muted}>{copy}</p>
    </div>
  );
}

export default function PricingIntakeEnrollmentPage({
  searchParams,
}: {
  searchParams?: { checkout?: string };
}) {
  return (
    <main className="shell">
      <Nav />

      <section style={wrap}>
        {searchParams?.checkout === "success" ? (
          <div style={success}>
            <strong>Enrollment received.</strong>
            <span>
              Your subscription signal was received. Next step: complete the hiring setup for your dealership pipeline.
            </span>
          </div>
        ) : null}

        {searchParams?.checkout === "canceled" ? (
          <div style={warn}>
            <strong>Checkout canceled.</strong>
            <span>Your subscription was not started. You can update the details below and try again.</span>
          </div>
        ) : null}

        <div style={heroGrid}>
          <section style={panel}>
            <div className="eyebrow">Dealer enrollment</div>
            <h1 style={title}>Start your dealership pipeline in under two minutes.</h1>
            <p className="lede" style={{ maxWidth: 780 }}>
              Start the subscription first. NATA Today will collect the deeper hiring setup after enrollment so your team is not forced through implementation work before checkout.
            </p>

            <div style={steps}>
              <Step
                n="01"
                title="Start subscription"
                copy="Dealership, contact, location count, and plan selection."
              />
              <Step
                n="02"
                title="Checkout securely"
                copy="Stripe handles the subscription for the dealership location count selected."
              />
              <Step
                n="03"
                title="Complete setup"
                copy="After payment, NATA collects roles, urgency, certifications, and routing details."
              />
            </div>
          </section>

          <aside style={side}>
            <span style={bluePill}>Simple start</span>
            <h2 style={sideTitle}>No heavy onboarding before payment.</h2>
            <p style={muted}>
              The first step should only answer: who is enrolling, which dealership location is being activated, and which plan should start.
            </p>
            <div style={noticeBox}>
              <strong>Pricing is per dealership location.</strong>
              <span>
                Dealer groups can enroll one rooftop now or activate multiple locations by selecting the number of dealership locations below.
              </span>
            </div>
          </aside>
        </div>

        <form action="/api/stripe/checkout" method="post" style={form}>
          <div style={formHeader}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Subscription start
              </div>
              <h2 style={formTitle}>Start with the first dealership.</h2>
              <p style={muted}>
                Required now: dealership, contact, email, phone, state, plan, and per-location billing acknowledgment.
              </p>
            </div>
            <div style={callout}>
              <span>After checkout</span>
              <strong>We collect hiring setup</strong>
            </div>
          </div>

          <div style={band}>
            <span style={kicker}>Dealership</span>
            <div style={grid}>
              <Field label="Dealership name" name="dealershipName" placeholder="Jersey Village CDJR" />
              <Field label="Website" name="website" placeholder="https://yourdealership.com" required={false} />
              <Field label="City" name="city" placeholder="Houston" />
              <SelectField
                label="State"
                name="state"
                options={[
                  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
                ]}
              />
            </div>
          </div>

          <div style={band}>
            <span style={kicker}>Primary contact</span>
            <div style={grid}>
              <Field label="Contact name" name="primaryContact" placeholder="Name" />
              <Field label="Email" name="email" type="email" placeholder="name@dealership.com" />
              <Field label="Phone" name="phone" type="tel" placeholder="(555) 555-5555" />
              <SelectField
                label="Your role"
                name="dealerRole"
                options={[
                  "Dealer Principal",
                  "General Manager",
                  "Service Director",
                  "Fixed Ops Director",
                  "Sales Manager",
                  "HR / Recruiting",
                  "Other",
                ]}
              />
            </div>
          </div>

          <div style={band}>
            <span style={kicker}>Billing unit</span>
            <div style={billingGrid}>
              <label style={field}>
                <span style={labelStyle}>Dealership locations to activate now</span>
                <input
                  name="dealershipLocationCount"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="1"
                  required
                  style={input}
                />
              </label>

              <label style={field}>
                <span style={labelStyle}>Multi-store group?</span>
                <select name="multiStoreGroup" required style={input} defaultValue="no">
                  <option value="no">No, this is one dealership</option>
                  <option value="yes_later">Yes, start with this store first</option>
                  <option value="yes_multiple_now">Yes, activate multiple locations now</option>
                </select>
              </label>
            </div>

            <label style={acknowledgment}>
              <input
                name="perLocationAcknowledgment"
                value="accepted"
                type="checkbox"
                required
                style={{ accentColor: "#1473ff", marginTop: 3 }}
              />
              <span>
                I understand NATA Today pricing is per dealership location / rooftop, not one subscription for an entire dealer group.
              </span>
            </label>
          </div>

          <div style={band}>
            <span style={kicker}>Plan selection</span>
            <p style={{ ...muted, marginBottom: 16 }}>
              Select the monthly plan for each dealership location being activated now.
            </p>

            <div style={planGrid}>
              {plans.map((planOption) => (
                <label key={planOption.key} style={plan}>
                  <input
                    type="radio"
                    name="plan"
                    value={planOption.key}
                    defaultChecked={planOption.key === "active"}
                    style={{ accentColor: "#1473ff", marginTop: 4 }}
                  />
                  <div>
                    <strong>{planOption.name}</strong>
                    <div style={priceStyle}>{planOption.price}</div>
                    <p style={muted}>{planOption.copy}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={band}>
            <span style={kicker}>Optional note</span>
            <textarea
              name="notes"
              placeholder="Optional: tell us what matters most right now. Example: technicians are urgent, sales consultant pipeline is secondary."
              style={textarea}
              rows={4}
            />
          </div>

          <div style={submit}>
            <div style={muted}>
              Secure checkout is handled by Stripe. Detailed hiring setup happens after the subscription starts.
            </div>
            <button type="submit" className="btn btn-primary" style={{ border: 0, cursor: "pointer" }}>
              Continue to Stripe
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = {
  width: "min(1180px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "54px 0 90px",
};

const heroGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(320px, .48fr)",
  gap: 28,
  alignItems: "stretch",
};

const panel: React.CSSProperties = {
  padding: 34,
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,.12)",
  background: "linear-gradient(145deg, rgba(20,115,255,.13), rgba(255,255,255,.04))",
};

const title: React.CSSProperties = {
  fontSize: "clamp(44px, 6vw, 72px)",
  lineHeight: 0.95,
  margin: 0,
};

const steps: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: 14,
  marginTop: 28,
};

const card: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.10)",
};

const kicker: React.CSSProperties = {
  display: "block",
  color: "#fbbf24",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  marginBottom: 14,
};

const muted: React.CSSProperties = {
  color: "#9fb1cc",
  lineHeight: 1.55,
  margin: "8px 0 0",
};

const side: React.CSSProperties = {
  padding: 28,
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
};

const bluePill: React.CSSProperties = {
  display: "inline-flex",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(20,115,255,.22)",
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 900,
};

const sideTitle: React.CSSProperties = {
  margin: "18px 0 0",
  fontSize: 34,
  lineHeight: 1,
  letterSpacing: "-.05em",
};

const noticeBox: React.CSSProperties = {
  display: "grid",
  gap: 6,
  marginTop: 22,
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(251,191,36,.28)",
  background: "rgba(251,191,36,.09)",
  color: "#f8fafc",
};

const form: React.CSSProperties = {
  marginTop: 26,
  padding: 30,
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.05)",
};

const formHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 22,
  marginBottom: 24,
};

const formTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 34,
  letterSpacing: "-.04em",
};

const callout: React.CSSProperties = {
  minWidth: 260,
  padding: 18,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.06)",
};

const band: React.CSSProperties = {
  padding: 22,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,.1)",
  background: "rgba(3,10,20,.35)",
  marginTop: 16,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const billingGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, .55fr) minmax(0, 1fr)",
  gap: 14,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: React.CSSProperties = {
  color: "#e8f2ff",
  fontSize: 13,
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.14)",
  background: "#07101f",
  color: "#fff",
  padding: "0 14px",
  outline: "none",
};

const acknowledgment: React.CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 16,
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(255,255,255,.055)",
  color: "#dbeafe",
  lineHeight: 1.45,
};

const planGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
};

const plan: React.CSSProperties = {
  display: "flex",
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.06)",
};

const priceStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 26,
  fontWeight: 950,
};

const textarea: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.14)",
  background: "#07101f",
  color: "#fff",
  padding: 14,
  outline: "none",
  resize: "vertical",
};

const submit: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  marginTop: 20,
};

const success: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 18,
  marginBottom: 18,
  borderRadius: 18,
  background: "rgba(34,197,94,.13)",
  border: "1px solid rgba(34,197,94,.28)",
};

const warn: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 18,
  marginBottom: 18,
  borderRadius: 18,
  background: "rgba(251,191,36,.13)",
  border: "1px solid rgba(251,191,36,.28)",
};
