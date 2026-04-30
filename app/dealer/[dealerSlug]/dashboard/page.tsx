import Link from "next/link";
import { redirect } from "next/navigation";
import Nav from "../../../components/Nav";

type PageProps = {
  params: {
    dealerSlug: string;
  };
  searchParams?: {
    request?: string;
    role?: string;
    decision?: string;
    candidate?: string;
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
  "Sales Consultant": "$45,000 - $95,000 per year",
  "Service Technician": "$28 - $45 per hour",
  "Service Advisor": "$55,000 - $95,000 per year",
  "BDC Representative": "$18 - $24 per hour + bonus",
  "Parts Advisor": "$20 - $30 per hour",
  "Finance Manager": "$95,000 - $180,000 per year",
};

const openRequests = [
  {
    role: "Service Technician",
    priority: "Urgent",
    pay: "$32 - $45 per hour",
    status: "In progress",
    candidates: 7,
    ready: 2,
    nextStep: "Reviewing certified technician candidates",
  },
  {
    role: "Sales Consultant",
    priority: "Standard",
    pay: "$55,000 - $95,000 per year",
    status: "Interview pipeline",
    candidates: 12,
    ready: 4,
    nextStep: "Preparing shortlist for manager review",
  },
];

const filledRequests = [
  {
    role: "BDC Representative",
    filledBy: "Alyssa Grant",
    filledDate: "March 28",
    outcome: "Placed",
    notes: "Strong communication fit and schedule alignment.",
  },
  {
    role: "Parts Advisor",
    filledBy: "Marcus Reed",
    filledDate: "April 12",
    outcome: "Placed",
    notes: "Relevant parts counter experience and dealership references.",
  },
];

const reviewCandidates = [
  {
    id: "demo-maria-lopez",
    jobId: "demo-sales-consultant-job",
    applicationId: "demo-maria-lopez-application",
    name: "Maria Lopez",
    role: "Sales Consultant",
    status: "Ready for interview",
    detail: "Strong communication fit, sales background, and availability confirmed.",
    notes: ["Interview ready", "Retail sales experience", "Availability confirmed"],
    interviewStage: "Dealer manager interview",
    packet: {
      resume: "Resume on file",
      donNotes:
        "Strong phone presence, confident retail background, available weekends, compensation expectations aligned.",
      solaceSummary:
        "Recommended for dealer interview. Candidate shows strong communication, availability, and sales readiness signals.",
      verification: ["Confirm Saturday schedule", "Review prior sales volume", "Confirm start date"],
    },
  },
  {
    id: "demo-james-carter",
    jobId: "demo-service-technician-job",
    applicationId: "demo-james-carter-application",
    name: "James Carter",
    role: "Service Technician",
    status: "Needs manager review",
    detail: "Strong technician experience. Certification documentation needs final confirmation.",
    notes: ["8 years experience", "Certification pending", "Good fixed-ops fit"],
    interviewStage: "Dealer manager interview",
    packet: {
      resume: "Resume on file",
      donNotes:
        "Experienced technician with strong shop background. Needs certification documents confirmed before final offer.",
      solaceSummary:
        "Advance with verification. Candidate may be a strong service fit if credentials and availability are confirmed.",
      verification: ["Confirm ASE/OEM certifications", "Confirm tool availability", "Confirm desired flat-rate/hourly structure"],
    },
  },
  {
    id: "demo-tyler-ng",
    jobId: "demo-service-technician-job",
    applicationId: "demo-tyler-ng-application",
    name: "Tyler Ng",
    role: "Service Technician",
    status: "More information needed",
    detail: "Entry-level candidate. Training path and availability need confirmation before advancing.",
    notes: ["Entry-level pathway", "Training incomplete", "Availability missing"],
    interviewStage: "Pre-manager review",
    packet: {
      resume: "Resume on file",
      donNotes:
        "Motivated candidate, but not enough confirmed information yet for a final dealer interview recommendation.",
      solaceSummary:
        "Hold for more information. Candidate may fit a training pathway if availability and baseline skills are confirmed.",
      verification: ["Confirm schedule", "Confirm training interest", "Confirm basic tool/technical background"],
    },
  },
];

function formatDealerName(slug: string) {
  if (slug === "jersey-village-cdjr") {
    return "Jersey Village Chrysler Jeep Dodge Ram";
  }

  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDealerLocation(slug: string) {
  if (slug === "jersey-village-cdjr") return "Jersey Village, TX";
  return "Houston, TX Market";
}

function cleanFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getBaseUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return `https://${vercelUrl}`.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

export default function DealerDashboardPage({ params, searchParams }: PageProps) {
  const dealerName = formatDealerName(params.dealerSlug);
  const dealerLocation = getDealerLocation(params.dealerSlug);
  const requestSubmitted = searchParams?.request === "submitted";
  const submittedRole = searchParams?.role ? decodeURIComponent(searchParams.role) : "Hiring request";
  const decisionSubmitted = searchParams?.decision === "submitted";
  const decisionCandidate = searchParams?.candidate
    ? decodeURIComponent(searchParams.candidate)
    : "Candidate";

  async function submitHiringRequest(formData: FormData) {
    "use server";

    const title = cleanFormValue(formData.get("role"));
    const priority = cleanFormValue(formData.get("priority")) || "Standard";
    const salary = cleanFormValue(formData.get("payRange"));
    const needBy = cleanFormValue(formData.get("needBy"));
    const notes = cleanFormValue(formData.get("notes"));
    const publishMode = cleanFormValue(formData.get("publish_mode")) || "public";

    if (!title) {
      throw new Error("Role is required before a hiring request can be submitted.");
    }

    const adminKey = process.env.NATA_ADMIN_KEY;
    if (!adminKey) {
      throw new Error("Missing NATA_ADMIN_KEY. Add it to Vercel before submitting hiring requests.");
    }

    const response = await fetch(`${getBaseUrl()}/api/nata/jobs`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-nata-admin-key": adminKey,
      },
      body: JSON.stringify({
        title,
        dealer_slug: params.dealerSlug,
        location: dealerLocation,
        public_location: dealerLocation,
        public_dealer_name: dealerName,
        type: "Full-time",
        salary,
        priority,
        need_by: needBy || null,
        notes,
        request_notes: notes,
        publish_mode: publishMode,
        publish_status: "published",
        is_active: true,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Hiring request could not be published.");
    }

    redirect(
      `/dealer/${params.dealerSlug}/dashboard?request=submitted&role=${encodeURIComponent(title)}`
    );
  }

  async function submitInterviewDecision(formData: FormData) {
    "use server";

    const candidateName = cleanFormValue(formData.get("candidateName"));
    const jobId = cleanFormValue(formData.get("jobId"));
    const applicationId = cleanFormValue(formData.get("applicationId"));
    const outcome = cleanFormValue(formData.get("outcome"));
    const decisionReason = cleanFormValue(formData.get("decision_reason"));
    const interviewerName = cleanFormValue(formData.get("interviewer_name"));
    const strengths = cleanFormValue(formData.get("strengths"));
    const concerns = cleanFormValue(formData.get("concerns"));
    const verificationFlags = cleanFormValue(formData.get("verification_flags"));

    if (!outcome || !decisionReason) {
      throw new Error("Decision outcome and why are required.");
    }

    const adminKey = process.env.NATA_ADMIN_KEY;
    if (!adminKey) {
      throw new Error("Missing NATA_ADMIN_KEY. Add it to Vercel before submitting interview decisions.");
    }

    const response = await fetch(`${getBaseUrl()}/api/nata/decisions`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "x-nata-admin-key": adminKey,
      },
      body: JSON.stringify({
        job_id: jobId,
        application_id: applicationId,
        interviewer_name: interviewerName || "Dealer manager",
        interview_type: "dealer",
        interview_stage: "2",
        outcome,
        decision_reason: decisionReason,
        strengths: strengths ? strengths.split("\n").map((item) => item.trim()).filter(Boolean) : [],
        concerns: concerns ? concerns.split("\n").map((item) => item.trim()).filter(Boolean) : [],
        verification_flags: verificationFlags
          ? verificationFlags.split("\n").map((item) => item.trim()).filter(Boolean)
          : [],
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.error || "Interview decision could not be saved.");
    }

    redirect(
      `/dealer/${params.dealerSlug}/dashboard?decision=submitted&candidate=${encodeURIComponent(candidateName || "Candidate")}`
    );
  }

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
              Submit hiring requests, track open roles, review qualified candidates,
              and document final interview outcomes. Our team handles the posting,
              screening, candidate routing, and interview packet preparation.
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

        {requestSubmitted ? (
          <SuccessNotice
            title={`${submittedRole} request received.`}
            copy="NATA Today will handle the job posting, candidate intake, screening, and routing. Qualified candidates will appear in your review pipeline when ready."
          />
        ) : null}

        {decisionSubmitted ? (
          <SuccessNotice
            title={`${decisionCandidate} decision recorded.`}
            copy="The interview outcome and reason have been documented. If the candidate was marked hired, the public listing will be closed by the decision workflow."
          />
        ) : null}

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
              Submit the role, pay range, urgency, visibility preference, and notes.
              NATA Today formats the post, handles publication, and opens the candidate review pipeline.
            </p>

            <form action={submitHiringRequest} style={{ marginTop: 24 }}>
              <div className="grid-2" style={{ gap: 16 }}>
                <Field label="Role needed">
                  <select name="role" defaultValue="" required style={inputStyle}>
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
                    placeholder="Example: $55,000 - $95,000 per year"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Need by">
                  <input name="needBy" type="date" style={inputStyle} />
                </Field>

                <Field label="Publishing mode">
                  <select name="publish_mode" defaultValue="public" style={inputStyle}>
                    <option value="public">Public dealership posting</option>
                    <option value="confidential">Confidential search</option>
                  </select>
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
                <strong style={{ color: "#fff" }}>Suggested pay ranges:</strong>
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
                <button className="btn btn-primary" type="submit">
                  Send request to NATA team
                </button>

                <span style={{ color: "#9fb4d6", fontSize: 14 }}>
                  Your team does not need to build or review the public post.
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
              Review standards
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
              Candidates are reviewed before handoff.
            </h2>

            <p style={{ color: "#cfe2ff", lineHeight: 1.6 }}>
              Your managers should not have to sort every applicant. Candidates
              are organized by fit, availability, role readiness, and supporting
              information before they reach your review queue.
            </p>

            <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
              <ReviewPill
                title="Ready for interview"
                copy="Candidate appears prepared for manager review."
              />
              <ReviewPill
                title="Needs manager review"
                copy="Promising candidate with one or more items to confirm."
              />
              <ReviewPill
                title="More information needed"
                copy="Candidate is not advanced until missing details are collected."
              />
            </div>
          </aside>
        </div>

        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Open requests</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              marginTop: 16,
            }}
          >
            {openRequests.map((request) => (
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
                  <Metric label="Status" value={request.status} />
                </div>

                <p style={{ color: "#9fb4d6", margin: "16px 0 0" }}>
                  {request.nextStep}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Filled requests</div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
              marginTop: 16,
            }}
          >
            {filledRequests.map((request) => (
              <article
                key={`${request.role}-${request.filledBy}`}
                style={{
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(34,197,94,0.08)",
                  border: "1px solid rgba(34,197,94,0.18)",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    padding: "7px 10px",
                    borderRadius: 999,
                    background: "rgba(34,197,94,0.14)",
                    color: "#86efac",
                    fontSize: 12,
                    fontWeight: 950,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {request.outcome}
                </span>

                <h3
                  style={{
                    margin: "16px 0 0",
                    color: "#fff",
                    fontSize: 24,
                    lineHeight: 1,
                    letterSpacing: "-0.035em",
                  }}
                >
                  {request.role}
                </h3>

                <p style={{ margin: "10px 0 0", color: "#cfe2ff" }}>
                  Filled by <strong style={{ color: "#fff" }}>{request.filledBy}</strong>{" "}
                  on {request.filledDate}
                </p>

                <p style={{ color: "#9fb4d6", lineHeight: 1.55 }}>
                  {request.notes}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 40 }}>
          <div className="eyebrow">Candidate review desk</div>

          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            {reviewCandidates.map((candidate) => (
              <article
                key={candidate.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr)",
                  gap: 18,
                  alignItems: "start",
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 20,
                    alignItems: "start",
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
                      {candidate.role} · {candidate.interviewStage}
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

                  <StatusBadge status={candidate.status} />
                </div>

                <InterviewPacket candidate={candidate} />

                <DecisionForm
                  candidate={candidate}
                  submitInterviewDecision={submitInterviewDecision}
                />
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function SuccessNotice({ title, copy }: { title: string; copy: string }) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: 18,
        borderRadius: 22,
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.24)",
        color: "#d1fae5",
        display: "grid",
        gap: 6,
      }}
    >
      <strong style={{ color: "#fff" }}>{title}</strong>
      <span>{copy}</span>
    </div>
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

function ReviewPill({ title, copy }: { title: string; copy: string }) {
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

function InterviewPacket({ candidate }: { candidate: (typeof reviewCandidates)[number] }) {
  return (
    <section
      style={{
        display: "grid",
        gap: 12,
        padding: 18,
        borderRadius: 20,
        background: "rgba(15,23,42,0.72)",
        border: "1px solid rgba(147,197,253,0.16)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow">Dealer interview packet</div>
          <h4 style={{ margin: "6px 0 0", color: "#fff", fontSize: 20 }}>
            Resume, Don's notes, and Solace summary
          </h4>
        </div>
        <span
          style={{
            padding: "8px 10px",
            borderRadius: 999,
            background: "rgba(96,165,250,0.12)",
            border: "1px solid rgba(96,165,250,0.22)",
            color: "#bfdbfe",
            fontSize: 12,
            fontWeight: 900,
          }}
        >
          Packet ready
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <PacketCard title="Resume" copy={candidate.packet.resume} />
        <PacketCard title="Don's thoughts" copy={candidate.packet.donNotes} />
        <PacketCard title="Solace refinement" copy={candidate.packet.solaceSummary} />
      </div>

      <div>
        <strong style={{ color: "#fff", display: "block", marginBottom: 8 }}>
          Verify during interview
        </strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {candidate.packet.verification.map((item) => (
            <span
              key={item}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#d7e8ff",
                fontSize: 13,
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PacketCard({ title, copy }: { title: string; copy: string }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <strong style={{ color: "#fff", display: "block", marginBottom: 6 }}>{title}</strong>
      <p style={{ margin: 0, color: "#bfd6f5", fontSize: 13, lineHeight: 1.45 }}>{copy}</p>
    </div>
  );
}

function DecisionForm({
  candidate,
  submitInterviewDecision,
}: {
  candidate: (typeof reviewCandidates)[number];
  submitInterviewDecision: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={submitInterviewDecision}
      style={{
        display: "grid",
        gap: 14,
        padding: 18,
        borderRadius: 20,
        background: "rgba(255,255,255,0.045)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <input type="hidden" name="candidateName" value={candidate.name} />
      <input type="hidden" name="jobId" value={candidate.jobId} />
      <input type="hidden" name="applicationId" value={candidate.applicationId} />

      <div>
        <div className="eyebrow">Interview outcome</div>
        <h4 style={{ margin: "6px 0 0", color: "#fff", fontSize: 20 }}>
          Approve, reject, or keep warm — with the reason documented.
        </h4>
      </div>

      <div className="grid-2" style={{ gap: 14 }}>
        <Field label="Manager / interviewer name">
          <input
            name="interviewer_name"
            placeholder="Example: Sales Manager"
            style={inputStyle}
          />
        </Field>

        <Field label="Outcome">
          <select name="outcome" defaultValue="" required style={inputStyle}>
            <option value="" disabled>
              Select outcome
            </option>
            <option value="hired">Hired</option>
            <option value="not_hired">Not hired</option>
            <option value="keep_warm">Keep warm</option>
            <option value="no_show">No-show</option>
            <option value="needs_followup">Needs follow-up</option>
          </select>
        </Field>
      </div>

      <Field label="Why?">
        <textarea
          name="decision_reason"
          required
          rows={4}
          placeholder="Document the reason for the decision. This is required before the outcome can be saved."
          style={inputStyle}
        />
      </Field>

      <div className="grid-2" style={{ gap: 14 }}>
        <Field label="Strengths noted">
          <textarea
            name="strengths"
            rows={3}
            placeholder="One item per line"
            style={inputStyle}
          />
        </Field>

        <Field label="Concerns / verification items">
          <textarea
            name="concerns"
            rows={3}
            placeholder="One item per line"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Remaining verification flags">
        <textarea
          name="verification_flags"
          rows={3}
          placeholder="Example: confirm schedule, confirm compensation alignment, confirm certifications"
          style={inputStyle}
        />
      </Field>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          alignItems: "center",
          paddingTop: 4,
        }}
      >
        <p style={{ margin: 0, color: "#9fb4d6", fontSize: 13, lineHeight: 1.45, maxWidth: 660 }}>
          Only a human-submitted <strong style={{ color: "#fff" }}>Hired</strong> decision should close the public listing. Other outcomes keep the role open and preserve candidate eligibility where appropriate.
        </p>

        <button className="btn btn-primary" type="submit">
          Save interview decision
        </button>
      </div>
    </form>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status.includes("Ready")
    ? {
        background: "rgba(34,197,94,0.14)",
        border: "1px solid rgba(34,197,94,0.28)",
        color: "#86efac",
      }
    : status.includes("Needs")
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
        minWidth: 174,
        minHeight: 42,
        padding: "0 14px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 950,
        letterSpacing: "0.04em",
        textAlign: "center",
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
