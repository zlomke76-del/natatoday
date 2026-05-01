"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StudioProps = {
  params: {
    recruiterSlug: string;
    applicationId: string;
  };
};

type InterviewState =
  | "creating"
  | "ready"
  | "in_progress"
  | "committing"
  | "committed"
  | "error";

type ScribeDraft = {
  candidateStrengths?: string[];
  concernsOrRisks?: string[];
  availability?: string;
  compensationAlignment?: string;
  communicationQuality?: string;
  roleFit?: string;
  recommendedNextStep?: string;
  dealerFacingSummary?: string;
  internalOnlyNotes?: string;
} | null;

export default function RecruiterInterviewStudio({
  params,
}: StudioProps) {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [dealerInterviewAt, setDealerInterviewAt] = useState("");
  const [status, setStatus] = useState("Creating interview room…");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [interviewState, setInterviewState] =
    useState<InterviewState>("creating");

  const [scribeDraft, setScribeDraft] = useState<ScribeDraft>(null);
  const [generatingScribe, setGeneratingScribe] = useState(false);

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
          setInterviewState("ready");
          setStatus(
            "Room ready. Join the interview, complete the conversation, then commit the dealer handoff."
          );
        }
      } catch (error) {
        if (active) {
          setInterviewState("error");
          setStatus(
            error instanceof Error
              ? error.message
              : "Room creation failed"
          );
        }
      }
    }

    createRoom();

    return () => {
      active = false;
    };
  }, [params.applicationId]);

  const validation = useMemo(() => {
    const notesPresent = notes.trim().length >= 20;
    const dealerTimeSelected =
      dealerInterviewAt.trim().length > 0;
    const roomReady = Boolean(roomUrl);
    const interviewStarted =
      interviewState === "in_progress" || committed;

    return {
      roomReady,
      interviewStarted,
      notesPresent,
      dealerTimeSelected,
      ready:
        roomReady &&
        interviewStarted &&
        notesPresent &&
        dealerTimeSelected &&
        !saving &&
        !committed,
    };
  }, [
    notes,
    dealerInterviewAt,
    roomUrl,
    interviewState,
    saving,
    committed,
  ]);

  function joinInterviewRoom() {
    if (!roomUrl || committed) return;

    setInterviewState("in_progress");
    setStatus(
      "Interview in progress. Capture notes, confirm dealer interview time, then commit the handoff."
    );
  }

  async function generateScribe() {
    if (notes.trim().length < 20) {
      setStatus(
        "Add sufficient interview notes before generating scribe."
      );
      return;
    }

    setGeneratingScribe(true);
    setStatus("Generating governed scribe draft…");

    try {
      const response = await fetch(
        "/api/nata/interviews/scribe",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: params.applicationId,
            notes,
            dealerInterviewAt,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Scribe failed");
      }

      setScribeDraft(data.scribeDraft);
      setStatus(
        "Scribe draft generated. Review before commit."
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Scribe generation failed"
      );
    } finally {
      setGeneratingScribe(false);
    }
  }

  async function completeInterviewAndSchedule() {
    if (!validation.ready) return;

    setSaving(true);
    setInterviewState("committing");
    setStatus(
      "Completing interview, generating packet, and scheduling dealer handoff…"
    );

    try {
      const response = await fetch(
        "/api/nata/interviews/complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: params.applicationId,
            notes: notes.trim(),
            dealerInterviewAt,
            scribeDraft,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Interview could not be completed"
        );
      }

      setCommitted(true);
      setInterviewState("committed");
      setStatus(
        "Committed. Packet is ready, dealer interview is scheduled, and the candidate is now eligible for the dealer board."
      );
    } catch (error) {
      setInterviewState("error");
      setStatus(
        error instanceof Error
          ? error.message
          : "Interview completion failed"
      );
    } finally {
      setSaving(false);
    }
  }

  const canCommit = validation.ready;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07111f",
        color: "#fff",
        display: "grid",
        gridTemplateColumns:
          "minmax(0, 1.65fr) minmax(380px, 0.85fr)",
      }}
    >
      {/* VIDEO */}
      <section style={{ background: "#030712" }}>
        {roomUrl ? (
          <iframe
            src={roomUrl}
            allow="camera; microphone; fullscreen"
            style={{
              width: "100%",
              height: "100vh",
              border: "none",
            }}
          />
        ) : (
          <div style={{ padding: 32 }}>{status}</div>
        )}
      </section>

      {/* CONTROL PANEL */}
      <aside
        style={{
          padding: 24,
          borderLeft: "1px solid rgba(255,255,255,0.1)",
          overflowY: "auto",
        }}
      >
        <Link
          href={`/recruiter/${params.recruiterSlug}/dashboard`}
        >
          ← Back
        </Link>

        <h1 style={{ marginTop: 12 }}>
          Interview, document, and commit handoff.
        </h1>

        <button
          onClick={joinInterviewRoom}
          disabled={!roomUrl || committed}
        >
          Join Interview Room
        </button>

        <div style={{ marginTop: 12 }}>{status}</div>

        {/* NOTES */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={8}
          placeholder="Interview notes"
          style={{ width: "100%", marginTop: 12 }}
        />

        {/* SCRIBE */}
        <button
          onClick={generateScribe}
          disabled={generatingScribe}
          style={{ marginTop: 12 }}
        >
          {generatingScribe
            ? "Generating..."
            : "Generate Scribe Draft"}
        </button>

        {scribeDraft && (
          <div style={{ marginTop: 16 }}>
            <h3>Governed Scribe (Review Required)</h3>

            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: 12,
                background: "#020617",
                padding: 12,
                borderRadius: 8,
              }}
            >
              {JSON.stringify(scribeDraft, null, 2)}
            </pre>
          </div>
        )}

        {/* DEALER HANDOFF */}
        <input
          type="datetime-local"
          value={dealerInterviewAt}
          onChange={(e) =>
            setDealerInterviewAt(e.target.value)
          }
          style={{ marginTop: 12 }}
        />

        <button
          onClick={completeInterviewAndSchedule}
          disabled={!canCommit}
          style={{ marginTop: 12 }}
        >
          {committed
            ? "Committed"
            : saving
            ? "Committing..."
            : "Complete interview + schedule dealer"}
        </button>
      </aside>
    </main>
  );
}
