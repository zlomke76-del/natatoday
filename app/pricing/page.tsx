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

      <section className="wrap" style={{ padding: "54px 0 90px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.95fr) minmax(340px, 0.75fr)",
            gap: 34,
            alignItems: "start",
          }}
        >
          <div>
            <div className="eyebrow">Dealer enrollment</div>

            <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>
              Get your dealership pipeline set up.
            </h1>

            <p className="lede">
              Tell us what roles your store needs filled. We configure the
              recruiting, screening, and candidate-prep pipeline around your
              dealership before your managers waste time on the wrong interviews.
            </p>

            <div
              style={{
                marginTop: 26,
                padding: 24,
                borderRadius: 24,
                background:
                  "linear-gradient(145deg, rgba(20,115,255,0.16), rgba(255,255,255,0.045))",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                style={{
                  color: "#fbbf24",
                  fontSize: 12,
                  fontWeight: 950,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                What you are buying
              </div>

              <h2
                style={{
                  margin: 0,
                  color: "#fff",
                  fontSize: 30,
                  lineHeight: 1,
                  letterSpacing: "-0.045em",
                }}
              >
                A prepared candidate pipeline — not another applicant pile.
              </h2>

              <p
                style={{
                  margin: "14px 0 0",
                  color: "#cfe2ff",
                  lineHeight: 1.6,
                  fontSize: 15,
                }}
              >
                We help pre-screen, organize, and prepare candidates so your
                team meets people who already have context, role fit, and
                readiness signals attached.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginTop: 16,
              }}
            >
              <ProofCard title="Pre-screened" copy="Candidates reviewed before handoff." />
              <ProofCard title="Prepared" copy="Role fit and readiness made visible." />
              <ProofCard title="Scheduled" copy="Your team meets the right people." />
            </div>
          </div>

          <aside
            style={{
              padding: 24,
              borderRadius: 24,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
            }}
          >
            <div
              style={{
                color: "#fbbf24",
                fontSize: 12,
                fontWeight: 950,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Enrollment starts here
            </div>

            <h2
              style={{
                margin: 0,
                color: "#fff",
                fontSize: 28,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              Takes about 60 seconds.
            </h2>

            <p style={{ color: "#cfe2ff", lineHeight: 1.55, marginTop: 12 }}>
              After submission, we review your store needs and show you the
              right setup path.
            </p>

            <div
              style={{
                display: "grid",
                gap: 10,
                marginTop: 18,
                color: "#d7e8ff",
                fontSize: 14,
              }}
            >
              <span>✓ Technician and sales roles supported</span>
              <span>✓ Dealer group setup available</span>
              <span>✓ Interview-ready handoff focus</span>
            </div>
          </aside>
        </div>

        <form
          style={{
            marginTop: 34,
            padding: 28,
            borderRadius: 24,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <SectionHeader
            kicker="Step 1"
            title="Store information"
            copy="Basic dealership details so we can configure the pipeline around the right store or group."
          />

          <div className="grid-2" style={{ gap: 16, marginTop: 18 }}>
            <FormField label="Dealership name" name="dealershipName" />
            <FormField label="Website" name="website" required={false} />
            <FormField label="City" name="city" />
            <FormField label="State" name="state" />
            <FormField label="Contact name" name="contact" />
            <FormField label="Email" name="email" type="email" />
            <FormField label="Phone" name="phone" />
          </div>

          <div
            style={{
              height: 1,
              background: "rgba(255,255,255,0.1)",
              margin: "28px 0",
            }}
          />

          <SectionHeader
            kicker="Step 2"
            title="Hiring focus"
            copy="Tell us where the pressure is: technicians, advisors, sales, BDC, parts, or multiple roles."
          />

          <div className="grid-2" style={{ gap: 16, marginTop: 18 }}>
            <SelectField label="Your role" name="role" options={dealershipRoles} />
            <SelectField label="Dealer group size" name="size" options={volumeOptions} />
          </div>

          <div style={{ marginTop: 24 }}>
            <ChoiceGroup title="Priority roles" name="priorityRoles" options={priorityNeeds} />
          </div>

          <div style={{ marginTop: 20 }}>
            <ChoiceGroup title="Important signals" name="signals" options={certificationNeeds} />
          </div>

          <div style={{ marginTop: 24 }}>
            <label>
              <strong>What matters most?</strong>
              <textarea
                style={inputStyle}
                rows={4}
                placeholder="Example: We need master-certified techs and fewer wasted interviews."
              />
            </label>
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button className="btn btn-primary">Start enrollment</button>

            <p style={{ margin: 0, color: "#9fb4d6", fontSize: 14 }}>
              No commitment required. We review fit first.
            </p>
          </div>
        </form>

        <div
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 20,
            background: "rgba(20,115,255,0.08)",
            border: "1px solid rgba(20,115,255,0.18)",
            color: "#cfe2ff",
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: "#fff" }}>After submission:</strong> we review
          your store needs, configure the recommended pipeline, and show you how
          candidates move from intake to prepared interview.
        </div>
      </section>
    </main>
  );
}

function SectionHeader({
  kicker,
  title,
  copy,
}: {
  kicker: string;
  title: string;
  copy: string;
}) {
  return (
    <div>
      <div
        style={{
          color: "#fbbf24",
          fontSize: 12,
          fontWeight: 950,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {kicker}
      </div>
      <h2
        style={{
          margin: 0,
          color: "#fff",
          fontSize: 28,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        {title}
      </h2>
      <p style={{ margin: "10px 0 0", color: "#bfd6f5", lineHeight: 1.55 }}>
        {copy}
      </p>
    </div>
  );
}

function ProofCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <strong style={{ display: "block", color: "#fff", fontSize: 15 }}>
        {title}
      </strong>
      <span
        style={{
          display: "block",
          marginTop: 6,
          color: "#bfd6f5",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {copy}
      </span>
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} type={type} required={required} style={inputStyle} />
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
    <label>
      <span>{label}</span>
      <select name={name} style={inputStyle} defaultValue="">
        <option value="" disabled>
          Select
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
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
    <div>
      <strong>{title}</strong>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 10,
          marginTop: 10,
        }}
      >
        {options.map((o) => (
          <label
            key={o}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "11px 12px",
              borderRadius: 12,
              background: "rgba(255,255,255,0.045)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#d7e8ff",
            }}
          >
            <input type="checkbox" name={name} value={o} /> {o}
          </label>
        ))}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginTop: 7,
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(5,10,18,0.88)",
  color: "#fff",
  outline: "none",
};
