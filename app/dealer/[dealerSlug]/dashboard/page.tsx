import Link from "next/link";
import Nav from "../../../components/Nav";

type PageProps = {
  params: {
    dealerSlug: string;
  };
};

const roleOptions = [
  "Sales Consultant",
  "Service Technician",
  "Service Advisor",
  "BDC Representative",
  "Parts Advisor",
  "Finance Manager",
];

const priorityOptions = ["Standard", "Urgent", "Pipeline build"];

const paySuggestions: Record<string, string> = {
  "Sales Consultant": "$45,000–$95,000 / year",
  "Service Technician": "$28–$45 / hour",
  "Service Advisor": "$55,000–$95,000 / year",
  "BDC Representative": "$18–$24 / hour + bonus",
  "Parts Advisor": "$20–$30 / hour",
  "Finance Manager": "$95,000–$180,000 / year",
};

const demoRequests = [
  {
    role: "Service Technician",
    priority: "Urgent",
    pay: "$32–$45 / hour",
    status: "Job post generating",
    candidates: 7,
    ready: 2,
  },
  {
    role: "Sales Consultant",
    priority: "Standard",
    pay: "$55,000–$95,000 / year",
    status: "Candidates under review",
    candidates: 12,
    ready: 4,
  },
];

const governedCandidates = [
  {
    name: "Maria Lopez",
    role: "Sales Consultant",
    signal: "READY",
    detail: "Communication fit, availability, and sales background verified.",
    notes: ["Interview ready", "Retail experience present", "Availability confirmed"],
  },
  {
    name: "James Carter",
    role: "Service Technician",
    signal: "CONDITIONAL",
    detail: "Experience is strong, but certification evidence needs confirmation.",
    notes: ["8 years experience", "Certification unclear", "Dealer review required"],
  },
  {
    name: "Tyler Ng",
    role: "Service Technician",
    signal: "MORE_STATE_NEEDED",
    detail: "Candidate cannot be advanced until missing training and availability data are collected.",
    notes: ["Entry-level pathway", "Training incomplete", "Availability missing"],
  },
];

