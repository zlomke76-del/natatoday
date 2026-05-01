import Nav from "../components/Nav";

const plans = [
  {
    key: "starter",
    name: "Starter Pipeline",
    price: "$995/mo",
    copy: "Light-to-moderate hiring support for one dealership location.",
  },
  {
    key: "active",
    name: "Active Pipeline",
    price: "$1,295/mo",
    copy: "Ongoing hiring support for one dealership location across sales or fixed ops.",
  },
  {
    key: "full",
    name: "Full Pipeline Coverage",
    price: "$1,595/mo",
    copy: "High-volume hiring coverage for one dealership location with continuous hiring pressure.",
  },
];

const states = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const dealerRoles = [
  "Dealer Principal",
  "General Manager",
  "Service Director",
  "Fixed Ops Director",
  "Sales Manager",
  "HR / Recruiting",
  "Other",
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
              Your subscription signal was received. Next step: complete hiring setup for your dealership pipeline.
            </span>
          </div>
        ) : null}

        {searchParams?.checkout === "canceled" ? (
          <div style={warn}>
            <strong>Checkout canceled.</strong>
            <span>Your subscription was not started. You can update the details below and try again.</span>
          </div>
        ) : null}

        <section style={heroPanel}>
          <div className="eyebrow">Dealer enrollment</div>
          <h1 style={title}>Start your dealership pipeline in under two minutes.</h1>
          <p className="lede" style={{ maxWidth: 820 }}>
            Start the subscription first. NATA Today collects deeper hiring setup after enrollment so your team is not forced through implementation work before checkout.
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

        <form action="/api/stripe/checkout" method="post" style={form}>
          <div style={formHeader}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Subscription start
              </div>
              <h2 style={formTitle}>Start with your dealership.</h2>
              <p style={muted}>
                Required now: dealership, contact, location count, and plan. Detailed hiring setup happens after checkout.
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
              <SelectField label="State" name="state" options={states} />
            </div>
          </div>

          <div style={band}>
            <span style={kicker}>Primary contact</span>
            <div style={grid}>
              <Field label="Contact name" name="primaryContact" placeholder="Name" />
              <Field label="Email" name="email" type="email" placeholder="name@dealership.com" />
              <Field label="Phone" name="phone" type="tel" placeholder="(555) 555-5555" />
              <SelectField label="Your role" name="dealerRole" options={dealerRoles} />
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
                  <option value="yes_later">Yes, start with one store first</option>
                  <option value="yes_multiple_now">Yes, activate multiple locations now</option>
                </select>
              </label>
            </div>
          </div>

          <div style={pricingModel}>
            <div style={pricingModelText}>
              <span style={kicker}>Pricing model</span>
              <strong>Pricing is per dealership location.</strong>
              <p style={muted}>
                Select the monthly plan that should apply to each dealership location being activated now.
                Dealer groups can start with one rooftop or activate multiple locations by increasing the location count above.
              </p>
            </div>
            <div style={pricingModelBadge}>
              <span>Billing unit</span>
              <strong>1 rooftop = 1 subscription unit</strong>
            </div>
          </div>

          <div style={band}>
            <span style={kicker}>Plan selection</span>

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
                    <div style={unitText}>Per dealership location</div>
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

const heroPanel: React.CSSProperties = {
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

const pricingModel: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr minmax(220px, .34fr)",
  gap: 18,
  alignItems: "stretch",
  padding: 22,
  borderRadius: 24,
  border: "1px solid rgba(251,191,36,.26)",
  background: "linear-gradient(145deg, rgba(251,191,36,.095), rgba(255,255,255,.04))",
  marginTop: 16,
};

const pricingModelText: React.CSSProperties = {
  minWidth: 0,
};

const pricingModelBadge: React.CSSProperties = {
  display: "grid",
  alignContent: "center",
  gap: 7,
  padding: 18,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(7,16,31,.55)",
  color: "#e8f2ff",
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

const unitText: React.CSSProperties = {
  marginTop: 4,
  color: "#fbbf24",
  fontSize: 12,
  fontWeight: 900,
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
