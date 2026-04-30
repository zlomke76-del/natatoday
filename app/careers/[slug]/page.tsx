import { unstable_noStore as noStore } from "next/cache";
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
        <section
          style={{
            width: "min(1180px, calc(100% - 40px))",
            margin: "0 auto",
            padding: "80px 0",
          }}
        >
          <h1>Role not found</h1>
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

      <section
        style={{
          width: "min(1180px, calc(100% - 40px))",
          margin: "0 auto",
          padding: "72px 0 96px",
        }}
      >
        <div className="eyebrow">Dealership Opportunity</div>

        <h1>{job.title}</h1>

        <p style={{ color: "#cfe2ff", marginTop: 10, fontSize: 18 }}>
          {dealerName} · {location}
          {job.type ? ` · ${job.type}` : ""}
          {job.salary ? ` · ${job.salary}` : ""}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: 32,
            marginTop: 40,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
            {job.role_hook ? (
              <Card title="Why this role is open">{job.role_hook}</Card>
            ) : null}

            {hasItems(job.responsibilities) ? (
              <Card title="What you'll do">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {job.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {hasItems(job.fit_signals) ? (
              <Card title="What makes you a strong fit">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {job.fit_signals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {job.process_note ? (
              <Card title="How the process works">{job.process_note}</Card>
            ) : null}

            {!job.role_hook && job.description ? (
              <Card title="Role overview">{job.description}</Card>
            ) : null}

            {!hasItems(job.fit_signals) && job.requirements ? (
              <Card title="Requirements">{job.requirements}</Card>
            ) : null}

            {isConfidential ? (
              <Card title="Confidential search">
                {job.confidential_note ||
                  "This role is being handled confidentially on behalf of a dealership. Candidate information is reviewed before any dealership handoff."}
              </Card>
            ) : null}
          </div>

          <aside
            style={{
              borderRadius: 28,
              padding: 26,
              background: "#f7f9fc",
              color: "#111",
              position: "sticky",
              top: 100,
              boxShadow: "0 24px 80px rgba(0,0,0,0.22)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: 28 }}>
              Apply for this role
            </h3>

            <p
              style={{
                fontSize: 13,
                color: "#4b5563",
                marginBottom: 18,
                lineHeight: 1.45,
              }}
            >
              We review every application before dealership handoff. If you’re a
              strong fit, you’ll hear from us with next steps.
            </p>

            <form
              method="POST"
              action="/api/nata/apply"
              encType="multipart/form-data"
            >
              <input type="hidden" name="job_id" value={job.id} />

              <Input label="Full name" name="name" required />
              <Input label="Email" name="email" type="email" required />
              <Input label="Phone" name="phone" required />
              <Input label="LinkedIn profile" name="linkedin" />

              <div style={{ marginTop: 12 }}>
                <label>
                  <span style={labelStyle}>Short note</span>
                  <textarea
                    name="cover_note"
                    rows={3}
                    placeholder="Tell us briefly why this role fits you."
                    style={inputStyle}
                  />
                </label>
              </div>

              <UploadField
                label="Profile photo"
                name="profile_photo"
                accept="image/*"
                recommended
                helper="Optional, but helps the recruiting team recognize and remember you."
              />

              <UploadField
                label="Resume"
                name="resume"
                accept=".pdf,.doc,.docx"
                helper="Upload a PDF, DOC, or DOCX resume."
              />

              <button
                style={{
                  marginTop: 20,
                  width: "100%",
                  padding: "15px",
                  borderRadius: 999,
                  background: "#1473ff",
                  color: "#fff",
                  fontWeight: 950,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 15,
                }}
              >
                Send application
              </button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 24,
        padding: 22,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ color: "#cfe2ff", lineHeight: 1.65 }}>{children}</div>
    </div>
  );
}

function Input({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <label>
        <span style={labelStyle}>{label}</span>
        <input name={name} type={type} required={required} style={inputStyle} />
      </label>
    </div>
  );
}

function UploadField({
  label,
  name,
  accept,
  helper,
  recommended = false,
}: {
  label: string;
  name: string;
  accept: string;
  helper: string;
  recommended?: boolean;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <label>
        <span style={labelStyle}>
          {label}{" "}
          {recommended ? (
            <span style={{ color: "#6b7280", fontWeight: 600 }}>
              (recommended)
            </span>
          ) : null}
        </span>

        <div
          style={{
            marginTop: 7,
            border: "1px dashed #b8c2d6",
            borderRadius: 16,
            background: "#fff",
            padding: "16px",
          }}
        >
          <input
            type="file"
            name={name}
            accept={accept}
            style={{
              width: "100%",
              color: "#111827",
              fontSize: 13,
            }}
          />

          <span
            style={{
              display: "block",
              marginTop: 8,
              color: "#6b7280",
              fontSize: 12,
              lineHeight: 1.35,
            }}
          >
            {helper}
          </span>
        </div>
      </label>
    </div>
  );
}

const labelStyle = {
  display: "block",
  color: "#111827",
  fontWeight: 800,
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid #cfd7e6",
  marginTop: 6,
  outline: "none",
  background: "#fff",
  color: "#111",
};