function formatDealerName(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function DealerDashboardPage({ params }: PageProps) {
  const dealerName = formatDealerName(params.dealerSlug);

  return (
    <main className="shell">
      <Nav />

      <section className="wrap" style={{ padding: "46px 0 90px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 24,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 760 }}>
            <div className="eyebrow">Dealer Operating View</div>

            <h1 style={{ fontSize: "clamp(44px,6vw,72px)", lineHeight: 0.95 }}>
              {dealerName} hiring pipeline.
            </h1>

            <p className="lede">
              Submit hiring requests, review active role pipelines, and see
              Solace-governed candidate readiness before your team spends time
              interviewing.
            </p>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 20,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              minWidth: 240,
            }}
          >
            <strong style={{ color: "#fff", display: "block" }}>{dealerName}</strong>
            <span style={{ color: "#9fb4d6", display: "block", marginTop: 6 }}>
              Monthly pipeline program active
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(360px, 0.7fr)",
            gap: 22,
            marginTop: 34,
            alignItems: "start",
          }}
        >
          <section
            style={{
              padding: 28,
              borderRadius: 26,
              background:
                "linear-gradient(145deg, rgba(20,115,255,0.14), rgba(255,255,255,0.045))",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              New hiring request
            </div>

            <h2
              style={{
                margin: 0,
                color: "#fff",
                fontSize: 34,
                lineHeight: 1,
                letterSpacing: "-0.045em",
              }}
            >
              Tell us what you need filled.
            </h2>

            <p style={{ color: "#bfd6f5", lineHeight: 1.6, marginTop: 12 }}>
              The dealership is already known. This request creates the job
              post, prepares distribution, and opens the Solace review pipeline.
            </p>

            <form style={{ marginTop: 24 }}>
              <div className="grid-2" style={{ gap: 16 }}>
                <Field label="Role needed">
                  <select name="role" defaultValue="" style={inputStyle}>
                    <option value="" disabled>
                      Select role
                    </option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Priority">
                  <select name="priority" defaultValue="Standard" style={inputStyle}>
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Target pay range">
                  <input
                    name="payRange"
                    placeholder="Example: $55,000–$95,000 / year"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Need by">
                  <input name="needBy" type="date" style={inputStyle} />
                </Field>
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.055)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#cfe2ff",
                  lineHeight: 1.55,
                  fontSize: 14,
                }}
              >
                <strong style={{ color: "#fff" }}>Suggested ranges:</strong>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  {Object.entries(paySuggestions).map(([role, pay]) => (
                    <span key={role}>
                      {role}: <strong style={{ color: "#fff" }}>{pay}</strong>
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <Field label="Notes for this request">
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Example: Need strong closers, Saturday availability, Spanish preferred, dealership experience helpful."
                    style={inputStyle}
                  />
                </Field>
              </div>

              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <button className="btn btn-primary" type="button">
                  Create hiring request
                </button>

                <span style={{ color: "#9fb4d6", fontSize: 14 }}>
                  Creates job post draft + governed review workflow.
                </span>
              </div>
            </form>
          </section>

          <aside
            style={{
              padding: 24,
              borderRadius: 26,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              Solace Governance
            </div>

            <h2
              style={{
                margin: 0,
                color: "#fff",
                fontSize: 30,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              AI assists. Solace governs.
            </h2>

            <p style={{ color: "#cfe2ff", lineHeight: 1.6 }}>
              Candidate review is not just a score. Solace checks whether the
              available state supports the label before a candidate is advanced.
            </p>

            <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
              <GovernancePill title="READY" copy="State supports interview handoff." />
              <GovernancePill
                title="CONDITIONAL"
                copy="Promising candidate, but review needed."
              />
              <GovernancePill
                title="MORE_STATE_NEEDED"
                copy="Missing evidence blocks advancement."
              />
            </div>
          </aside>
        </div>

        <section style={{ marginTop: 36 }}>
          <div className="eyebrow">Active role requests</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              marginTop: 16,
            }}
          >
            {demoRequests.map((request) => (
              <article
                key={request.role}
                style={{
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        color: "#fff",
                        fontSize: 24,
                        lineHeight: 1,
                        letterSpacing: "-0.035em",
                      }}
                    >
                      {request.role}
                    </h3>
                    <p style={{ margin: "8px 0 0", color: "#bfd6f5" }}>
                      {request.pay}
                    </p>
                  </div>

                  <span
                    style={{
                      padding: "8px 10px",
                      borderRadius: 999,
                      background: "rgba(251,191,36,0.14)",
                      color: "#fbbf24",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {request.priority}
                  </span>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                    marginTop: 18,
                  }}
                >
                  <Metric label="Candidates" value={request.candidates} />
                  <Metric label="Ready" value={request.ready} />
                  <Metric label="Status" value="Active" />
                </div>

                <p style={{ color: "#9fb4d6", margin: "16px 0 0" }}>
                  {request.status}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Governed candidate flow</div>

          <div
            style={{
              display: "grid",
              gap: 14,
              marginTop: 16,
            }}
          >
            {governedCandidates.map((candidate) => (
              <article
                key={candidate.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 20,
                  alignItems: "start",
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      color: "#fff",
                      fontSize: 22,
                      letterSpacing: "-0.035em",
                    }}
                  >
                    {candidate.name}
                  </h3>

                  <p style={{ margin: "6px 0 0", color: "#bfd6f5" }}>
                    {candidate.role}
                  </p>

                  <p style={{ color: "#9fb4d6", lineHeight: 1.55 }}>
                    {candidate.detail}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginTop: 12,
                    }}
                  >
                    {candidate.notes.map((note) => (
                      <span
                        key={note}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.055)",
                          border: "1px solid rgba(255,255,255,0.09)",
                          color: "#d7e8ff",
                          fontSize: 13,
                        }}
                      >
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                <StatusBadge status={candidate.signal} />
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span style={{ color: "#d7e8ff", fontWeight: 800 }}>{label}</span>
      {children}
    </label>
  );
}

function GovernancePill({ title, copy }: { title: string; copy: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <strong style={{ color: "#fff", display: "block" }}>{title}</strong>
      <span
        style={{
          color: "#bfd6f5",
          display: "block",
          marginTop: 4,
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {copy}
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <strong style={{ display: "block", color: "#fff", fontSize: 20 }}>
        {value}
      </strong>
      <span style={{ display: "block", color: "#9fb4d6", fontSize: 12 }}>
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "READY"
      ? {
          background: "rgba(34,197,94,0.14)",
          border: "1px solid rgba(34,197,94,0.28)",
          color: "#86efac",
        }
      : status === "CONDITIONAL"
      ? {
          background: "rgba(251,191,36,0.14)",
          border: "1px solid rgba(251,191,36,0.28)",
          color: "#fbbf24",
        }
      : {
          background: "rgba(96,165,250,0.14)",
          border: "1px solid rgba(96,165,250,0.28)",
          color: "#93c5fd",
        };

  return (
    <span
      style={{
        ...style,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 148,
        minHeight: 42,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        letterSpacing: "0.08em",
      }}
    >
      {status}
    </span>
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
