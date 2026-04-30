"use client";

import { useEffect, useState } from "react";
import Nav from "../../components/Nav";

export default function JobDetailPage({ params }: { params: { slug: string } }) {
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadJob() {
      const res = await fetch(`/api/nata/jobs?slug=${params.slug}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Job not found");
        setLoading(false);
        return;
      }

      setJob(data.job);
      setLoading(false);
    }

    loadJob();
  }, [params.slug]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const formData = new FormData(event.currentTarget);

    const res = await fetch("/api/nata/apply", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Application could not be submitted");
      return;
    }

    setSubmitted(true);
    event.currentTarget.reset();
  }

  return (
    <main className="shell">
      <Nav />

      <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "72px 0 96px" }}>
        {loading ? (
          <p className="lede">Loading role...</p>
        ) : error && !job ? (
          <p className="lede">{error}</p>
        ) : (
          <>
            <div className="eyebrow">Open Role</div>

            <h1>{job.title}</h1>

            <p className="lede">
              {job.location} {job.type ? `· ${job.type}` : ""} {job.salary ? `· ${job.salary}` : ""}
            </p>

            <div
              style={{
                marginTop: 36,
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 0.9fr)",
                gap: 28,
                alignItems: "start"
              }}
            >
              <article
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 30,
                  padding: 30,
                  background: "rgba(255,255,255,0.06)",
                  color: "#dcecff",
                  lineHeight: 1.7
                }}
              >
                <h2 style={{ marginTop: 0, color: "#fff" }}>Role overview</h2>
                <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>

                {job.requirements ? (
                  <>
                    <h2 style={{ color: "#fff" }}>Requirements</h2>
                    <p style={{ whiteSpace: "pre-wrap" }}>{job.requirements}</p>
                  </>
                ) : null}
              </article>

              <aside
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 30,
                  padding: 30,
                  background: "#ffffff",
                  color: "#0f172a"
                }}
              >
                <h2 style={{ marginTop: 0 }}>Apply now</h2>

                {submitted ? (
                  <p>Your application has been submitted.</p>
                ) : (
                  <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
                    <input type="hidden" name="job_id" value={job.id} />

                    <input name="name" placeholder="Full name" required style={inputStyle} />
                    <input name="email" type="email" placeholder="Email" required style={inputStyle} />
                    <input name="phone" placeholder="Phone" style={inputStyle} />
                    <input name="linkedin" placeholder="LinkedIn profile" style={inputStyle} />

                    <textarea
                      name="cover_note"
                      placeholder="Short note"
                      rows={5}
                      style={{ ...inputStyle, resize: "vertical" }}
                    />

                    <label style={{ fontSize: 13, fontWeight: 800 }}>Resume</label>
                    <input name="resume" type="file" accept=".pdf,.doc,.docx" required style={inputStyle} />

                    {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

                    <button
                      type="submit"
                      style={{
                        minHeight: 52,
                        border: 0,
                        borderRadius: 999,
                        background: "#1473ff",
                        color: "#ffffff",
                        fontWeight: 900,
                        cursor: "pointer"
                      }}
                    >
                      Submit application
                    </button>
                  </form>
                )}
              </aside>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  border: "1px solid #d7e0ed",
  borderRadius: 14,
  padding: "0 14px",
  background: "#ffffff",
  color: "#0f172a"
};
