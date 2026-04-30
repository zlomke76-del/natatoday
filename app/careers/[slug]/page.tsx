import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import Nav from "../../components/Nav";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

type Job = {
  id: string;
  title: string | null;
  slug: string | null;
  location: string | null;
  type: string | null;
  salary: string | null;
  description: string | null;
  requirements: string | null;
  role_hook: string | null;
  responsibilities: string[] | null;
  fit_signals: string[] | null;
  process_note: string | null;
  publish_mode: string | null;
  public_dealer_name: string | null;
  public_location: string | null;
  confidential_note: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function getJob(slug: string): Promise<Job | null> {
  noStore();

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select(
      "id,title,slug,location,type,salary,description,requirements,role_hook,responsibilities,fit_signals,process_note,publish_mode,public_dealer_name,public_location,confidential_note"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("publish_status", "published")
    .single();

  if (error || !data) {
    console.error("Failed to load job:", error);
    return null;
  }

  return data as Job;
}

function hasItems(value: string[] | null): value is string[] {
  return Array.isArray(value) && value.length > 0;
}

export default async function JobPage({
  params,
}: {
  params: { slug: string };
}) {
  noStore();

  const job = await getJob(params.slug);

  if (!job) {
    return (
      <main className="shell">
        <Nav />
        <section style={notFoundSectionStyle}>
          <div className="eyebrow">NATA Today</div>
          <h1>Role not found</h1>
          <p style={mutedTextStyle}>
            This opportunity may have been filled, paused, or unpublished.
          </p>
          <Link href="/careers" style={backLinkStyle}>
            ← Back to careers
          </Link>
        </section>
      </main>
    );
  }

  const isConfidential = job.publish_mode === "confidential";
  const dealerName = isConfidential
    ? "Confidential Dealership"
    : job.public_dealer_name || "Jersey Village Chrysler Jeep Dodge Ram";

  const location = isConfidential
    ? job.public_location || "Houston, TX Market"
    : job.public_location || job.location || "Location";

  return (
    <main className="shell">
      <Nav />

      <section style={pageWrapStyle}>
        <div style={heroGlowStyle} aria-hidden="true" />
        <div style={topBarStyle}>
          <Link href="/careers" style={backLinkStyle}>
            ← Back to careers
          </Link>
        </div>

        <div style={headerGridStyle}>
          <div>
            <div className="eyebrow">Dealership Opportunity</div>
            <h1 style={titleStyle}>{job.title || "Dealership Role"}</h1>
            <p style={subheadStyle}>
              {dealerName} · {location}
              {job.type ? ` · ${job.type}` : ""}
            </p>
            {job.salary ? <p style={salaryStyle}>{job.salary}</p> : null}
          </div>

        </div>

        <div style={contentGridStyle}>
          <div style={detailsStackStyle}>
            {job.role_hook ? (
              <Card icon="👥" tone="blue" title="Why this role is open">
                {job.role_hook}
              </Card>
            ) : null}

            {hasItems(job.responsibilities) ? (
              <Card icon="✓" tone="green" title="What you’ll do">
                <ul style={listStyle}>
                  {job.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {hasItems(job.fit_signals) ? (
              <Card icon="☆" tone="purple" title="What makes you a strong fit">
                <ul style={listStyle}>
                  {job.fit_signals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {job.process_note ? (
              <Card icon="▣" tone="orange" title="How the process works">
                {job.process_note}
              </Card>
            ) : null}

            {!job.role_hook && job.description ? (
              <Card icon="i" tone="blue" title="Role overview">
                {job.description}
              </Card>
            ) : null}

            {!hasItems(job.fit_signals) && job.requirements ? (
              <Card icon="✓" tone="green" title="Requirements">
                {job.requirements}
              </Card>
            ) : null}

            {isConfidential ? (
              <Card icon="🔒" tone="purple" title="Confidential search">
                {job.confidential_note ||
                  "This role is being handled confidentially on behalf of a dealership. Candidate information is reviewed before any dealership handoff."}
              </Card>
            ) : null}
          </div>

          <aside style={applyCardStyle}>
            <div style={applyHeaderStyle}>
              <div>
                <h3 style={applyTitleStyle}>Apply for this role</h3>
                <p style={applyCopyStyle}>
                  Submit your information and resume. If there’s a strong fit, you’ll hear from us with next steps.
                </p>
              </div>
            </div>

            <form method="POST" action="/api/nata/apply" encType="multipart/form-data">
              <input type="hidden" name="job_id" value={job.id} />

              <div style={formGridStyle}>
                <Input label="Full name" name="name" placeholder="Enter your full name" required />
                <Input label="Email" name="email" type="email" placeholder="Enter your email" required />
                <Input label="Phone" name="phone" placeholder="(555) 123-4567" required />
                <Input label="LinkedIn profile" name="linkedin" placeholder="linkedin.com/in/yourprofile" />
              </div>

              <div style={{ marginTop: 16 }}>
                <label>
                  <span style={labelStyle}>Short note</span>
                  <textarea
                    name="cover_note"
                    rows={3}
                    placeholder="Tell us briefly why this role fits you."
                    style={textareaStyle}
                  />
                </label>
              </div>

              <div style={uploadGridStyle}>
                <UploadField
                  label="Profile photo"
                  name="profile_photo"
                  accept="image/*"
                  capture="user"
                  recommended
                  icon="📷"
                  primary="Take selfie or upload photo"
                  helper="JPG or PNG. Optional, but helps the recruiting team put a face to your application."
                />

                <UploadField
                  label="Resume"
                  name="resume"
                  accept=".pdf,.doc,.docx"
                  icon="📄"
                  primary="Upload your resume"
                  helper="PDF, DOC, or DOCX. This helps Solace compare your background to the role."
                />
              </div>

              <div style={privacyNoticeStyle}>
                <span style={shieldStyle}>◇</span>
                <span>
                  Your information is secure and only shared with the dealer if you’re a potential fit.
                </span>
              </div>

              <button style={submitButtonStyle}>Send application →</button>

              <p style={termsStyle}>
                By submitting, you agree that NATA Today may review your application for this opportunity.
              </p>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: string;
  tone: "blue" | "green" | "purple" | "orange";
  children: React.ReactNode;
}) {
  const colors = {
    blue: "rgba(20,115,255,0.28)",
    green: "rgba(16,185,129,0.24)",
    purple: "rgba(124,58,237,0.25)",
    orange: "rgba(245,158,11,0.24)",
  };

  return (
    <div style={cardStyle}>
      <div style={{ ...iconStyle, background: colors[tone] }}>{icon}</div>
      <div>
        <h3 style={cardTitleStyle}>{title}</h3>
        <div style={cardBodyStyle}>{children}</div>
      </div>
    </div>
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
  recommended = false,
}: {
  label: string;
  name: string;
  accept: string;
  capture?: "user" | "environment";
  helper: string;
  primary: string;
  icon: string;
  recommended?: boolean;
}) {
  return (
    <div>
      <span style={labelStyle}>
        {label} {recommended ? <span style={recommendedStyle}>(recommended)</span> : null}
      </span>

      <label style={uploadBoxStyle}>
        <span style={uploadIconStyle}>{icon}</span>
        <span style={uploadPrimaryStyle}>{primary}</span>
        <span style={uploadHelperStyle}>{helper}</span>
        <input
          type="file"
          name={name}
          accept={accept}
          capture={capture}
          style={fileInputStyle}
        />
      </label>
    </div>
  );
}

const pageWrapStyle: React.CSSProperties = {
  position: "relative",
  width: "min(1360px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "56px 0 92px",
};

const notFoundSectionStyle: React.CSSProperties = {
  width: "min(1180px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "80px 0",
};

const heroGlowStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  width: "52%",
  height: 280,
  pointerEvents: "none",
  background:
    "radial-gradient(circle at 60% 20%, rgba(20,115,255,0.28), transparent 42%), linear-gradient(135deg, rgba(255,255,255,0.08), transparent 58%)",
  filter: "blur(2px)",
  opacity: 0.9,
};

const topBarStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  gap: 16,
  marginBottom: 26,
};

const backLinkStyle: React.CSSProperties = {
  color: "#2b8cff",
  textDecoration: "none",
  fontWeight: 800,
};


const headerGridStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "minmax(0, 860px)",
  gap: 32,
  alignItems: "end",
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "clamp(46px, 6vw, 78px)",
  lineHeight: 0.92,
  letterSpacing: "-0.055em",
};

const subheadStyle: React.CSSProperties = {
  color: "#d7e6ff",
  marginTop: 18,
  fontSize: 18,
  lineHeight: 1.45,
};

const salaryStyle: React.CSSProperties = {
  color: "#a9bad5",
  marginTop: 8,
  fontSize: 18,
  fontWeight: 800,
};




const contentGridStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "1fr minmax(420px, 560px)",
  gap: 34,
  marginTop: 44,
  alignItems: "start",
};

const detailsStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
};

const cardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "56px 1fr",
  gap: 18,
  alignItems: "start",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 24,
  padding: 22,
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
  boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
};

const iconStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  color: "#f8fbff",
  fontWeight: 950,
  fontSize: 24,
};

const cardTitleStyle: React.CSSProperties = {
  margin: "1px 0 8px",
  color: "#f8fbff",
  fontSize: 20,
};

const cardBodyStyle: React.CSSProperties = {
  color: "#d0e2ff",
  lineHeight: 1.65,
  fontSize: 15,
};

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
};

