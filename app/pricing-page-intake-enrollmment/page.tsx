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

const enrollmentSteps = [
  {
    number: "01",
    title: "Store context",
    copy: "Tell us the dealership, location, contact, and hiring pressure.",
  },
  {
    number: "02",
    title: "Role priorities",
    copy: "Select the roles, certifications, and screening needs that matter now.",
  },
  {
    number: "03",
    title: "NATA handoff",
    copy: "We prepare the enrollment review and set up the hiring pipeline.",
  },
];

const proofPoints = [
  {
    label: "Best first path",
    value: "Service + technician pipeline",
  },
  {
    label: "Dealer effort",
    value: "Minimal setup",
  },
  {
    label: "Next step",
    value: "NATA enrollment review",
  },
];

export default function PricingIntakePage() {
  return (
    <main className="shell">
      <Nav />

      <section style={pageWrap}>
        <div style={heroGrid} className="pricing-intake-grid">
          <section style={heroPanel}>
            <div style={toplineRow}>
              <div className="eyebrow">Dealer enrollment</div>
              <span style={statusPill}>2 minute setup</span>
            </div>

            <h1 style={heroTitle}>
              Start with the roles your store needs filled.
            </h1>

            <p className="lede" style={heroLead}>
              NATA Today captures the dealership context that actually drives hiring:
              priority roles, technician certification needs, interview volume, and
              where qualified candidates should go next.
            </p>

            <div style={stepGrid}>
              {enrollmentSteps.map((step) => (
                <div key={step.number} style={stepCard}>
                  <span style={stepNumber}>{step.number}</span>
                  <div>
                    <strong style={stepTitle}>{step.title}</strong>
                    <p style={stepCopy}>{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside style={insightPanel}>
            <div style={priorityBadge}>Technician hiring stays front and center</div>

            <h2 style={insightTitle}>
              Enrollment should feel easy because the dealer is not doing the heavy lifting.
            </h2>

            <p style={insightCopy}>
              This intake gives NATA enough context to set up the pipeline, prioritize
              hard-to-find roles, and route candidates to the right dealership contact
              without forcing the dealer to build the hiring system themselves.
            </p>

            <div style={signalStack}>
              {proofPoints.map((point) => (
                <EnrollmentSignal
                  key={point.label}
                  label={point.label}
                  value={point.value}
                />
              ))}
            </div>
          </aside>
        </div>

        <form
          name="nata-dealer-enrollment"
          method="post"
          action="/dealer-demo"
          style={formPanel}
        >
          <input type="hidden" name="form-name" value="nata-dealer-enrollment" />

          <div style={formHeader}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Intake form
              </div>
              <h2 style={formTitle}>Dealership setup details</h2>
              <p style={formIntro}>
                Give NATA the practical signals needed to prepare the enrollment
                handoff and reduce recruiting friction from day one.
              </p>
            </div>

            <div style={formHeaderCard}>
              <span style={formHeaderCardLabel}>Primary outcome</span>
              <strong style={formHeaderCardValue}>Qualified candidate routing</strong>
            </div>
          </div>

          <div style={sectionBand}>
            <span style={sectionKicker}>Store information</span>
            <div className="enrollment-form-grid" style={formGrid}>
              <FormField
                label="Dealership name"
                name="dealershipName"
                placeholder="Brenham CDJR"
              />
              <FormField
                label="Website"
                name="website"
                placeholder="https://yourdealership.com"
                required={false}
              />
              <FormField label="City" name="city" placeholder="Brenham" />
              <FormField label="State" name="state" placeholder="TX" />
            </div>
          </div>

          <div style={sectionBand}>
            <span style={sectionKicker}>Hiring contact</span>
            <div className="enrollment-form-grid" style={formGrid}>
              <FormField
                label="Primary contact"
                name="primaryContact"
                placeholder="Name"
              />
              <FormField
                label="Email"
                name="email"
                type="email"
                placeholder="name@dealership.com"
              />
              <FormField
                label="Phone"
                name="phone"
                type="tel"
                placeholder="(555) 555-5555"
              />

              <SelectField
                label="Your role"
                name="dealerRole"
                placeholder="Select role"
                options={dealershipRoles}
              />
            </div>
          </div>

          <div style={sectionBand}>
            <span style={sectionKicker}>Hiring pressure</span>
            <div className="enrollment-form-grid" style={formGrid}>
              <SelectField
                label="Dealer group size"
                name="dealerGroupSize"
                placeholder="Select size"
                options={volumeOptions}
              />
              <FormField
                label="Monthly hiring target"
                name="monthlyHiringTarget"
                placeholder="Example: 4–8 hires"
              />
            </div>
          </div>

          <div className="enrollment-choice-grid" style={choiceGrid}>
            <ChoiceGroup
              title="Priority roles"
              description="Choose the positions NATA should prioritize first."
              name="priorityRoles"
              options={priorityNeeds}
            />
            <ChoiceGroup
              title="Important setup signals"
              description="Tell us which screening and qualification signals matter."
              name="setupSignals"
              options={certificationNeeds}
            />
          </div>

          <label style={notesWrap}>
            <span style={fieldLabel}>
              What would make this immediately valuable for your store?
            </span>
            <textarea
              name="notes"
              rows={5}
              placeholder="Example: We need certified technicians, service advisors, and less wasted manager time chasing applicants."
              style={textareaStyle}
            />
          </label>

          <div style={submitBand}>
            <div style={submitCopyWrap}>
              <strong style={submitHeadline}>Start the enrollment path.</strong>
              <p style={submitCopy}>
                Pricing should come after the dealership sees how NATA removes
                work from recruiting, screening, technician qualification, and
                interview coordination.
              </p>
            </div>

            <button className="btn btn-primary" type="submit" style={submitButton}>
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
    <div style={signalCard}>
      <span style={signalLabel}>{label}</span>
      <strong style={signalValue}>{value}</strong>
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        style={inputStyle}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  placeholder,
  options,
}: {
  label: string;
  name: string;
  placeholder: string;
  options: string[];
}) {
  return (
    <label style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>
      <select name={name} style={inputStyle} defaultValue="" required>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChoiceGroup({
  title,
  description,
  name,
  options,
}: {
  title: string;
  description: string;
  name: string;
  options: string[];
}) {
  return (
    <section style={choicePanel}>
      <div style={choiceHeader}>
        <h3 style={choiceTitle}>{title}</h3>
        <p style={choiceDescription}>{description}</p>
      </div>

      <div style={choiceList}>
        {options.map((option) => (
          <label key={option} style={choiceItem}>
            <input type="checkbox" name={name} value={option} style={checkboxStyle} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

const pageWrap = {
  width: "min(1180px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "54px 0 90px",
} as const;

const heroGrid = {
  display: "grid",
  gridTemplateColumns: "1.08fr 0.92fr",
  gap: 22,
  alignItems: "stretch",
} as const;

const heroPanel = {
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.13)",
  borderRadius: 38,
  padding: 42,
  background:
    "radial-gradient(circle at 88% 8%, rgba(20,115,255,0.30), transparent 34%), radial-gradient(circle at 8% 100%, rgba(251,191,36,0.12), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.035))",
  boxShadow: "0 32px 100px rgba(0,0,0,0.36)",
} as const;

const toplineRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginBottom: 18,
} as const;

const statusPill = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "0 13px",
  borderRadius: 999,
  background: "rgba(20,115,255,0.16)",
  border: "1px solid rgba(93,164,255,0.30)",
  color: "#d8eaff",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: "0.02em",
} as const;

const heroTitle = {
  margin: 0,
  maxWidth: 850,
  fontSize: "clamp(48px, 6vw, 82px)",
  lineHeight: 0.94,
  letterSpacing: "-0.065em",
} as const;

const heroLead = {
  maxWidth: 760,
  marginTop: 20,
  color: "#d7e8ff",
} as const;

const stepGrid = {
  display: "grid",
  gap: 12,
  marginTop: 32,
} as const;

const stepCard = {
  display: "grid",
  gridTemplateColumns: "54px 1fr",
  gap: 15,
  alignItems: "start",
  padding: "17px 18px",
  borderRadius: 22,
  background: "rgba(255,255,255,0.075)",
  border: "1px solid rgba(255,255,255,0.11)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
} as const;

const stepNumber = {
  width: 44,
  height: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 16,
  background: "linear-gradient(145deg, #1473ff, #0b4fc2)",
  color: "#fff",
  fontWeight: 950,
  fontSize: 13,
} as const;

const stepTitle = {
  display: "block",
  fontSize: 17,
  color: "#ffffff",
} as const;

const stepCopy = {
  margin: "5px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.45,
  fontSize: 14,
} as const;

const insightPanel = {
  border: "1px solid rgba(251,191,36,0.30)",
  borderRadius: 38,
  padding: 34,
  background:
    "radial-gradient(circle at top right, rgba(251,191,36,0.22), transparent 38%), linear-gradient(145deg, rgba(255,255,255,0.095), rgba(255,255,255,0.035))",
  boxShadow: "0 32px 100px rgba(0,0,0,0.34)",
} as const;

const priorityBadge = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  background: "rgba(239,68,68,0.16)",
  border: "1px solid rgba(252,165,165,0.22)",
  color: "#fca5a5",
  fontWeight: 950,
  fontSize: 13,
} as const;

const insightTitle = {
  margin: "22px 0 10px",
  fontSize: 35,
  lineHeight: 1.02,
  letterSpacing: "-0.035em",
} as const;

const insightCopy = {
  margin: 0,
  color: "#bfd6f5",
  lineHeight: 1.65,
} as const;

const signalStack = {
  display: "grid",
  gap: 12,
  marginTop: 24,
} as const;

const signalCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 14,
  padding: "16px 17px",
  borderRadius: 20,
  background: "rgba(255,255,255,0.075)",
  border: "1px solid rgba(255,255,255,0.10)",
} as const;

const signalLabel = {
  color: "#bfd6f5",
  fontSize: 14,
} as const;

const signalValue = {
  textAlign: "right",
  color: "#ffffff",
  fontSize: 14,
} as const;

const formPanel = {
  marginTop: 24,
  border: "1px solid rgba(255,255,255,0.13)",
  borderRadius: 38,
  padding: 32,
  background:
    "radial-gradient(circle at 10% 0%, rgba(20,115,255,0.14), transparent 30%), rgba(255,255,255,0.058)",
  boxShadow: "0 28px 90px rgba(0,0,0,0.28)",
} as const;

const formHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start",
  flexWrap: "wrap",
  marginBottom: 24,
} as const;

const formTitle = {
  margin: 0,
  fontSize: 36,
  lineHeight: 1.05,
  letterSpacing: "-0.035em",
} as const;

const formIntro = {
  margin: "10px 0 0",
  maxWidth: 690,
  color: "#bfd6f5",
  lineHeight: 1.55,
} as const;

const formHeaderCard = {
  minWidth: 260,
  padding: "16px 18px",
  borderRadius: 22,
  background: "rgba(20,115,255,0.13)",
  border: "1px solid rgba(93,164,255,0.24)",
} as const;

const formHeaderCardLabel = {
  display: "block",
  color: "#9fc8ff",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
} as const;

const formHeaderCardValue = {
  display: "block",
  color: "#ffffff",
  fontSize: 18,
} as const;

const sectionBand = {
  marginTop: 18,
  padding: 20,
  borderRadius: 26,
  background: "rgba(255,255,255,0.038)",
  border: "1px solid rgba(255,255,255,0.08)",
} as const;

const sectionKicker = {
  display: "block",
  marginBottom: 14,
  color: "#facc15",
  fontSize: 12,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.11em",
} as const;

const formGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
} as const;

const fieldWrap = {
  display: "grid",
  gap: 9,
} as const;

const fieldLabel = {
  color: "#d7e8ff",
  fontWeight: 850,
  fontSize: 14,
} as const;

const inputStyle = {
  width: "100%",
  minHeight: 54,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.085)",
  color: "#ffffff",
  padding: "0 15px",
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
} as const;

const choiceGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  marginTop: 18,
} as const;

const choicePanel = {
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 28,
  padding: 22,
  background: "rgba(255,255,255,0.045)",
} as const;

const choiceHeader = {
  marginBottom: 16,
} as const;

const choiceTitle = {
  margin: 0,
  fontSize: 23,
  letterSpacing: "-0.02em",
} as const;

const choiceDescription = {
  margin: "6px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.45,
  fontSize: 14,
} as const;

const choiceList = {
  display: "grid",
  gap: 10,
} as const;

const choiceItem = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  padding: "13px 14px",
  borderRadius: 17,
  background: "rgba(255,255,255,0.065)",
  border: "1px solid rgba(255,255,255,0.085)",
  color: "#d7e8ff",
  fontWeight: 750,
  cursor: "pointer",
} as const;

const checkboxStyle = {
  width: 16,
  height: 16,
  accentColor: "#1473ff",
} as const;

const notesWrap = {
  display: "grid",
  gap: 9,
  marginTop: 22,
} as const;

const textareaStyle = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 138,
  padding: "15px",
  lineHeight: 1.5,
} as const;

const submitBand = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  flexWrap: "wrap",
  marginTop: 26,
  paddingTop: 24,
  borderTop: "1px solid rgba(255,255,255,0.10)",
} as const;

const submitCopyWrap = {
  maxWidth: 700,
} as const;

const submitHeadline = {
  display: "block",
  color: "#ffffff",
  fontSize: 18,
  marginBottom: 5,
} as const;

const submitCopy = {
  margin: 0,
  color: "#bfd6f5",
  lineHeight: 1.55,
} as const;

const submitButton = {
  minHeight: 54,
  padding: "0 28px",
  fontWeight: 950,
} as const;
