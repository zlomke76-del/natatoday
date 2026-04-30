"use client";

import { useState } from "react";
import Nav from "../../components/Nav";

export default function AdminJobsPage() {
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const form = new FormData(event.currentTarget);

    const payload = {
      title: form.get("title"),
      slug: form.get("slug"),
      dealer_slug: form.get("dealer_slug"),
      location: form.get("location"),
      type: form.get("type"),
      salary: form.get("salary"),
      description: form.get("description"),
      requirements: form.get("requirements"),
      is_active: true
    };

    const res = await fetch("/api/nata/jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nata-admin-key": String(form.get("admin_key") || "")
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Could not create job");
      return;
    }

    setMessage(`Job created: /careers/${data.job.slug}`);
    event.currentTarget.reset();
  }

  return (
    <main className="shell">
      <Nav />

      <section style={{ width: "min(900px, calc(100% - 40px))", margin: "0 auto", padding: "72px 0 96px" }}>
        <div className="eyebrow">Admin</div>
        <h1>Post a job.</h1>
        <p className="lede">Create a role once and use the public careers URL across hiring sites.</p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gap: 14,
            marginTop: 34,
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 30,
            padding: 30,
            background: "rgba(255,255,255,0.06)"
          }}
        >
          <input name="admin_key" placeholder="Admin key" required style={inputStyle} />
          <input name="title" placeholder="Job title" required style={inputStyle} />
          <input name="slug" placeholder="Slug optional" style={inputStyle} />
          <input name="dealer_slug" placeholder="Dealer slug optional" style={inputStyle} />
          <input name="location" placeholder="Location" style={inputStyle} />
          <input name="type" placeholder="Employment type" style={inputStyle} />
          <input name="salary" placeholder="Salary optional" style={inputStyle} />

          <textarea name="description" placeholder="Description" rows={8} required style={textareaStyle} />
          <textarea name="requirements" placeholder="Requirements" rows={6} style={textareaStyle} />

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
            Publish job
          </button>

          {message ? <p style={{ color: "#cfe2ff" }}>{message}</p> : null}
        </form>
      </section>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 50,
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 14,
  padding: "0 14px",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff"
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 160,
  padding: 14,
  resize: "vertical"
};
