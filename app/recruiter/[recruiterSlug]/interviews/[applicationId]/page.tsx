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

type Recommendation = "advance" | "hold" | "pass" | "";

type GuidedNotes = {
  motivation: string;
  experience: string;
  strengths: string;
  concerns: string;
  availability: string;
  compensation: string;
  communication: string;
  recommendation: Recommendation;
};

type ScribeDraft = {
  candidateStrengths: string[];
  concernsOrRisks: string[];
  availability: string;
  compensationAlignment: string;
  communicationQuality: string;
  roleFit: string;
  recommendedNextStep: string;
  dealerFacingSummary: string;
  internalOnlyNotes: string;
};

const emptyGuidedNotes: GuidedNotes = {
  motivation: "",
  experience: "",
  strengths: "",
  concerns: "",
  availability: "",
  compensation: "",
  communication: "",
  recommendation: "",
};

const emptyScribeDraft: ScribeDraft = {
  candidateStrengths: [],
  concernsOrRisks: [],
  availability: "",
  compensationAlignment: "",
  communicationQuality: "",
  roleFit: "",
  recommendedNextStep: "",
  dealerFacingSummary: "",
  internalOnlyNotes: "",
};

export default function RecruiterInterviewStudio({ params }: StudioProps) {
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [guidedNotes, setGuidedNotes] = useState<GuidedNotes>(emptyGuidedNotes);
  const [dealerInterviewAt, setDealerInterviewAt] = useState("");
  const [status, setStatus] = useState("Creating interview room…");
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [interviewState, setInterviewState] =
    useState<InterviewState>("creating");

  const [scribeDraft, setScribeDraft] = useState<ScribeDraft | null>(null);
  const [generatingScribe, setGeneratingScribe] = useState(false);
  const [scribeReviewed, setScribeReviewed] = useState(false);

  useEffect(() => {
    let active = true;

    async function createRoom() {
      try {
        const response = await fetch("/api/nata/interviews/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: params.applicationId,
            recruiterName: "Don",
          }),
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
            error instanceof Error ? error.message : "Room creation failed"
          );
        }
      }
    }

    createRoom();

    return () => {
      active = false;
    };
  }, [params.applicationId]);

  const combinedNotes = useMemo(() => {
    const sections = [
      ["Candidate motivation", guidedNotes.motivation],
      ["Relevant experience", guidedNotes.experience],
      ["Strengths", guidedNotes.strengths],
      ["Concerns / risks", guidedNotes.concerns],
      ["Availability", guidedNotes.availability],
      ["Compensation alignment", guidedNotes.compensation],
      ["Communication quality", guidedNotes.communication],
      ["Recommendation", guidedNotes.recommendation],
      ["Recruiter freeform notes", notes],
    ];

    return sections
      .filter(([, value]) => String(value || "").trim().length > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n\n");
  }, [guidedNotes, notes]);

  const validation = useMemo(() => {
    const roomReady = Boolean(roomUrl);
    const interviewStarted = interviewState === "in_progress" || committed;
    const motivationCaptured = guidedNotes.motivation.trim().length > 0;
    const experienceVerified = guidedNotes.experience.trim().length > 0;
    const availabilityConfirmed = guidedNotes.availability.trim().length > 0;
    const compensationConfirmed = guidedNotes.compensation.trim().length > 0;
    const concernsDocumented = guidedNotes.concerns.trim().length > 0;
    const recommendationSelected = guidedNotes.recommendation.length > 0;
    const notesPresent = combinedNotes.trim().length >= 20;
    const dealerTimeSelected = dealerInterviewAt.trim().length > 0;
    const scribeReviewSatisfied = !scribeDraft || scribeReviewed;

    const readinessScore = [
      roomReady,
      interviewStarted,
      motivationCaptured,
      experienceVerified,
      availabilityConfirmed,
      compensationConfirmed,
      concernsDocumented,
      recommendationSelected,
      notesPresent,
      dealerTimeSelected,
      scribeReviewSatisfied,
    ].filter(Boolean).length;

    const totalChecks = 11;

    return {
      roomReady,
      interviewStarted,
      motivationCaptured,
      experienceVerified,
      availabilityConfirmed,
      compensationConfirmed,
      concernsDocumented,
      recommendationSelected,
      notesPresent,
      dealerTimeSelected,
      scribeReviewSatisfied,
      readinessScore,
      totalChecks,
      ready:
        roomReady &&
        interviewStarted &&
        notesPresent &&
        availabilityConfirmed &&
        compensationConfirmed &&
        recommendationSelected &&
        dealerTimeSelected &&
        scribeReviewSatisfied &&
        !saving &&
        !committed,
    };
  }, [
    roomUrl,
    interviewState,
    committed,
    guidedNotes,
    combinedNotes,
    dealerInterviewAt,
    scribeDraft,
    scribeReviewed,
    saving,
  ]);

  const readinessLabel = validation.ready
    ? "Ready to commit"
    : validation.readinessScore >= 8
      ? "Review needed"
      : "Not ready";

  function updateGuidedField<K extends keyof GuidedNotes>(
    field: K,
    value: GuidedNotes[K]
  ) {
    setGuidedNotes((current) => ({ ...current, [field]: value }));
    setScribeReviewed(false);
  }

  function normalizeScribeDraft(raw: Partial<ScribeDraft>): ScribeDraft {
    return {
      ...emptyScribeDraft,
      ...raw,
      candidateStrengths: Array.isArray(raw.candidateStrengths)
        ? raw.candidateStrengths
        : raw.candidateStrengths
          ? [String(raw.candidateStrengths)]
          : [],
      concernsOrRisks: Array.isArray(raw.concernsOrRisks)
        ? raw.concernsOrRisks
        : raw.concernsOrRisks
          ? [String(raw.concernsOrRisks)]
          : [],
    };
  }

  function updateScribeField<K extends keyof ScribeDraft>(
    field: K,
    value: ScribeDraft[K]
  ) {
    setScribeDraft((current) => {
      const next = current || emptyScribeDraft;
      return { ...next, [field]: value };
    });
    setScribeReviewed(false);
  }

  function updateScribeList(
    field: "candidateStrengths" | "concernsOrRisks",
    value: string
  ) {
    const list = value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    updateScribeField(field, list);
  }

  function joinInterviewRoom() {
    if (!roomUrl || committed) return;

    setInterviewState("in_progress");
    setStatus(
      "Interview in progress. Capture guided notes, draft the scribe, confirm dealer time, then commit the handoff."
    );
  }

  async function generateScribe() {
    if (combinedNotes.trim().length < 20) {
      setStatus("Capture interview notes before generating scribe.");
      return;
    }

    setGeneratingScribe(true);
    setScribeReviewed(false);
    setStatus("Generating governed scribe draft…");

    try {
      const response = await fetch("/api/nata/interviews/scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: params.applicationId,
          notes: combinedNotes,
          guidedNotes,
          dealerInterviewAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Scribe failed");
      }

      setScribeDraft(normalizeScribeDraft(data.scribeDraft || {}));
      setStatus("Scribe draft generated. Review and approve before commit.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Scribe generation failed"
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
      const response = await fetch("/api/nata/interviews/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: params.applicationId,
          notes: combinedNotes,
          guidedNotes,
          dealerInterviewAt,
          scribeDraft,
          scribeReviewed,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Interview could not be completed");
      }

      setCommitted(true);
      setInterviewState("committed");
      setStatus(
        "Committed. Packet is ready, dealer interview is scheduled, and the candidate is now eligible for the dealer board."
      );
    } catch (error) {
      setInterviewState("error");
      setStatus(
        error instanceof Error ? error.message : "Interview completion failed"
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
        gridTemplateColumns: "minmax(0, 1.55fr) minmax(460px, 0.95fr)",
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
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(7,17,31,0.98))",
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
          <div style={eyebrowStyle}>NATA Virtual Interview Studio</div>

          <h1 style={{ margin: "10px 0 0", fontSize: 34, lineHeight: 1 }}>
            Interview cockpit.
          </h1>

          <p style={{ color: "#bfd6f5", lineHeight: 1.6 }}>
            Guide the interview, generate a governed scribe draft, verify packet
            readiness, then commit the dealer handoff in one controlled action.
          </p>
        </div>

        <div style={contextCard}>
          <div>
            <div style={contextLabel}>Application</div>
            <div style={contextValue}>{params.applicationId.slice(0, 8)}…</div>
          </div>
          <div>
            <div style={contextLabel}>Recruiter</div>
            <div style={contextValue}>{params.recruiterSlug}</div>
          </div>
          <div>
            <div style={contextLabel}>State</div>
            <div style={contextValue}>
              {committed ? "dealer handoff committed" : interviewState}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={joinInterviewRoom}
          disabled={!roomUrl || committed}
          style={{
            ...secondaryButton,
            opacity: roomUrl && !committed ? 1 : 0.55,
            cursor: roomUrl && !committed ? "pointer" : "not-allowed",
          }}
        >
          {interviewState === "in_progress"
            ? "Interview room active"
            : committed
              ? "Interview completed"
              : "Join Interview Room"}
        </button>

        <div
          style={{
            ...statusBox,
            background: committed
              ? "rgba(22,163,74,0.14)"
              : interviewState === "error"
                ? "rgba(220,38,38,0.14)"
                : "rgba(37,99,235,0.12)",
            border: committed
              ? "1px solid rgba(74,222,128,0.28)"
              : interviewState === "error"
                ? "1px solid rgba(248,113,113,0.3)"
                : "1px solid rgba(96,165,250,0.24)",
            color: committed
              ? "#dcfce7"
              : interviewState === "error"
                ? "#fecaca"
                : "#dbeafe",
          }}
        >
          {status}
        </div>

        <div style={readinessBand}>
          <div>
            <div style={eyebrowStyle}>Packet readiness</div>
            <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>
              {readinessLabel}
            </h2>
          </div>
          <div style={scorePill}>
            {validation.readinessScore}/{validation.totalChecks}
          </div>
        </div>

        <div style={checklistBox}>
          <div style={{ fontWeight: 950, marginBottom: 10 }}>
            Interview checklist
          </div>
          <ValidationRow
            valid={validation.interviewStarted}
            label="Opening completed / interview started"
          />
          <ValidationRow
            valid={validation.motivationCaptured}
            label="Candidate motivation captured"
          />
          <ValidationRow
            valid={validation.experienceVerified}
            label="Experience verified"
          />
          <ValidationRow
            valid={validation.availabilityConfirmed}
            label="Availability confirmed"
          />
          <ValidationRow
            valid={validation.compensationConfirmed}
            label="Compensation confirmed"
          />
          <ValidationRow
            valid={validation.concernsDocumented}
            label="Concerns documented"
          />
          <ValidationRow
            valid={validation.recommendationSelected}
            label="Recommendation selected"
          />
        </div>

        <div style={sectionPanel}>
          <div style={panelHeaderRow}>
            <div>
              <div style={eyebrowStyle}>Guided Notes</div>
              <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>
                Interview record
              </h2>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <ScribeTextField
              title="Candidate motivation"
              value={guidedNotes.motivation}
              onChange={(value) => updateGuidedField("motivation", value)}
              disabled={saving || committed}
            />

            <ScribeTextField
              title="Relevant experience"
              value={guidedNotes.experience}
              onChange={(value) => updateGuidedField("experience", value)}
              disabled={saving || committed}
            />

            <ScribeTextArea
              title="Strengths"
              value={guidedNotes.strengths}
              onChange={(value) => updateGuidedField("strengths", value)}
              disabled={saving || committed}
            />

            <ScribeTextArea
              title="Concerns / risks"
              value={guidedNotes.concerns}
              onChange={(value) => updateGuidedField("concerns", value)}
              disabled={saving || committed}
            />

            <ScribeTextField
              title="Availability"
              value={guidedNotes.availability}
              onChange={(value) => updateGuidedField("availability", value)}
              disabled={saving || committed}
            />

            <ScribeTextField
              title="Compensation alignment"
              value={guidedNotes.compensation}
              onChange={(value) => updateGuidedField("compensation", value)}
              disabled={saving || committed}
            />

            <ScribeTextField
              title="Communication quality"
              value={guidedNotes.communication}
              onChange={(value) => updateGuidedField("communication", value)}
              disabled={saving || committed}
            />

            <label style={{ display: "grid", gap: 7 }}>
              <span style={scribeLabel}>Recommendation</span>
              <select
                value={guidedNotes.recommendation}
                onChange={(event) =>
                  updateGuidedField(
                    "recommendation",
                    event.target.value as Recommendation
                  )
                }
                style={inputStyle}
                disabled={saving || committed}
              >
                <option value="">Select recommendation</option>
                <option value="advance">Advance to dealer interview</option>
                <option value="hold">Hold / needs review</option>
                <option value="pass">Pass</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 900 }}>Additional recruiter notes</span>
              <textarea
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setScribeReviewed(false);
                }}
                rows={5}
                placeholder="Capture any details that do not fit the guided fields."
                style={inputStyle}
                disabled={saving || committed}
              />
            </label>
          </div>
        </div>

        <div style={scribePanel}>
          <div style={panelHeaderRow}>
            <div>
              <div style={eyebrowStyle}>Governed Scribe</div>
              <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>
                Reviewable packet draft
              </h2>
            </div>

            <button
              type="button"
              onClick={generateScribe}
              disabled={generatingScribe || saving || committed}
              style={{
                ...smallButton,
                opacity: generatingScribe || saving || committed ? 0.55 : 1,
              }}
            >
              {generatingScribe ? "Drafting…" : "Draft packet"}
            </button>
          </div>

          <p style={{ color: "#9fb4d6", lineHeight: 1.5, fontSize: 14 }}>
            The scribe is draft-only. Don reviews and approves the dealer-facing
            record before it can travel with the handoff.
          </p>

          {scribeDraft ? (
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              <div style={splitHeader}>Dealer-facing packet</div>

              <ScribeListField
                title="Candidate strengths"
                value={scribeDraft.candidateStrengths.join("\n")}
                onChange={(value) =>
                  updateScribeList("candidateStrengths", value)
                }
                disabled={saving || committed}
              />

              <ScribeTextField
                title="Availability"
                value={scribeDraft.availability}
                onChange={(value) => updateScribeField("availability", value)}
                disabled={saving || committed}
              />

              <ScribeTextField
                title="Compensation alignment"
                value={scribeDraft.compensationAlignment}
                onChange={(value) =>
                  updateScribeField("compensationAlignment", value)
                }
                disabled={saving || committed}
              />

              <ScribeTextField
                title="Communication quality"
                value={scribeDraft.communicationQuality}
                onChange={(value) =>
                  updateScribeField("communicationQuality", value)
                }
                disabled={saving || committed}
              />

              <ScribeTextField
                title="Role fit"
                value={scribeDraft.roleFit}
                onChange={(value) => updateScribeField("roleFit", value)}
                disabled={saving || committed}
              />

              <ScribeTextField
                title="Recommended next step"
                value={scribeDraft.recommendedNextStep}
                onChange={(value) =>
                  updateScribeField("recommendedNextStep", value)
                }
                disabled={saving || committed}
              />

              <ScribeTextArea
                title="Dealer-facing summary"
                value={scribeDraft.dealerFacingSummary}
                onChange={(value) =>
                  updateScribeField("dealerFacingSummary", value)
                }
                disabled={saving || committed}
              />

              <div style={splitHeader}>Internal-only review</div>

              <ScribeListField
                title="Concerns / risks"
                value={scribeDraft.concernsOrRisks.join("\n")}
                onChange={(value) => updateScribeList("concernsOrRisks", value)}
                disabled={saving || committed}
              />

              <ScribeTextArea
                title="Internal-only notes"
                value={scribeDraft.internalOnlyNotes}
                onChange={(value) =>
                  updateScribeField("internalOnlyNotes", value)
                }
                disabled={saving || committed}
              />

              <label style={reviewBox}>
                <input
                  type="checkbox"
                  checked={scribeReviewed}
                  onChange={(event) => setScribeReviewed(event.target.checked)}
                  disabled={saving || committed}
                />
                <span>
                  Don reviewed this scribe draft. It is approved for inclusion
                  in the packet handoff.
                </span>
              </label>
            </div>
          ) : (
            <div style={emptyScribeState}>
              Draft after interview notes are captured. No scribe content is
              committed until reviewed.
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22 }}>Dealer interview handoff</h2>

          <p style={{ color: "#9fb4d6", lineHeight: 1.5, fontSize: 14 }}>
            This is the commit point. Packet generation, packet readiness,
            dealer interview time, and dealer-board eligibility are written
            together.
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

          <div style={validationBox}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>
              {committed
                ? "Committed"
                : canCommit
                  ? "Ready to commit"
                  : "Missing required state"}
            </div>

            <ValidationRow
              valid={validation.roomReady}
              label="Interview room exists"
            />
            <ValidationRow
              valid={validation.interviewStarted}
              label="Interview joined / started"
            />
            <ValidationRow
              valid={validation.notesPresent}
              label="Interview record captured"
            />
            <ValidationRow
              valid={validation.availabilityConfirmed}
              label="Availability confirmed"
            />
            <ValidationRow
              valid={validation.compensationConfirmed}
              label="Compensation confirmed"
            />
            <ValidationRow
              valid={validation.recommendationSelected}
              label="Recommendation selected"
            />
            <ValidationRow
              valid={validation.scribeReviewSatisfied}
              label="Scribe draft reviewed if generated"
            />
            <ValidationRow
              valid={validation.dealerTimeSelected}
              label="Dealer interview time selected"
            />
          </div>

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
            {committed
              ? "Dealer handoff committed"
              : saving
                ? "Committing handoff…"
                : "Commit packet + schedule dealer handoff"}
          </button>
        </div>
      </aside>
    </main>
  );
}

