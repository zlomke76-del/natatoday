"use client";

import { useState } from "react";

type CandidateRecord = {
  id: string;
  job_id?: string | null;
  name?: string | null;
  candidate_name?: string | null;
  email?: string | null;
  candidate_email?: string | null;
  screening_status?: string | null;
  fit_score?: number | null;
  screening_summary?: string | null;
  decision_reason?: string | null;
  jobs?: {
    id?: string;
    title?: string | null;
    slug?: string | null;
  } | null;
};

type DecisionRecordPanelProps = {
  candidates?: CandidateRecord[];
  adminKey?: string;
};

const outcomes = [
  { value: "hired", label: "Hired" },
  { value: "not_hired", label: "Not hired" },
  { value: "keep_warm", label: "Keep warm" },
  { value: "no_show", label: "No-show" },
  { value: "needs_followup", label: "Needs another interview" },
];

export default function DecisionRecordPanel({
  candidates = [],
  adminKey = process.env.NEXT_PUBLIC_NATA_ADMIN_KEY,
}: DecisionRecordPanelProps) {
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [outcome, setOutcome] = useState("not_hired");
  const [interviewerName, setInterviewerName] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [verificationFlags, setVerificationFlags] = useState("");
  const [compensationAlignment, setCompensationAlignment] = useState("");
  const [availabilityAlignment, setAvailabilityAlignment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedCandidate = candidates.find(
    (candidate) => candidate.id === selectedApplicationId
  );

  async function submitDecision() {
    setMessage("");

    if (!selectedCandidate) {
      setMessage("Select a candidate before submitting an outcome.");
      return;
    }

    if (!selectedCandidate.job_id) {
      setMessage("This candidate is missing a job_id.");
      return;
    }

    if (!decisionReason.trim()) {
      setMessage("A decision reason is required.");
      return;
    }

    const confirmed =
      outcome !== "hired" ||
      window.confirm(
        "Confirm hire? This will remove the public listing and move the role to Filled Requests."
      );

    if (!confirmed) return;

    setLoading(true);

    try {
      const response = await fetch("/api/nata/decisions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-nata-admin-key": adminKey || "",
        },
        body: JSON.stringify({
          job_id: selectedCandidate.job_id,
          application_id: selectedCandidate.id,
          interviewer_name: interviewerName,
          interview_type: "dealer",
          interview_stage: "2",
          outcome,
          decision_reason: decisionReason,
          strengths: splitLines(strengths),
          concerns: splitLines(concerns),
          verification_flags: splitLines(verificationFlags),
          compensation_alignment: compensationAlignment,
          availability_alignment: availabilityAlignment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Decision could not be submitted.");
      }

      setMessage(
        result.job_closed
          ? "Decision recorded. Candidate placed and public listing removed."
          : "Decision recorded. Candidate status updated and role remains open."
      );

      setDecisionReason("");
      setStrengths("");
      setConcerns("");
      setVerificationFlags("");
      setCompensationAlignment("");
      setAvailabilityAlignment("");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Decision submission failed."
      );
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
      <div className="eyebrow">Dealer interview outcome</div>

      <h2
        style={{
          margin: "8px 0 0",
          color: "#fff",
          fontSize: 32,
          lineHeight: 1,
          letterSpacing: "-0.04em",
        }}
      >
        Document the human decision.
      </h2>

      <p style={{ color: "#bfd6f5", lineHeight: 1.6, maxWidth: 820 }}>
        After the dealership manager interview, record the outcome and why. Only a
        human-submitted hired outcome removes the public listing.
      </p>

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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 16,
          marginTop: 22,
        }}
      >
        <Field label="Candidate">
          <select
            value={selectedApplicationId}
            onChange={(event) => setSelectedApplicationId(event.target.value)}
            style={inputStyle}
          >
            <option value="">Select candidate</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name ||
                  candidate.candidate_name ||
                  candidate.email ||
                  candidate.candidate_email ||
                  "Candidate"}{" "}
                {candidate.jobs?.title ? `— ${candidate.jobs.title}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Outcome">
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            style={inputStyle}
          >
            {outcomes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Interviewer name">
          <input
            value={interviewerName}
            onChange={(event) => setInterviewerName(event.target.value)}
            placeholder="Manager name"
            style={inputStyle}
          />
        </Field>

        <Field label="Compensation alignment">
          <input
            value={compensationAlignment}
            onChange={(event) => setCompensationAlignment(event.target.value)}
            placeholder="Aligned, concern, or note"
            style={inputStyle}
          />
        </Field>

        <Field label="Availability alignment">
          <input
            value={availabilityAlignment}
            onChange={(event) => setAvailabilityAlignment(event.target.value)}
            placeholder="Aligned, concern, or note"
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
        <Field label="Why? Required">
          <textarea
            value={decisionReason}
            onChange={(event) => setDecisionReason(event.target.value)}
            placeholder="Why was this the outcome?"
            rows={4}
            style={textAreaStyle}
          />
        </Field>

        <Field label="Strengths">
          <textarea
            value={strengths}
            onChange={(event) => setStrengths(event.target.value)}
            placeholder="One per line"
            rows={3}
            style={textAreaStyle}
          />
        </Field>

        <Field label="Concerns">
          <textarea
            value={concerns}
            onChange={(event) => setConcerns(event.target.value)}
            placeholder="One per line"
            rows={3}
            style={textAreaStyle}
          />
        </Field>

        <Field label="Verification flags">
          <textarea
            value={verificationFlags}
            onChange={(event) => setVerificationFlags(event.target.value)}
            placeholder="One per line"
            rows={3}
            style={textAreaStyle}
          />
        </Field>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={loading}
        onClick={submitDecision}
        style={{ marginTop: 20 }}
      >
        {loading ? "Submitting..." : "Submit interview outcome"}
      </button>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ color: "#d7e8ff", fontWeight: 850 }}>{label}</span>
      {children}
    </label>
  );
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

const inputStyle = {
  width: "100%",
  minHeight: 48,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(5,10,18,0.88)",
  color: "#fff",
  padding: "0 12px",
  outline: "none",
} as const;

const textAreaStyle = {
  ...inputStyle,
  padding: 12,
  minHeight: 110,
  resize: "vertical",
  lineHeight: 1.5,
} as const;
