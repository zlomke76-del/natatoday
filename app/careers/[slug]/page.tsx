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
  role_hook?: string | null;
  responsibilities?: string[] | null;
  fit_signals?: string[] | null;
  process_note?: string | null;
  display_dealer?: string;
  display_location?: string;
  is_confidential?: boolean;
  confidential_note?: string | null;
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
        <section style={{ padding: "80px 0" }}>
          <h1>Role not found</h1>
        </section>
      </main>
    );
  }

  const dealerName = job.display_dealer || "Dealership";
  const location = job.display_location || job.location || "Location";
  const isConfidential = Boolean(job.is_confidential);

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
        <h1>{job.title}</h1>

        <p style={{ color: "#cfe2ff", marginTop: 10 }}>
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
          }}
        >
          {/* LEFT SIDE */}
          <div style={{ display: "grid", gap: 18 }}>
            
            {job.role_hook && (
              <Card title="Why this role exists">
                {job.role_hook}
              </Card>
            )}

            {job.responsibilities && job.responsibilities.length > 0 && (
              <Card title="What you'll do">
                <ul>
                  {job.responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </Card>
            )}

            {job.fit_signals && job.fit_signals.length > 0 && (
              <Card title="What makes you a strong fit">
                <ul>
                  {job.fit_signals.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </Card>
            )}

            {job.process_note && (
              <Card title="How this works">
                {job.process_note}
              </Card>
            )}

            {job.description && (
              <Card title="About the role">
                {job.description}
              </Card>
            )}

            {job.requirements && (
              <Card title="Requirements">
                {job.requirements}
              </Card>
            )}

            {isConfidential && (
              <Card title="Confidential search">
                {job.confidential_note ||
                  "This role is being handled confidentially on behalf of a dealership."}
              </Card>
            )}
          </div>

          {/* RIGHT SIDE */}
          <div
            style={{
              borderRadius: 24,
              padding: 24,
              background: "#f7f9fc",
              color: "#111",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Apply for this role</h3>

            <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
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
                  Profile photo (recommended)
                  <input type="file" name="profile_photo" accept="image/*" style={{ marginTop: 6 }} />
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
                }}
              >
                Send application
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}

/* COMPONENTS */

function Card({ title, children }: any) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 24,
        padding: 20,
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <div style={{ color: "#cfe2ff", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Input({
  label,
  name,
  type = "text",
  required = false,
}: any) {
  return (
    <div style={{ marginTop: 12 }}>
      <label>
        {label}
        <input
          name={name}
          type={type}
          required={required}
          style={inputStyle}
        />
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
