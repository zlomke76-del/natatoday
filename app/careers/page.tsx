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

export const dynamic = "force-dynamic";

async function getJobs(): Promise<Job[]> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://natatoday.vercel.app";

  const res = await fetch(`${appUrl}/api/nata/jobs`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("Failed to load jobs:", res.status);
    return [];
  }

  const data = await res.json();
  return data.jobs || [];
}

export default async function CareersPage() {
  const jobs = await getJobs();

  return (
    <main className="shell">
      <Nav />

      <section style={pageSectionStyle}>
        <div className="eyebrow">Dealership Careers</div>

        <h1>Open dealership roles published by Solace.</h1>

        <p className="lede">
          Apply to a current opening or join the NATA candidate pool. Solace can
          review your profile for dealership opportunities within your area as
          new roles are published.
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
              </div>
            </div>

            <form
              method="POST"
              action="/api/nata/candidate-pool"
              encType="multipart/form-data"
              style={poolFormStyle}
            >
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
                  placeholder="Enter your email"
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
                  helper="PDF, DOC, or DOCX. Solace uses this to compare your background to future dealership roles."
                  required
                />

                <UploadField
                  label="Profile photo"
                  name="profile_photo"
                  accept="image/*"
                  capture="user"
                  icon="📷"
                  primary="Take selfie or upload photo"
                  helper="Optional, but helpful for recruiter review."
                />
              </div>

              <div style={privacyNoticeStyle}>
                <span style={shieldStyle}>◇</span>
                <span>
                  Candidate pool submissions stay internal unless NATA identifies
                  a potential role fit.
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

        <div style={{ display: "grid", gap: 18, marginTop: 22 }}>
          {jobs.length === 0 ? (
            <div style={emptyStateStyle}>
              <h2 style={{ margin: 0 }}>No open roles yet.</h2>
              <p style={{ color: "#cfe2ff", lineHeight: 1.6 }}>
                Open dealership roles will appear here when active requests are
                published.
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const isConfidential = Boolean(job.is_confidential);
              const dealerName =
                job.display_dealer ||
                (isConfidential
                  ? "Confidential Dealership"
                  : "Jersey Village Chrysler Jeep Dodge Ram");

              const location =
                job.display_location || job.location || "Dealership location";

              return (
                <Link
                  key={job.id}
                  href={`/careers/${job.slug}`}
                  style={jobCardStyle}
                >
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
                        {dealerName} · {location}
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

const pageSectionStyle: React.CSSProperties = {
  width: "min(1180px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "72px 0 96px",
};

const candidatePoolCardStyle: React.CSSProperties = {
  marginTop: 38,
  borderRadius: 34,
  padding: 1,
  background:
    "linear-gradient(135deg, rgba(20,115,255,0.55), rgba(250,204,21,0.35), rgba(255,255,255,0.12))",
  boxShadow: "0 34px 100px rgba(0,0,0,0.32)",
};

const candidatePoolGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.9fr) minmax(420px, 0.8fr)",
  gap: 28,
  alignItems: "start",
  borderRadius: 33,
  padding: 30,
  background:
    "radial-gradient(circle at 15% 0%, rgba(20,115,255,0.24), transparent 32%), linear-gradient(145deg, rgba(10,20,38,0.98), rgba(5,12,24,0.98))",
};

const poolBadgeStyle: React.CSSProperties = {
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

const poolTitleStyle: React.CSSProperties = {
  margin: "16px 0 0",
  fontSize: "clamp(34px, 4vw, 56px)",
  lineHeight: 0.95,
  letterSpacing: "-0.045em",
};

const poolCopyStyle: React.CSSProperties = {
  color: "#cfe2ff",
  marginTop: 18,
  fontSize: 17,
  lineHeight: 1.6,
};

const poolRulesStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 24,
  color: "#dbeafe",
  fontWeight: 850,
  fontSize: 14,
};

const poolFormStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 24,
  background:
    "linear-gradient(145deg, rgba(248,251,255,0.98), rgba(232,239,249,0.98))",
  color: "#111827",
  boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
  border: "1px solid rgba(255,255,255,0.88)",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "#111827",
  fontWeight: 900,
  marginBottom: 7,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
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

const uploadGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  marginTop: 18,
};

const uploadBoxStyle: React.CSSProperties = {
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

const uploadIconStyle: React.CSSProperties = {
  fontSize: 26,
  lineHeight: 1,
};

const uploadPrimaryStyle: React.CSSProperties = {
  color: "#111827",
  fontWeight: 950,
  fontSize: 14,
};

const uploadHelperStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.35,
  maxWidth: 220,
};

const fileInputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 8,
  color: "#334155",
  fontSize: 12,
};

const privacyNoticeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  marginTop: 18,
  color: "#526070",
  fontSize: 13,
  lineHeight: 1.45,
};

const shieldStyle: React.CSSProperties = {
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

const poolSubmitButtonStyle: React.CSSProperties = {
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

const sectionHeaderStyle: React.CSSProperties = {
  marginTop: 54,
  display: "flex",
  alignItems: "end",
  justifyContent: "space-between",
  gap: 20,
};

const openingsTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "clamp(30px, 4vw, 46px)",
  letterSpacing: "-0.04em",
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 28,
  padding: 28,
  background: "rgba(255,255,255,0.06)",
};

const jobCardStyle: React.CSSProperties = {
  display: "block",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 28,
  padding: 28,
  background: "rgba(255,255,255,0.06)",
  textDecoration: "none",
};

const jobCardGridStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
  alignItems: "flex-start",
};

const tagRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  marginBottom: 12,
};

const roleTagStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const jobDescriptionStyle: React.CSSProperties = {
  margin: "14px 0 0",
  color: "#9fb4d6",
  lineHeight: 1.6,
};

const confidentialTextStyle: React.CSSProperties = {
  margin: "14px 0 0",
  color: "#f8d98b",
  lineHeight: 1.6,
};

const jobActionStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  justifyItems: "end",
};

const salaryPillStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  background: "rgba(20,115,255,0.14)",
  border: "1px solid rgba(20,115,255,0.24)",
  color: "#d7e8ff",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const applyPillStyle: React.CSSProperties = {
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
