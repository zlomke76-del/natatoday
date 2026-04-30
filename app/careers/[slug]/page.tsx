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

async function getJob(slug: string): Promise<Job | null> {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("publish_status", "published")
    .single();

  if (error || !data) return null;
  return data;
}

export default async function JobPage({
  params,
}: {
  params: { slug: string };
}) {
  const job = await getJob(params.slug);

  if (!job) {
    return (
      <main className="shell">
        <Nav />
        <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "80px 0" }}>
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

            {job.responsibilities && job.responsibilities.length > 0 ? (
              <Card title="What you'll do">
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {job.responsibilities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {job.fit_signals && job.fit_signals.length > 0 ? (
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

            {job.description ? (
              <Card title="Role overview">{job.description}</Card>
            ) : null}

            {job.requirements ? (
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
              borderRadius: 24,
              padding: 24,
              background: "#f7f9fc",
              color: "#111",
              position: "sticky",
              top: 100,
            }}
          >
            <h3 style={{ marginTop: 0, fontSize: 26 }}>Apply for this role</h3>

            <p style={{ fontSize: 13, color: "#555", marginBottom: 16, lineHeight: 1.45 }}>
              We review every application before dealership handoff. If you’re a strong fit,
              you’ll hear from us with next steps.
            </p>

            <form method="POST" action="/api/nata/apply" encType="multipart/form-data">
              <input type="hidden" name="job_id" value={job.id} />

              <Input label="Full name" name="name" required />
              <Input label="Email" name="email" type="email" required />
              <Input label="Phone" name="phone" required />
              <Input label="LinkedIn profile" name="linkedin" />

              <div style={{ marginTop: 12 }}>
                <label>
                  Short note
                  <textarea name="cover_note" rows={3} style={inputStyle} />
                </label>
              </div>

              <div style={{ marginTop: 14 }}>
                <label>
                  Profile photo <span style={{ color: "#666" }}>(recommended)</span>
                  <input
                    type="file"
                    name="profile_photo"
                    accept="image/*"
                    style={{ marginTop: 6, display: "block" }}
                  />
                  <span style={{ display: "block", fontSize: 12, color: "#666", marginTop: 6 }}>
                    Helps the team recognize and remember candidates.
                  </span>
                </label>
              </div>

              <button
                style={{
                  marginTop: 18,
                  width: "100%",
                  padding: "14px",
                  borderRadius: 999,
                  background: "#1473ff",
                  color: "#fff",
                  fontWeight: 900,
                  border: "none",
                  cursor: "pointer",
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
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
        {label}
        <input name={name} type={type} required={required} style={inputStyle} />
      </label>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: 8,
  border: "1px solid #ccc",
  marginTop: 6,
};