function ValidationRow({ valid, label }: { valid: boolean; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: valid ? "#bbf7d0" : "#fef3c7",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <span>{valid ? "✔" : "⚠"}</span>
      <span>{label}</span>
    </div>
  );
}

function ScribeTextField({
  title,
  value,
  onChange,
  disabled,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={scribeLabel}>{title}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
        disabled={disabled}
      />
    </label>
  );
}

function ScribeTextArea({
  title,
  value,
  onChange,
  disabled,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={scribeLabel}>{title}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        style={inputStyle}
        disabled={disabled}
      />
    </label>
  );
}

function ScribeListField({
  title,
  value,
  onChange,
  disabled,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={scribeLabel}>{title}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        placeholder="One item per line"
        style={inputStyle}
        disabled={disabled}
      />
    </label>
  );
}

const eyebrowStyle = {
  color: "#facc15",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 12,
} as const;

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

const secondaryButton = {
  marginTop: 16,
  width: "100%",
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(147,197,253,0.35)",
  background: "rgba(37,99,235,0.18)",
  color: "#dbeafe",
  fontWeight: 950,
} as const;

const smallButton = {
  padding: "10px 12px",
  borderRadius: 999,
  border: "1px solid rgba(250,204,21,0.35)",
  background: "rgba(250,204,21,0.12)",
  color: "#fef3c7",
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
} as const;

