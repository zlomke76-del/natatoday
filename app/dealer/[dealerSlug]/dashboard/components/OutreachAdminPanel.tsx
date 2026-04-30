"use client";

import { useEffect, useMemo, useState } from "react";

type OutreachRecord = {
  id: string;
  application_id: string | null;
  candidate_email: string | null;
  candidate_name: string | null;
  job_id: string;
  match_score: number;
  match_reason: string | null;
  recommended_next_step: string | null;
  outreach_status: string;
  message_subject: string | null;
  created_at: string | null;
};

export default function OutreachAdminPanel({
  jobId,
  adminKey,
}: {
  jobId?: string;
  adminKey: string;
}) {
  const [records, setRecords] = useState<OutreachRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams({ status: "pending" });
    if (jobId) params.set("job_id", jobId);
    return `/api/nata/outreach?${params.toString()}`;
  }, [jobId]);

  async function loadOutreach() {
    setLoading(true);
    setError(null);

    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        "x-nata-admin-key": adminKey,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error || "Could not load outreach recommendations.");
      setLoading(false);
      return;
    }

    setRecords(result?.outreach || []);
    setLoading(false);
  }

  useEffect(() => {
    loadOutreach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    setError(null);

    const response = await fetch("/api/nata/outreach", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-nata-admin-key": adminKey,
      },
      body: JSON.stringify({ outreach_id: id, outreach_status: status }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      setError(result?.error || "Could not update outreach.");
      setBusyId(null);
      return;
    }

    if (status === "approved") {
      const sendResponse = await fetch("/api/nata/outreach/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nata-admin-key": adminKey,
        },
        body: JSON.stringify({ outreach_id: id }),
      });

      const sendResult = await sendResponse.json().catch(() => null);

      if (!sendResponse.ok) {
        setError(sendResult?.error || "Approved but could not send email.");
        setBusyId(null);
        return;
      }
    }

    setRecords((current) => current.filter((record) => record.id !== id));
    setBusyId(null);
  }

  return (
    <section
      style={{
        marginTop: 40,
        padding: 24,
        borderRadius: 26,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div className="eyebrow">Candidate re-engagement</div>

      <h2
        style={{
          margin: "10px 0 0",
          color: "#fff",
          fontSize: 30,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        Targeted outreach recommendations
      </h2>

      <p style={{ color: "#bfd6f5", lineHeight: 1.6, maxWidth: 780 }}>
        Solace surfaces eligible prior candidates when a new role may be a stronger fit.
        The NATA team approves outreach before any email is sent.
      </p>

      {error ? (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 16,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.24)",
            color: "#fecaca",
          }}
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p style={{ color: "#9fb4d6" }}>Loading outreach recommendations…</p>
      ) : records.length === 0 ? (
        <p style={{ color: "#9fb4d6" }}>No pending outreach recommendations.</p>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          {records.map((record) => (
            <article
              key={record.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 18,
                alignItems: "start",
                padding: 18,
                borderRadius: 22,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div>
                <strong style={{ color: "#fff", fontSize: 18 }}>
                  {record.candidate_name || "Candidate"}
                </strong>
                <p style={{ margin: "5px 0 0", color: "#9fb4d6" }}>
                  {record.candidate_email}
                </p>
                <p style={{ color: "#cfe2ff", lineHeight: 1.55 }}>
                  {record.match_reason || "Matched to this role based on prior candidate context."}
                </p>
                <p style={{ margin: 0, color: "#9fb4d6", fontSize: 13 }}>
                  Next step: {record.recommended_next_step || "Review and invite candidate to reconnect."}
                </p>
              </div>

              <div style={{ display: "grid", gap: 10, justifyItems: "end" }}>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "8px 11px",
                    borderRadius: 999,
                    background: "rgba(20,115,255,0.18)",
                    border: "1px solid rgba(20,115,255,0.32)",
                    color: "#bfdbfe",
                    fontWeight: 900,
                  }}
                >
                  {record.match_score}/100
                </span>

                <button
                  type="button"
                  disabled={busyId === record.id}
                  onClick={() => updateStatus(record.id, "approved")}
                  className="btn btn-primary"
                >
                  {busyId === record.id ? "Sending…" : "Approve + send"}
                </button>

                <button
                  type="button"
                  disabled={busyId === record.id}
                  onClick={() => updateStatus(record.id, "suppressed")}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#9fb4d6",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Suppress
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
