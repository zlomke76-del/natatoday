import Link from "next/link";
import { revalidatePath } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type PageProps = {
  params: {
    dealerSlug: string;
  };
};

type JobRow = {
  id: string;
  title: string | null;
  slug: string | null;
  location: string | null;
  type: string | null;
  salary: string | null;
  publish_mode: string | null;
  publish_status: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type ApplicationRow = {
  id: string;
  job_id: string | null;
  status: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  "Sales Consultant": "$45,000-$95,000 / year",
  "Service Technician": "$28-$45 / hour",
  "Service Advisor": "$55,000-$95,000 / year",
  "BDC Representative": "$18-$24 / hour + bonus",
  "Parts Advisor": "$20-$30 / hour",
  "Finance Manager": "$95,000-$180,000 / year",
};

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
    name: "Maria Lopez",
    role: "Sales Consultant",
    status: "Ready for interview",
    detail: "Strong communication fit, sales background, and availability confirmed.",
    notes: ["Interview ready", "Retail sales experience", "Availability confirmed"],
  },
  {
    name: "James Carter",
    role: "Service Technician",
    status: "Needs manager review",
    detail: "Strong technician experience. Certification documentation needs final confirmation.",
    notes: ["8 years experience", "Certification pending", "Good fixed-ops fit"],
  },
  {
    name: "Tyler Ng",
    role: "Service Technician",
    status: "More information needed",
    detail: "Entry-level candidate. Training path and availability need confirmation before advancing.",
    notes: ["Entry-level pathway", "Training incomplete", "Availability missing"],
  },
];

