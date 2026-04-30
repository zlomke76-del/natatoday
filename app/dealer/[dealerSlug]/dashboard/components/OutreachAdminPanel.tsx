"use client";

import { useMemo, useState } from "react";

type OutreachRecord = {
  id: string;
  candidate_name?: string | null;
  candidate_email?: string | null;
  match_score?: number | null;
  match_reason?: string | null;
  recommended_next_step?: string | null;
  outreach_status?: string | null;
  created_at?: string | null;
  jobs?: {
    id?: string;
    title?: string | null;
    slug?: string | null;
    publish_status?: string | null;
    is_active?: boolean | null;
  } | null;
};

type OutreachAdminPanelProps = {
  dealerSlug: string;
  initialOutreach?: OutreachRecord[];
  adminKey?: string;
};

export default function OutreachAdminPanel({
  dealerSlug,
  initialOutreach = [],
  adminKey = process.env.NEXT_PUBLIC_NATA_ADMIN_KEY,
}: OutreachAdminPanelProps) {
  const [records, setRecords] = useState<OutreachRecord[]>(initialOutreach);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const pendingCount = useMemo(
    () => records.filter((record) => record.outreach_status === "pending").length,
    [records]
  );

  async function refresh() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `/api/nata/outreach?dealerSlug=${encodeURIComponent(dealerSlug)}&status=all`,
        { cache: "no-store" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Outreach could not be loaded.");
      }

      setRecords(result.outreach || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Outreach load failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(outreachId: string, outreachStatus: string) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/nata/outreach", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-nata-admin-key": adminKey || "",
        },
        body: JSON.stringify({
          outreach_id: outreachId,
          outreach_status: outreachStatus,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Outreach could not be updated.");
      }

      setRecords((current) =>
        current.map((record) =>
          record.id === outreachId ? result.outreach : record
        )
      );

      setMessage(
        outreachStatus === "approved"
          ? "Outreach approved. It can now be sent."
          : "Outreach suppressed."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Outreach update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function send(outreachId: string) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/nata/outreach/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nata-admin-key": adminKey || "",
        },
        body: JSON.stringify({ outreach_id: outreachId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Outreach could not be sent.");
      }

      setRecords((current) =>
        current.map((record) =>
          record.id === outreachId ? result.outreach : record
        )
      );

      setMessage("Outreach sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Outreach send failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 40,
        padding: 24,
        borderRadius: 28,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div className="eyebrow">Candidate re-engagement</div>
          <h2
            style={{
              margin: "8px 0 0",
              color: "#fff",
              fontSize: 32,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            Previously evaluated candidates matched to open roles.
          </h2>
          <p style={{ maxWidth: 720, color: "#bfd6f5", lineHeight: 1.6 }}>
            Solace surfaces prior candidates when a new role may be a stronger fit.
            NATA reviews outreach before anything is sent.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="btn"
          style={{
            border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginTop: 12,
          color: "#9fb4d6",
          fontSize: 14,
        }}
      >
        <span>{records.length} outreach records</span>
        <span>·</span>
        <span>{pendingCount} pending review</span>
      </div>

      {message ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 14,
            background: "rgba(96,165,250,0.12)",
            border: "1px solid rgba(96,165,250,0.22)",
            color: "#dbeafe",
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {records.length === 0 ? (
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#bfd6f5",
            }}
          >
            No candidate re-engagement records yet.
          </div>
        ) : (
          records.map((record) => (
            <article
              key={record.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                gap: 18,
                padding: 18,
                borderRadius: 20,
                background: "rgba(255,255,255,0.045)",
                border: "1px solid rgba(255,255,255,0.10)",
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
                  {record.candidate_name || "Candidate"}
                </h3>

                <p style={{ margin: "6px 0 0", color: "#9fb4d6" }}>
                  {record.candidate_email || "No email"} ·{" "}
                  {record.jobs?.title || "Open role"}
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 12,
                  }}
                >
                  <Signal value={`Match ${record.match_score ?? 0}/100`} />
                  <Signal value={record.outreach_status || "pending"} />
                  {record.recommended_next_step ? (
                    <Signal value={record.recommended_next_step} />
                  ) : null}
                </div>

                {record.match_reason ? (
                  <p style={{ color: "#bfd6f5", lineHeight: 1.55, marginBottom: 0 }}>
                    {record.match_reason}
                  </p>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  minWidth: 240,
                }}
              >
                {record.outreach_status === "pending" ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={loading}
                      onClick={() => updateStatus(record.id, "approved")}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={loading}
                      onClick={() => updateStatus(record.id, "suppressed")}
                      style={{
                        border: "1px solid rgba(255,255,255,0.16)",
                        color: "#fff",
                        background: "rgba(255,255,255,0.06)",
                      }}
                    >
                      Suppress
                    </button>
                  </>
                ) : null}

                {record.outreach_status === "approved" ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loading}
                    onClick={() => send(record.id)}
                  >
                    Send
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function Signal({ value }: { value: string }) {
  return (
    <span
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: "#d7e8ff",
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {value}
    </span>
  );
}