const statusBox = {
  marginTop: 18,
  padding: 14,
  borderRadius: 16,
  lineHeight: 1.45,
  fontSize: 14,
} as const;

const contextCard = {
  marginTop: 18,
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 10,
  padding: 14,
  borderRadius: 18,
  background: "rgba(2,6,23,0.62)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;

const contextLabel = {
  color: "#8fb2df",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
} as const;

const contextValue = {
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
  marginTop: 4,
  textTransform: "capitalize",
} as const;

const readinessBand = {
  marginTop: 18,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 16,
  borderRadius: 18,
  background:
    "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(250,204,21,0.08))",
  border: "1px solid rgba(147,197,253,0.18)",
} as const;

const scorePill = {
  minWidth: 64,
  textAlign: "center",
  padding: "9px 12px",
  borderRadius: 999,
  background: "rgba(2,6,23,0.7)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#dbeafe",
  fontWeight: 950,
} as const;

const checklistBox = {
  marginTop: 16,
  padding: 14,
  borderRadius: 16,
  background: "rgba(2,6,23,0.54)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;

const validationBox = {
  marginTop: 16,
  padding: 14,
  borderRadius: 16,
  background: "rgba(2,6,23,0.62)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;

const sectionPanel = {
  marginTop: 22,
  padding: 16,
  borderRadius: 18,
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(147,197,253,0.14)",
} as const;

const scribePanel = {
  marginTop: 22,
  padding: 16,
  borderRadius: 18,
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(250,204,21,0.18)",
} as const;

const panelHeaderRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
} as const;

const scribeLabel = {
  color: "#dbeafe",
  fontSize: 13,
  fontWeight: 900,
} as const;

const splitHeader = {
  marginTop: 2,
  paddingTop: 8,
  color: "#facc15",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
} as const;

const reviewBox = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: 12,
  borderRadius: 14,
  background: "rgba(22,163,74,0.12)",
  border: "1px solid rgba(74,222,128,0.22)",
  color: "#dcfce7",
  fontSize: 13,
  lineHeight: 1.45,
} as const;

const emptyScribeState = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  background: "rgba(2,6,23,0.48)",
  border: "1px dashed rgba(255,255,255,0.18)",
  color: "#9fb4d6",
  fontSize: 14,
  lineHeight: 1.5,
} as const;
