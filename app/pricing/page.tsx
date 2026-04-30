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

const programLevels = [
  {
    name: "Starter Pipeline",
    price: "$995",
    note: "Best for one store with light-to-moderate hiring needs.",
    items: [
      "Monthly recruiting pipeline access",
      "Submit active hiring requests",
      "Sales, BDC, advisor, parts, and technician roles",
      "Candidate organization and basic screening",
      "Interview-ready handoff support",
    ],
  },
  {
    name: "Active Pipeline",
    price: "$1,295",
    badge: "Most popular",
    note: "Best for stores actively hiring across sales and fixed ops.",
    items: [
      "Everything in Starter Pipeline",
      "Expanded role request support",
      "Technician and advisor priority focus",
      "Candidate pre-screening and readiness review",
      "Ongoing pipeline movement month to month",
    ],
  },
  {
    name: "Full Pipeline Coverage",
    price: "$1,595",
    note: "Best for high-volume stores or groups with ongoing hiring pressure.",
    items: [
      "Everything in Active Pipeline",
      "Multi-role hiring request coverage",
      "Master Certified technician priority",
      "OEM / ASE visibility support",
      "Higher-touch recruiting and interview coordination",
    ],
  },
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
            <div className="eyebrow">Monthly dealer program</div>

            <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>
              Ongoing recruiting support for your dealership pipeline.
            </h1>

            <p className="lede">
              NATA Today is a monthly subscription-based recruiting and
              candidate-prep service for dealerships. Once your store is on the
              program, your team can submit hiring requests as needs change —
              technicians, advisors, sales, BDC, parts, or multiple roles.
            </p>

            <p style={{ marginTop: 14, color: "#9fb4d6", lineHeight: 1.6 }}>
              Submit hiring needs as they come up. We help keep the pipeline
              moving toward stronger, better-prepared interviews.
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
                A monthly pipeline program your store can keep using.
              </h2>

              <p
                style={{
                  margin: "14px 0 0",
                  color: "#cfe2ff",
                  lineHeight: 1.6,
                  fontSize: 15,
                }}
              >
                This is not a one-time applicant list or a static training
                package. Your dealership stays on the program month to month.
                When you need technicians, advisors, salespeople, BDC, or parts
                candidates, you submit the request and we help screen, organize,
                and prepare candidates before your managers spend time
                interviewing.
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
              <ProofCard
                title="Monthly subscription"
                copy="Ongoing recruiting pipeline support for your store."
              />
              <ProofCard
                title="Submit role requests"
                copy="Request technicians, sales, BDC, advisors, parts, or multiple roles."
              />
              <ProofCard
                title="Stronger interviews"
                copy="Candidates arrive screened, organized, and better prepared."
              />
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
              Program starts here
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
              Enroll once. Submit needs anytime.
            </h2>

            <p style={{ color: "#cfe2ff", lineHeight: 1.55, marginTop: 12 }}>
              After your dealership is on the monthly program, your team can
              request help filling specific roles as hiring pressure changes.
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
              <span>✓ Monthly subscription-based service</span>
              <span>✓ Submit hiring requests as needs change</span>
              <span>✓ Technician and sales roles supported</span>
              <span>✓ Dealer group setup available</span>
              <span>✓ Interview-ready handoff focus</span>
            </div>

            <div
              style={{
                marginTop: 22,
                paddingTop: 18,
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <Link className="btn btn-primary" href="#enrollment">
                Start my pipeline
              </Link>
            </div>
          </aside>
        </div>

        <section style={{ marginTop: 54 }}>
          <div style={{ maxWidth: 760 }}>
            <div className="eyebrow">Program levels</div>

            <h2
              style={{
                margin: 0,
                color: "#fff",
                fontSize: "clamp(36px,4vw,54px)",
                lineHeight: 1,
                letterSpacing: "-0.055em",
              }}
            >
              Pick the level of pipeline support your store needs.
            </h2>

            <p style={{ marginTop: 14, color: "#bfd6f5", lineHeight: 1.65 }}>
              Each plan runs on the same monthly recruiting pipeline model. The
              difference is how much coverage, role support, and candidate-prep
              capacity your dealership needs.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 16,
              marginTop: 24,
            }}
          >
            {programLevels.map((level) => (
              <article
                key={level.name}
                style={{
                  position: "relative",
                  padding: 24,
                  borderRadius: 24,
                  background:
                    level.badge
                      ? "linear-gradient(145deg, rgba(20,115,255,0.18), rgba(255,255,255,0.06))"
                      : "rgba(255,255,255,0.05)",
                  border: level.badge
                    ? "1px solid rgba(20,115,255,0.35)"
                    : "1px solid rgba(255,255,255,0.1)",
                  boxShadow: level.badge
                    ? "0 24px 70px rgba(20,115,255,0.16)"
                    : "none",
                }}
              >
                {level.badge ? (
                  <div
                    style={{
                      display: "inline-flex",
                      marginBottom: 14,
                      padding: "7px 10px",
                      borderRadius: 999,
                      background: "#fbbf24",
                      color: "#07101f",
                      fontSize: 11,
                      fontWeight: 950,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {level.badge}
                  </div>
                ) : null}

                <h3
                  style={{
                    margin: 0,
                    color: "#fff",
                    fontSize: 24,
                    lineHeight: 1,
                    letterSpacing: "-0.04em",
                  }}
                >
                  {level.name}
                </h3>

                <p style={{ color: "#bfd6f5", lineHeight: 1.5, minHeight: 64 }}>
                  {level.note}
                </p>

                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 18,
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#fff",
                      fontSize: 34,
                      letterSpacing: "-0.05em",
                    }}
                  >
                    {level.price}
                    <span
                      style={{
                        color: "#9fb4d6",
                        fontSize: 15,
                        letterSpacing: 0,
                      }}
                    >
                      /month
                    </span>
                  </strong>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    marginTop: 18,
                    color: "#d7e8ff",
                    fontSize: 14,
                    lineHeight: 1.45,
                  }}
                >
                  {level.items.map((item) => (
                    <span key={item}>✓ {item}</span>
                  ))}
                </div>

                <Link
                  className="btn btn-primary"
                  href="#enrollment"
                  style={{ width: "100%", marginTop: 24 }}
                >
                  Start my pipeline
                </Link>
              </article>
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              padding: 18,
              borderRadius: 18,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#cfe2ff",
              fontSize: 14,
              lineHeight: 1.55,
            }}
          >
            <strong style={{ color: "#fff" }}>Simple model:</strong> monthly
            subscription, ongoing pipeline support, and hiring requests submitted
            as your dealership’s needs change.
          </div>
        </section>

        <form
          id="enrollment"
          style={{
            marginTop: 44,
            padding: 28,
            borderRadius: 24,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <SectionHeader
            kicker="Step 1"
            title="Store information"
            copy="Basic dealership details so we can configure the monthly pipeline program around the right store or group."
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
            copy="Tell us where the pressure is now. Once enrolled, your dealership can continue submitting role requests as needs change."
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
            <button className="btn btn-primary">Start my pipeline</button>

            <p style={{ margin: 0, color: "#9fb4d6", fontSize: 14 }}>
              Month-to-month program. No long-term commitment required.
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
          your store needs, confirm the right monthly program level, and show you
          how candidates move from request to screening to prepared interview.
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