function clean(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function defaultLocationForDealer(slug: string) {
  if (slug === "jersey-village-cdjr") return "Jersey Village, TX";
  return "Dealership market";
}

function buildJobContent(input: {
  title: string;
  dealerName: string;
  location: string;
  notes: string;
  publishMode: string;
}) {
  const title = input.title;
  const dealer =
    input.publishMode === "confidential"
      ? "A dealership in the market"
      : input.dealerName;
  const location = input.location || "the local market";
  const lower = title.toLowerCase();

  if (lower.includes("technician")) {
    return {
      description: `${dealer} is looking for an experienced ${title} who wants steady work, a strong vehicle mix, and a service department where ability matters.`,
      requirements:
        "ASE or OEM certification preferred. Strong diagnostic ability, dealership experience, consistent availability, and clear communication are strong advantages.",
      role_hook: `${dealer} needs a ${title} who can step into a real service workflow in ${location} and help keep vehicles moving through the shop with quality and consistency.`,
      responsibilities: [
        "Diagnose and repair customer vehicles",
        "Perform maintenance, inspections, and service repairs",
        "Communicate findings clearly with advisors and the service team",
        "Support a steady workflow with quality and consistency",
      ],
      fit_signals: [
        "ASE or OEM certification preferred",
        "Diagnostic ability and dealership experience are strong advantages",
        "Consistent availability and good communication",
        "Truck, SUV, CDJR, or high-volume service experience helpful",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  if (lower.includes("advisor")) {
    return {
      description: `${dealer} is looking for a ${title} who can handle volume, communicate clearly, and help customers move through the service process with confidence.`,
      requirements:
        "Service lane experience preferred. Strong customer communication, follow-up discipline, and dealership process familiarity are important.",
      role_hook: `${dealer} needs a ${title} who can bring organization, communication, and follow-through to a busy service lane in ${location}.`,
      responsibilities: [
        "Greet service customers and understand repair or maintenance needs",
        "Communicate clearly between customers, technicians, and management",
        "Help protect follow-up, CSI, and service lane organization",
        "Support a fast-moving service department",
      ],
      fit_signals: [
        "Service advisor or customer-facing automotive experience preferred",
        "Strong communication and follow-up discipline",
        "Comfort working with volume and multiple priorities",
        "Dealership process or DMS familiarity helpful",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  if (lower.includes("sales")) {
    return {
      description: `${dealer} is building its sales pipeline for candidates who can work with customers, follow up consistently, and operate in a real dealership environment.`,
      requirements:
        "Automotive sales experience preferred but not required. Strong communication, availability, consistency, and customer follow-up are important.",
      role_hook: `${dealer} is looking for a ${title} who can turn conversations into opportunities and help customers move confidently through the buying process.`,
      responsibilities: [
        "Work with customers through the vehicle shopping and sales process",
        "Follow up consistently with leads, appointments, and opportunities",
        "Build product confidence around new and used inventory",
        "Operate within a structured dealership sales workflow",
      ],
      fit_signals: [
        "Automotive sales experience preferred but not required",
        "Strong communication and customer follow-up",
        "Availability and consistency matter",
        "Truck, SUV, retail, or dealership sales experience helpful",
      ],
      process_note:
        "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
    };
  }

  return {
    description:
      input.notes ||
      `${dealer} is hiring for a ${title} role in ${location}. This position is part of an active dealership hiring request managed through Solace.`,
    requirements:
      "Relevant experience, strong communication, consistent availability, and dealership or customer-facing experience are helpful.",
    role_hook: `${dealer} is looking for a ${title} who can step into a real operating environment and contribute with consistency, communication, and follow-through.`,
    responsibilities: [
      "Support day-to-day dealership operations within the role",
      "Communicate clearly with customers, managers, and team members",
      "Follow process and maintain consistent availability",
      "Contribute to a professional, performance-driven environment",
    ],
    fit_signals: [
      "Relevant experience preferred",
      "Strong communication and reliability",
      "Comfort working in a fast-moving dealership environment",
      "Consistent availability and follow-through",
    ],
    process_note:
      "Apply through Solace. We review your fit, availability, and readiness before dealership handoff so the interview starts with useful context.",
  };
}

async function createHiringRequest(formData: FormData) {
  "use server";

  const dealerSlug = clean(formData.get("dealerSlug"), "jersey-village-cdjr");
  const dealerName = formatDealerName(dealerSlug);
  const title = clean(formData.get("role"));
  const priority = clean(formData.get("priority"), "Standard");
  const payRange = clean(formData.get("payRange"), paySuggestions[title] || "");
  const needBy = clean(formData.get("needBy"));
  const notes = clean(formData.get("notes"));
  const publishMode = clean(formData.get("publishMode"), "public");
  const location = defaultLocationForDealer(dealerSlug);
  const content = buildJobContent({
    title,
    dealerName,
    location,
    notes,
    publishMode,
  });

  if (!title) return;

  const slug = slugify(`${dealerSlug}-${title}-${Date.now()}`);

  const { data: job, error: jobError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .insert({
      title,
      slug,
      dealer_slug: dealerSlug,
      location,
      type: "Full-time",
      salary: payRange,
      description: content.description,
      requirements: content.requirements,
      role_hook: content.role_hook,
      responsibilities: content.responsibilities,
      fit_signals: content.fit_signals,
      process_note: content.process_note,
      is_active: true,
      publish_mode: publishMode,
      public_dealer_name: publishMode === "confidential" ? null : dealerName,
      public_location:
        publishMode === "confidential" ? `${location} Market` : location,
      confidential_note:
        publishMode === "confidential"
          ? "This role is being handled confidentially on behalf of a dealership. Candidate information is reviewed before any dealership handoff."
          : null,
      published_by: "Solace",
      publish_status: "published",
    })
    .select("id")
    .single();

  if (jobError) {
    console.error("Failed to create hiring request job:", jobError);
    return;
  }

  const { data: dealer } = await supabaseAdmin
    .schema("nata")
    .from("dealers")
    .select("id")
    .eq("slug", dealerSlug)
    .maybeSingle();

  if (dealer?.id) {
    await supabaseAdmin.schema("nata").from("hiring_requests").insert({
      dealer_id: dealer.id,
      role_title: title,
      department: title.toLowerCase().includes("technician") ||
        title.toLowerCase().includes("advisor")
        ? "Fixed Ops"
        : title.toLowerCase().includes("bdc")
          ? "BDC"
          : title.toLowerCase().includes("parts")
            ? "Parts"
            : "Sales",
      priority,
      status: "open",
      pay_range: payRange,
      location,
      need_by: needBy || null,
      request_notes: notes,
      public_job_title: title,
      public_job_summary: content.description,
      distribution_status: "published",
      candidate_count: 0,
      ready_count: 0,
    });

    if (job?.id) {
      await supabaseAdmin.schema("nata").from("request_events").insert({
        dealer_id: dealer.id,
        hiring_request_id: null,
        event_type: "job_published",
        event_note: `${title} was published by Solace from the dealer dashboard request.`,
      });
    }
  }

  revalidatePath("/careers");
  revalidatePath(`/dealer/${dealerSlug}/dashboard`);
}

async function getDealerJobs(dealerSlug: string) {
  const { data: jobs, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("id,title,slug,location,type,salary,publish_mode,publish_status,is_active,created_at")
    .eq("dealer_slug", dealerSlug)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !jobs) return [];
  return jobs as JobRow[];
}

async function getApplicationCounts(jobs: JobRow[]) {
  const jobIds = jobs.map((job) => job.id);
  if (jobIds.length === 0) return new Map<string, ApplicationRow[]>();

  const { data } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id,job_id,status")
    .in("job_id", jobIds);

  const grouped = new Map<string, ApplicationRow[]>();

  for (const application of (data || []) as ApplicationRow[]) {
    if (!application.job_id) continue;
    const current = grouped.get(application.job_id) || [];
    current.push(application);
    grouped.set(application.job_id, current);
  }

  return grouped;
}

export default async function DealerDashboardPage({ params }: PageProps) {
  const dealerName = formatDealerName(params.dealerSlug);
  const dealerJobs = await getDealerJobs(params.dealerSlug);
  const applicationCounts = await getApplicationCounts(dealerJobs);

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
              Submit hiring requests, publish stronger job posts, track open roles,
              review candidates, and see which positions have been filled by your
              recruiting pipeline.
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
            <strong style={{ color: "#fff", display: "block" }}>
              {dealerName}
            </strong>
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
              Submit the role, pay range, urgency, and notes. Solace creates the
              published job post, opens the intake path, and routes candidates into
              review.
            </p>

            <form action={createHiringRequest} style={{ marginTop: 24 }}>
              <input type="hidden" name="dealerSlug" value={params.dealerSlug} />

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
                    placeholder="Example: $55,000-$95,000 / year"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Need by">
                  <input name="needBy" type="date" style={inputStyle} />
                </Field>

                <Field label="Publishing mode">
                  <select name="publishMode" defaultValue="public" style={inputStyle}>
                    <option value="public">Public dealership role</option>
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
                  Submit request
                </button>

                <span style={{ color: "#9fb4d6", fontSize: 14 }}>
                  Creates a Solace-published job post and opens candidate intake.
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
            {dealerJobs.length === 0 ? (
              <article
                style={{
                  padding: 22,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#cfe2ff",
                }}
              >
                No open requests yet. Submit the first role above.
              </article>
            ) : (
              dealerJobs.map((job) => {
                const apps = applicationCounts.get(job.id) || [];
                const ready = apps.filter((app) => app.status === "ready").length;

                return (
                  <article
                    key={job.id}
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
                          {job.title}
                        </h3>
                        <p style={{ margin: "8px 0 0", color: "#bfd6f5" }}>
                          {job.salary || "Pay range pending"}
                        </p>
                      </div>

                      <span
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          background:
                            job.publish_mode === "confidential"
                              ? "rgba(251,191,36,0.14)"
                              : "rgba(20,115,255,0.14)",
                          color: job.publish_mode === "confidential" ? "#fbbf24" : "#93c5fd",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        {job.publish_mode === "confidential" ? "Confidential" : "Public"}
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
                      <Metric label="Candidates" value={apps.length} />
                      <Metric label="Ready" value={ready} />
                      <Metric label="Status" value={job.publish_status || "Active"} />
                    </div>

                    <p style={{ color: "#9fb4d6", margin: "16px 0 0" }}>
                      Published by Solace. Candidates route into review as they apply.
                    </p>

                    {job.slug ? (
                      <Link
                        href={`/careers/${job.slug}`}
                        style={{
                          display: "inline-flex",
                          marginTop: 14,
                          color: "#93c5fd",
                          fontWeight: 900,
                        }}
                      >
                        View published job
                      </Link>
                    ) : null}
                  </article>
                );
              })
            )}
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

                <StatusBadge status={candidate.status} />
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
