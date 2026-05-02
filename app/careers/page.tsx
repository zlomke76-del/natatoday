import type { CSSProperties } from "react";
import Link from "next/link";
import Nav from "../components/Nav";

type Job = {
  id: string;
  title: string | null;
  slug: string | null;
  location: string | null;
  type: string | null;
  salary: string | null;
  description: string | null;
  dealer_slug: string | null;
  publish_mode: string | null;
  published_by: string | null;
  display_dealer?: string;
  display_location?: string;
  is_confidential?: boolean;
  confidential_note?: string | null;
};

type JobsResponse = {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type CareersSearchParams = {
  q?: string;
  location?: string;
  role?: string;
  type?: string;
  publishMode?: string;
  page?: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const PAGE_SIZE = 25;

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safePage(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

function buildSearchUrl(input: {
  q: string;
  location: string;
  role: string;
  type: string;
  publishMode: string;
  page: number;
}) {
  const params = new URLSearchParams();

  if (input.q) params.set("q", input.q);
  if (input.location) params.set("location", input.location);
  if (input.role && input.role !== "all") params.set("role", input.role);
  if (input.type && input.type !== "all") params.set("type", input.type);
  if (input.publishMode && input.publishMode !== "all") {
    params.set("publishMode", input.publishMode);
  }
  if (input.page > 1) params.set("page", String(input.page));

  const query = params.toString();
  return query ? `/careers?${query}` : "/careers";
}

async function getJobs(
  searchParams: CareersSearchParams
): Promise<JobsResponse> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "https://natatoday.ai";

  const q = clean(searchParams.q);
  const location = clean(searchParams.location);
  const role = clean(searchParams.role) || "all";
  const type = clean(searchParams.type) || "all";
  const publishMode = clean(searchParams.publishMode) || "all";
  const page = safePage(searchParams.page);
  const offset = (page - 1) * PAGE_SIZE;

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });

  if (q) params.set("q", q);
  if (location) params.set("location", location);
  if (role !== "all") params.set("role", role);
  if (type !== "all") params.set("type", type);
  if (publishMode !== "all") params.set("publishMode", publishMode);

  const res = await fetch(`${appUrl}/api/nata/jobs?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Failed to load jobs:", res.status);
    return { jobs: [], total: 0, limit: PAGE_SIZE, offset, hasMore: false };
  }

  const data = await res.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  const total = Number.isFinite(Number(data.total))
    ? Number(data.total)
    : jobs.length;
  const limit = Number.isFinite(Number(data.limit))
    ? Number(data.limit)
    : PAGE_SIZE;
  const safeOffset = Number.isFinite(Number(data.offset))
    ? Number(data.offset)
    : offset;

  return {
    jobs,
    total,
    limit,
    offset: safeOffset,
    hasMore: Boolean(data.hasMore ?? safeOffset + jobs.length < total),
  };
}

export default async function CareersPage({
  searchParams,
}: {
  searchParams?: CareersSearchParams;
}) {
  const safeSearchParams = searchParams || {};
  const q = clean(safeSearchParams.q);
  const location = clean(safeSearchParams.location);
  const role = clean(safeSearchParams.role) || "all";
  const type = clean(safeSearchParams.type) || "all";
  const publishMode = clean(safeSearchParams.publishMode) || "all";
  const page = safePage(safeSearchParams.page);
  const result = await getJobs(safeSearchParams);
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const showingFrom = result.total === 0 ? 0 : result.offset + 1;
  const showingTo = Math.min(result.offset + result.jobs.length, result.total);

  return (
    <main className="shell">
      <Nav />

      <section style={pageSectionStyle}>
        <div className="eyebrow">Dealership Careers</div>

        <h1>Find your next dealership role.</h1>

        <p className="lede">
          Search active dealership openings or join the NATA candidate pool.
          Solace can review your profile for dealership opportunities within
          your area as new roles are published.
        </p>

        <div style={candidatePoolCardStyle}>
          <div style={candidatePoolGridStyle}>
            <div>
              <div style={poolBadgeStyle}>Candidate Pool</div>
              <h2 style={poolTitleStyle}>Be considered for future openings.</h2>
              <p style={poolCopyStyle}>
                Upload your resume once. Solace will look for dealership roles
                within 0–100 miles of your location and keep you eligible for
                future opportunities unless you are already placed.
              </p>

              <div style={poolRulesStyle}>
                <span>✓ Resume-based review</span>
                <span>✓ 0–100 mile role search</span>
                <span>✓ No dealer handoff unless there is a potential fit</span>
                <span>✓ SMS/email updates only for your application process</span>
              </div>
            </div>

            <form
              method="POST"
              action="/api/nata/candidate-pool"
              encType="multipart/form-data"
              style={poolFormStyle}
            >
              <div style={compactPoolHeaderStyle}>
                <strong>Join the pool</strong>
                <span>
                  Submit your resume and contact details. Solace handles the
                  matching logic.
                </span>
              </div>

              <div style={formGridStyle}>
                <Input
                  label="Full name"
                  name="name"
                  placeholder="Enter your full name"
                  required
                />
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="name@email.com"
                  required
                />
                <Input
                  label="Phone"
                  name="phone"
                  placeholder="(555) 123-4567"
                  required
                />
                <Input
                  label="Location / ZIP"
                  name="location"
                  placeholder="Houston, TX or 77002"
                  required
                />
              </div>

              <div style={{ marginTop: 14 }}>
                <Input
                  label="LinkedIn profile"
                  name="linkedin"
                  placeholder="linkedin.com/in/yourprofile"
                />
              </div>

              <div style={uploadGridStyle}>
                <UploadField
                  label="Resume"
                  name="resume"
                  accept=".pdf,.doc,.docx"
                  icon="📄"
                  primary="Upload your resume"
                  helper="Required. Solace uses this to extract role signals and match future dealership roles."
                  required
                />

                <UploadField
                  label="Profile photo"
                  name="profile_photo"
                  accept="image/*"
                  capture="user"
                  icon="📷"
                  primary="Selfie or photo"
                  helper="Optional, but helpful for recruiter and dealer packet review."
                />
              </div>

              <label style={consentBoxStyle}>
                <input
                  type="checkbox"
                  name="sms_email_consent"
                  value="yes"
                  required
                  style={consentCheckboxStyle}
                />
                <span>
                  I agree to receive SMS and email updates from NATA Today about
                  my application, interview scheduling, and hiring process.
                  Message and data rates may apply. Reply STOP to opt out or
                  HELP for help. See our <Link href="/privacy">Privacy Policy</Link>{" "}
                  and <Link href="/terms">Terms</Link>.
                </span>
              </label>

              <div style={privacyNoticeStyle}>
                <span style={shieldStyle}>◇</span>
                <span>
                  Candidate pool submissions stay internal unless NATA identifies
                  a potential role fit. Your information is not sold.
                </span>
              </div>

              <button type="submit" style={poolSubmitButtonStyle}>
                Join candidate pool →
              </button>
            </form>
          </div>
        </div>

        <div style={sectionHeaderStyle}>
          <div>
            <div className="eyebrow">Current Openings</div>
            <h2 style={openingsTitleStyle}>Active dealership roles</h2>
          </div>
        </div>

        <form method="GET" action="/careers" style={searchPanelStyle}>
          <div style={searchGridStyle}>
            <label style={searchLabelStyle}>
              <span>Search</span>
              <input
                name="q"
                defaultValue={q}
                placeholder="Sales, technician, advisor, BDC..."
                style={searchInputStyle}
              />
            </label>

            <label style={searchLabelStyle}>
              <span>Location</span>
              <input
                name="location"
                defaultValue={location}
                placeholder="Houston, Dallas, 77002..."
                style={searchInputStyle}
              />
            </label>

            <label style={searchLabelStyle}>
              <span>Role</span>
              <select name="role" defaultValue={role} style={searchInputStyle}>
                <option value="all">All roles</option>
                <option value="sales">Sales</option>
                <option value="technician">Technician</option>
                <option value="service-advisor">Service Advisor</option>
                <option value="bdc">BDC</option>
                <option value="parts">Parts</option>
                <option value="finance">Finance / F&amp;I</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label style={searchLabelStyle}>
              <span>Type</span>
              <select name="type" defaultValue={type} style={searchInputStyle}>
                <option value="all">All types</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
              </select>
            </label>

            <label style={searchLabelStyle}>
              <span>Visibility</span>
              <select
                name="publishMode"
                defaultValue={publishMode}
                style={searchInputStyle}
              >
                <option value="all">All listings</option>
                <option value="public">Public dealership roles</option>
                <option value="confidential">Confidential searches</option>
              </select>
            </label>

            <div style={searchActionsStyle}>
              <button type="submit" style={searchButtonStyle}>
                Search roles
              </button>
              <Link href="/careers" style={clearButtonStyle}>
                Clear
              </Link>
            </div>
          </div>
        </form>

        <div style={resultsMetaStyle}>
          <span>
            Showing {showingFrom}-{showingTo} of {result.total} roles
          </span>
          <span>
            Page {Math.min(page, totalPages)} of {totalPages}
          </span>
        </div>

        <div style={{ display: "grid", gap: 18, marginTop: 22 }}>
          {result.jobs.length === 0 ? (
            <div style={emptyStateStyle}>
              <h2 style={{ margin: 0 }}>No matching roles.</h2>
              <p style={{ color: "#cfe2ff", lineHeight: 1.6 }}>
                Try a broader search, clear filters, or join the candidate pool
                so Solace can surface future openings near you.
              </p>
            </div>
          ) : (
            result.jobs.map((job) => {
              const isConfidential = Boolean(job.is_confidential);
              const dealerName =
                job.display_dealer ||
                (isConfidential
                  ? "Confidential Dealership"
                  : "Jersey Village Chrysler Jeep Dodge Ram");
              const jobLocation =
                job.display_location || job.location || "Dealership location";
              const href = job.slug ? `/careers/${job.slug}` : "/careers";

              return (
                <Link key={job.id} href={href} style={jobCardStyle}>
                  <div style={jobCardGridStyle}>
                    <div style={{ maxWidth: 780 }}>
                      <div style={tagRowStyle}>
                        <span
                          style={{
                            ...roleTagStyle,
                            background: isConfidential
                              ? "rgba(251,191,36,0.14)"
                              : "rgba(20,115,255,0.14)",
                            border: isConfidential
                              ? "1px solid rgba(251,191,36,0.28)"
                              : "1px solid rgba(20,115,255,0.24)",
                            color: isConfidential ? "#fbbf24" : "#d7e8ff",
                          }}
                        >
                          {isConfidential
                            ? "Confidential search"
                            : "Public dealership role"}
                        </span>

                        <span style={{ color: "#9fb4d6", fontSize: 13 }}>
                          Published by {job.published_by || "Solace"}
                        </span>
                      </div>

                      <h2 style={{ margin: 0 }}>{job.title}</h2>

                      <p style={{ margin: "10px 0 0", color: "#cfe2ff" }}>
                        {dealerName} · {jobLocation}
                        {job.type ? ` · ${job.type}` : ""}
                      </p>

                      {job.description ? (
                        <p style={jobDescriptionStyle}>{job.description}</p>
                      ) : null}

                      {isConfidential ? (
                        <p style={confidentialTextStyle}>
                          {job.confidential_note ||
                            "This role is being handled confidentially on behalf of a dealership. Candidate information is reviewed before any dealership handoff."}
                        </p>
                      ) : null}
                    </div>

                    <div style={jobActionStackStyle}>
                      {job.salary ? (
                        <div style={salaryPillStyle}>{job.salary}</div>
                      ) : null}
                      <span style={applyPillStyle}>Apply for this role</span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {result.total > PAGE_SIZE ? (
          <div style={paginationStyle}>
            {page > 1 ? (
              <Link
                href={buildSearchUrl({
                  q,
                  location,
                  role,
                  type,
                  publishMode,
                  page: page - 1,
                })}
                style={pageButtonStyle}
              >
                ← Previous
              </Link>
            ) : (
              <span style={disabledPageButtonStyle}>← Previous</span>
            )}

            <span style={pageStatusStyle}>
              Page {Math.min(page, totalPages)} of {totalPages}
            </span>

            {result.hasMore ? (
              <Link
                href={buildSearchUrl({
                  q,
                  location,
                  role,
                  type,
                  publishMode,
                  page: page + 1,
                })}
                style={pageButtonStyle}
              >
                Next →
              </Link>
            ) : (
              <span style={disabledPageButtonStyle}>Next →</span>
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Input({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label>
      <span style={labelStyle}>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

function UploadField({
  label,
  name,
  accept,
  capture,
  helper,
  primary,
  icon,
  required = false,
}: {
  label: string;
  name: string;
  accept: string;
  capture?: "user" | "environment";
  helper: string;
  primary: string;
  icon: string;
  required?: boolean;
}) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <label style={uploadBoxStyle}>
        <span style={uploadIconStyle}>{icon}</span>
        <span style={uploadPrimaryStyle}>{primary}</span>
        <span style={uploadHelperStyle}>{helper}</span>
        <input
          type="file"
          name={name}
          accept={accept}
          capture={capture}
          required={required}
          style={fileInputStyle}
        />
      </label>
    </div>
  );
}

const pageSectionStyle: CSSProperties = {
  width: "min(1180px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "72px 0 96px",
};

const candidatePoolCardStyle: CSSProperties = {
  marginTop: 38,
  borderRadius: 34,
  padding: 1,
  background:
    "linear-gradient(135deg, rgba(20,115,255,0.55), rgba(250,204,21,0.35), rgba(255,255,255,0.12))",
  boxShadow: "0 34px 100px rgba(0,0,0,0.32)",
};

const candidatePoolGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.9fr) minmax(420px, 0.8fr)",
  gap: 28,
  alignItems: "start",
  borderRadius: 33,
  padding: 30,
  background:
    "radial-gradient(circle at 15% 0%, rgba(20,115,255,0.24), transparent 32%), linear-gradient(145deg, rgba(10,20,38,0.98), rgba(5,12,24,0.98))",
};

const poolBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "8px 11px",
  borderRadius: 999,
  background: "rgba(250,204,21,0.12)",
  border: "1px solid rgba(250,204,21,0.26)",
  color: "#facc15",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const poolTitleStyle: CSSProperties = {
  margin: "16px 0 0",
  fontSize: "clamp(34px, 4vw, 56px)",
  lineHeight: 0.95,
  letterSpacing: "-0.045em",
};

const poolCopyStyle: CSSProperties = {
  color: "#cfe2ff",
  marginTop: 18,
  fontSize: 17,
  lineHeight: 1.6,
};

const poolRulesStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 24,
  color: "#dbeafe",
  fontWeight: 850,
  fontSize: 14,
};

const poolFormStyle: CSSProperties = {
  borderRadius: 28,
  padding: 24,
  background:
    "linear-gradient(145deg, rgba(248,251,255,0.98), rgba(232,239,249,0.98))",
  color: "#111827",
  boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
  border: "1px solid rgba(255,255,255,0.88)",
};

const compactPoolHeaderStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  marginBottom: 14,
  color: "#111827",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const labelStyle: CSSProperties = {
  display: "block",
  color: "#111827",
  fontWeight: 900,
  marginBottom: 7,
  fontSize: 13,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 12,
  border: "1px solid #c9d4e5",
  outline: "none",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  boxShadow: "0 1px 0 rgba(255,255,255,0.9) inset",
};

const uploadGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  marginTop: 18,
};

const uploadBoxStyle: CSSProperties = {
  minHeight: 138,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  textAlign: "center",
  border: "1.5px dashed #aebdd3",
  borderRadius: 18,
  background: "linear-gradient(180deg, #ffffff, #f7faff)",
  padding: 18,
  cursor: "pointer",
};

const uploadIconStyle: CSSProperties = {
  fontSize: 26,
  lineHeight: 1,
};

const uploadPrimaryStyle: CSSProperties = {
  color: "#111827",
  fontWeight: 950,
  fontSize: 14,
};

const uploadHelperStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.35,
  maxWidth: 220,
};

const fileInputStyle: CSSProperties = {
  width: "100%",
  marginTop: 8,
  color: "#334155",
  fontSize: 12,
};

const consentBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  marginTop: 16,
  padding: 12,
  borderRadius: 14,
  background: "#f8fbff",
  border: "1px solid #d5e1f1",
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.45,
};

const consentCheckboxStyle: CSSProperties = {
  marginTop: 3,
  flex: "0 0 auto",
};

const privacyNoticeStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  marginTop: 18,
  color: "#526070",
  fontSize: 13,
  lineHeight: 1.45,
};

const shieldStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#edf4ff",
  color: "#1473ff",
  fontWeight: 950,
  flex: "0 0 auto",
};

const poolSubmitButtonStyle: CSSProperties = {
  marginTop: 22,
  width: "100%",
  padding: "16px",
  borderRadius: 14,
  background: "linear-gradient(135deg, #1473ff, #075fe7)",
  color: "#fff",
  fontWeight: 950,
  border: "none",
  cursor: "pointer",
  fontSize: 16,
  boxShadow: "0 16px 34px rgba(20,115,255,0.28)",
};

const sectionHeaderStyle: CSSProperties = {
  marginTop: 54,
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: 20,
};

const openingsTitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "clamp(30px, 4vw, 46px)",
  letterSpacing: "-0.04em",
};

const searchPanelStyle: CSSProperties = {
  marginTop: 22,
  padding: 18,
  borderRadius: 24,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const searchGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 1fr 0.85fr 0.85fr 0.95fr auto",
  gap: 12,
  alignItems: "end",
};

const searchLabelStyle: CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 950,
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 12px",
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(3,7,18,0.82)",
  color: "#fff",
  outline: "none",
};

const searchActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
};

const searchButtonStyle: CSSProperties = {
  minHeight: 44,
  padding: "0 16px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg, #1473ff, #0757c9)",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const clearButtonStyle: CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.15)",
  color: "#dbeafe",
  textDecoration: "none",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const resultsMetaStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 18,
  color: "#9fb4d6",
  fontSize: 13,
  fontWeight: 850,
};

const emptyStateStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 28,
  padding: 28,
  background: "rgba(255,255,255,0.06)",
};

const jobCardStyle: CSSProperties = {
  display: "block",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 28,
  padding: 28,
  background: "rgba(255,255,255,0.06)",
  textDecoration: "none",
};

const jobCardGridStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const tagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  marginBottom: 12,
};

const roleTagStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const jobDescriptionStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#9fb4d6",
  lineHeight: 1.6,
};

const confidentialTextStyle: CSSProperties = {
  margin: "14px 0 0",
  color: "#f8d98b",
  lineHeight: 1.6,
};

const jobActionStackStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  justifyItems: "end",
};

const salaryPillStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  background: "rgba(20,115,255,0.14)",
  border: "1px solid rgba(20,115,255,0.24)",
  color: "#d7e8ff",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const applyPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 42,
  padding: "0 18px",
  borderRadius: 999,
  background: "linear-gradient(135deg, #1473ff, #0757c9)",
  color: "#fff",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const paginationStyle: CSSProperties = {
  marginTop: 28,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: 12,
};

const pageButtonStyle: CSSProperties = {
  minHeight: 42,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 16px",
  borderRadius: 999,
  background: "rgba(20,115,255,0.16)",
  border: "1px solid rgba(96,165,250,0.26)",
  color: "#bfdbfe",
  fontWeight: 950,
  textDecoration: "none",
};

const disabledPageButtonStyle: CSSProperties = {
  ...pageButtonStyle,
  opacity: 0.45,
};

const pageStatusStyle: CSSProperties = {
  color: "#9fb4d6",
  fontWeight: 850,
};
