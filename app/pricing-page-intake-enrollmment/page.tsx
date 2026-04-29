import Link from "next/link";
import Nav from "../components/Nav";

const dealershipRoles = [
  "Dealer Principal",
  "General Manager",
  "Service Director",
  "Fixed Ops Director",
  "Sales Manager",
  "HR / Recruiting",
];

const priorityNeeds = [
  "Service Technicians",
  "Service Advisors",
  "Sales Consultants",
  "BDC Representatives",
  "Parts Advisors",
  "Multiple roles",
];

const certificationNeeds = [
  "ASE certification visibility",
  "OEM certification tracking",
  "Master Certified technician priority",
  "Entry-level training pathway",
  "Interview scheduling support",
  "Candidate pre-screening",
];

const volumeOptions = [
  "1 dealership",
  "2–5 dealerships",
  "6–15 dealerships",
  "16+ dealerships / group",
];

export default function PricingIntakePage() {
  return (
    <main className="shell">
      <Nav />

      <section
        style={{
          width: "min(1180px, calc(100% - 40px))",
          margin: "0 auto",
          padding: "54px 0 90px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.02fr 0.98fr",
            gap: 22,
            alignItems: "stretch",
          }}
          className="pricing-intake-grid"
        >
          <section
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 36,
              padding: 42,
              background:
                "radial-gradient(circle at top right, rgba(20,115,255,0.28), transparent 36%), linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))",
              boxShadow: "0 28px 90px rgba(0,0,0,0.34)",
            }}
          >
            <div className="eyebrow">Dealer enrollment</div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(50px, 6.4vw, 88px)",
                lineHeight: 0.94,
                letterSpacing: "-0.065em",
              }}
            >
              Start with the roles your store needs filled.
            </h1>

            <p className="lede" style={{ maxWidth: 760 }}>
              Before pricing, NATA Today captures the dealership context that matters:
              priority roles, technician certification needs, interview volume, and
              who should receive qualified candidates.
            </p>

            <div
              style={{
                display: "grid",
                gap: 12,
                marginTop: 30,
              }}
            >
              {[
                ["1", "Tell us the dealership and hiring contact"],
                ["2", "Choose the roles and certification priorities"],
                ["3", "NATA prepares the enrollment handoff"],
              ].map(([number, text]) => (
                <div
                  key={number}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    padding: "15px 16px",
                    borderRadius: 18,
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 12,
                      background: "#1473ff",
                      color: "#fff",
                      fontWeight: 950,
                    }}
                  >
                    {number}
                  </span>
                  <strong>{text}</strong>
                </div>
              ))}
            </div>
          </section>

          <aside
            style={{
              border: "1px solid rgba(251,191,36,0.32)",
              borderRadius: 36,
              padding: 34,
              background:
                "radial-gradient(circle at top right, rgba(251,191,36,0.24), transparent 38%), rgba(255,255,255,0.06)",
              boxShadow: "0 28px 90px rgba(0,0,0,0.32)",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 38,
                padding: "0 14px",
                borderRadius: 999,
                background: "rgba(239,68,68,0.18)",
                color: "#fca5a5",
                fontWeight: 900,
                fontSize: 13,
              }}
            >
              Technician hiring stays front and center
            </div>

            <h2 style={{ margin: "22px 0 10px", fontSize: 34, lineHeight: 1.02 }}>
              Enrollment should feel easy because the dealer is not doing the heavy lifting.
            </h2>

            <p style={{ margin: 0, color: "#bfd6f5", lineHeight: 1.65 }}>
              The form below gives NATA enough context to set up the pipeline,
              prioritize hard-to-find technician roles, and route candidates to
              the right dealership contact.
            </p>

            <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
              <EnrollmentSignal label="Best first path" value="Service + technician pipeline" />
              <EnrollmentSignal label="Dealer effort" value="Minimal setup" />
              <EnrollmentSignal label="Next step" value="NATA enrollment review" />
            </div>
          </aside>
        </div>

        <form
          name="nata-dealer-enrollment"
          method="post"
          action="/dealer-demo"
          style={{
            marginTop: 22,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 34,
            padding: 32,
            background: "rgba(255,255,255,0.055)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.26)",
          }}
        >
          <input type="hidden" name="form-name" value="nata-dealer-enrollment" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              alignItems: "flex-end",
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Intake form
              </div>
              <h2 style={{ margin: 0, fontSize: 34, lineHeight: 1.05 }}>
                Dealership setup details
              </h2>
            </div>
            <span className="trust-pill">Takes about 2 minutes</span>
          </div>

          <div className="enrollment-form-grid">
            <FormField label="Dealership name" name="dealershipName" placeholder="Brenham CDJR" />
            <FormField label="Website" name="website" placeholder="https://yourdealership.com" />
            <FormField label="City" name="city" placeholder="Brenham" />
            <FormField label="State" name="state" placeholder="TX" />
            <FormField label="Primary contact" name="primaryContact" placeholder="Name" />
            <FormField label="Email" name="email" type="email" placeholder="name@dealership.com" />
            <FormField label="Phone" name="phone" type="tel" placeholder="(555) 555-5555" />

            <label style={{ display: "grid", gap: 9 }}>
              <span style={{ color: "#bfd6f5", fontWeight: 800 }}>Your role</span>
              <select
                name="dealerRole"
                style={inputStyle}
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select role
                </option>
                {dealershipRoles.map((role) => (
                  <option value={role} key={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 9 }}>
              <span style={{ color: "#bfd6f5", fontWeight: 800 }}>Dealer group size</span>
              <select
                name="dealerGroupSize"
                style={inputStyle}
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select size
                </option>
                {volumeOptions.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <FormField label="Monthly hiring target" name="monthlyHiringTarget" placeholder="Example: 4–8 hires" />
          </div>

          <div className="enrollment-choice-grid">
            <ChoiceGroup title="Priority roles" name="priorityRoles" options={priorityNeeds} />
            <ChoiceGroup title="Important setup signals" name="setupSignals" options={certificationNeeds} />
          </div>

          <label style={{ display: "grid", gap: 9, marginTop: 22 }}>
            <span style={{ color: "#bfd6f5", fontWeight: 800 }}>
              What would make this immediately valuable for your store?
            </span>
            <textarea
              name="notes"
              rows={5}
              placeholder="Example: We need certified technicians, service advisors, and less wasted manager time chasing applicants."
              style={{ ...inputStyle, resize: "vertical", minHeight: 132, lineHeight: 1.5 }}
            />
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 18,
              flexWrap: "wrap",
              marginTop: 26,
              paddingTop: 24,
              borderTop: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <p style={{ margin: 0, maxWidth: 680, color: "#bfd6f5", lineHeight: 1.55 }}>
              Submitting this starts the enrollment path. Pricing should come after
              the dealership sees how NATA removes work from recruiting, screening,
              technician qualification, and interview coordination.
            </p>

            <button className="btn btn-primary" type="submit">
              Start enrollment
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function EnrollmentSignal({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        padding: "15px 16px",
        borderRadius: 18,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <span style={{ color: "#bfd6f5" }}>{label}</span>
      <strong style={{ textAlign: "right" }}>{value}</strong>
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
}) {
  return (
    <label style={{ display: "grid", gap: 9 }}>
      <span style={{ color: "#bfd6f5", fontWeight: 800 }}>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={name !== "website"}
        style={inputStyle}
      />
    </label>
  );
}

function ChoiceGroup({
  title,
  name,
  options,
}: {
  title: string;
  name: string;
  options: string[];
}) {
  return (
    <section
      style={{
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 24,
        padding: 22,
        background: "rgba(255,255,255,0.045)",
      }}
    >
      <h3 style={{ margin: "0 0 14px", fontSize: 22 }}>{title}</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {options.map((option) => (
          <label
            key={option}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 13px",
              borderRadius: 16,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#d7e8ff",
              fontWeight: 700,
            }}
          >
            <input type="checkbox" name={name} value={option} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

const inputStyle = {
  width: "100%",
  minHeight: 52,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  padding: "0 15px",
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
} as const;