const applyCardStyle: React.CSSProperties = {
  borderRadius: 30,
  padding: 30,
  background:
    "linear-gradient(145deg, rgba(248,251,255,0.98), rgba(232,239,249,0.98))",
  color: "#111827",
  position: "sticky",
  top: 96,
  boxShadow: "0 34px 100px rgba(0,0,0,0.38)",
  border: "1px solid rgba(255,255,255,0.9)",
};

const applyHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  marginBottom: 20,
};

const applyTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 31,
  letterSpacing: "-0.035em",
};

const applyCopyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#4b5563",
  margin: "8px 0 0",
  lineHeight: 1.5,
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

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 88,
  lineHeight: 1.45,
};

const uploadGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
  marginTop: 18,
};

const recommendedStyle: React.CSSProperties = {
  color: "#64748b",
  fontWeight: 750,
};

const uploadBoxStyle: React.CSSProperties = {
  minHeight: 148,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  textAlign: "center",
  border: "1.5px dashed #aebdd3",
  borderRadius: 18,
  background:
    "linear-gradient(180deg, #ffffff, #f7faff)",
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

const submitButtonStyle: React.CSSProperties = {
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

const termsStyle: React.CSSProperties = {
  margin: "14px 0 0",
  color: "#64748b",
  fontSize: 12,
  textAlign: "center",
  lineHeight: 1.4,
};

const mutedTextStyle: React.CSSProperties = {
  color: "#cfe2ff",
  marginTop: 10,
  fontSize: 18,
};
