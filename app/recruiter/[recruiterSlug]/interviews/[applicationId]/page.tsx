"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StudioProps = {
  params: {
    recruiterSlug: string;
    applicationId: string;
  };
};

export default function RecruiterInterviewStudio({ params }: StudioProps) {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [dealerInterviewAt, setDealerInterviewAt] = useState("");
  const [status, setStatus] = useState("Creating interview room…");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    let active = true;

    async function createRoom() {
      try {
        const response = await fetch("/api/nata/interviews/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId: params.applicationId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Room could not be created");
        }

        if (active) {
          setRoomUrl(data.roomUrl);
          setStatus("Room ready. Complete the virtual interview, add notes, then commit the dealer handoff.");
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Room creation failed");
      }
    }

    createRoom();

    return () => {
      active = false;
    };
  }, [params.applicationId]);

  async function completeInterviewAndSchedule() {
    setSaving(true);
    setStatus("Completing interview, generating packet, and scheduling dealer handoff…");

    try {
      const response = await fetch("/api/nata/interviews/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: params.applicationId,
          notes,
          dealerInterviewAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Interview could not be completed");
      }

      setCommitted(true);
      setStatus("Committed. Packet is ready, dealer interview is scheduled, and the candidate is now eligible for the dealer board.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Interview completion failed");
    } finally {
      setSaving(false);
    }
  }

  const canCommit = notes.trim().length > 0 && dealerInterviewAt.trim().length > 0 && !saving && !committed;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07111f",
        color: "#fff",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.65fr) minmax(360px, 0.85fr)",
      }}
    >
      <section style={{ minHeight: "100vh", background: "#030712" }}>
        {roomUrl ? (
          <iframe
            src={roomUrl}
            allow="camera; microphone; fullscreen; display-capture"
            style={{ width: "100%", height: "100vh", border: "none" }}
            title="NATA virtual interview room"
          />
        ) : (
          <div style={{ padding: 32, color: "#bfd6f5" }}>{status}</div>
        )}
      </section>

      <aside
        style={{
          padding: 24,
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(7,17,31,0.98))",
          overflowY: "auto",
        }}
      >
        <Link
          href={`/recruiter/${params.recruiterSlug}/dashboard`}
          style={{ color: "#93c5fd", textDecoration: "none" }}
        >
          ← Back to recruiter dashboard
        </Link>

        <div style={{ marginTop: 22 }}>
          <div
            style={{
              color: "#facc15",
              fontWeight: 950,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontSize: 12,
            }}
          >
            NATA Virtual Interview Studio
          </div>

          <h1 style={{ margin: "10px 0 0", fontSize: 34, lineHeight: 1 }}>
            Interview, document, and commit handoff.
          </h1>

          <p style={{ color: "#bfd6f5", lineHeight: 1.6 }}>
            Add Don/NATA notes and choose the dealer interview time. The system will generate the packet and schedule the manager handoff in one controlled commit.
          </p>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 16,
            background: committed ? "rgba(22,163,74,0.14)" : "rgba(37,99,235,0.12)",
            border: committed
              ? "1px solid rgba(74,222,128,0.28)"
              : "1px solid rgba(96,165,250,0.24)",
            color: committed ? "#dcfce7" : "#dbeafe",
            lineHeight: 1.45,
            fontSize: 14,
          }}
        >
          {status}
        </div>

        <label style={{ display: "grid", gap: 8, marginTop: 22 }}>
          <span style={{ fontWeight: 900 }}>Virtual interview notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={11}
            placeholder="Capture strengths, concerns, availability, compensation alignment, communication quality, and recommendation."
            style={inputStyle}
            disabled={saving || committed}
          />
        </label>

        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>Dealer interview handoff</h2>
          <p style={{ color: "#9fb4d6", lineHeight: 1.5, fontSize: 14 }}>
            This is the commit point. Packet generation, packet readiness, dealer interview time, and dealer-board eligibility are written together.
          </p>

          <label style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <span style={{ fontWeight: 900 }}>Dealer interview date/time</span>
            <input
              type="datetime-local"
              value={dealerInterviewAt}
              onChange={(event) => setDealerInterviewAt(event.target.value)}
              style={inputStyle}
              disabled={saving || committed}
            />
          </label>

          <button
            type="button"
            onClick={completeInterviewAndSchedule}
            disabled={!canCommit}
            style={{
              ...primaryButton,
              opacity: canCommit ? 1 : 0.55,
              cursor: canCommit ? "pointer" : "not-allowed",
            }}
          >
            {committed ? "Dealer handoff committed" : saving ? "Committing handoff…" : "Complete interview + schedule dealer"}
          </button>
        </div>
      </aside>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(3,7,18,0.88)",
  color: "#fff",
  outline: "none",
} as const;

const primaryButton = {
  marginTop: 14,
  width: "100%",
  padding: "13px 16px",
  borderRadius: 999,
  border: "none",
  background: "#1473ff",
  color: "#fff",
  fontWeight: 950,
} as const;
