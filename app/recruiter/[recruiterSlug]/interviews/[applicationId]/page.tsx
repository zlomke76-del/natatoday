"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

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
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

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
            "Room ready. Join the interview, listen if needed, then commit the dealer handoff."
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
      recognitionRef.current?.abort();
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
      ["Live transcript reviewed by recruiter", liveTranscript],
    ];

    return sections
      .filter(([, value]) => String(value || "").trim().length > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n\n");
  }, [guidedNotes, notes, liveTranscript]);

  const validation = useMemo(() => {
    const roomReady = Boolean(roomUrl);
    const interviewStarted = interviewState === "in_progress" || committed;
    const availabilityConfirmed = guidedNotes.availability.trim().length > 0;
    const compensationConfirmed = guidedNotes.compensation.trim().length > 0;
    const recommendationSelected = guidedNotes.recommendation.length > 0;
    const notesPresent = combinedNotes.trim().length >= 20;
    const dealerTimeSelected = dealerInterviewAt.trim().length > 0;
    const scribeReviewSatisfied = !scribeDraft || scribeReviewed;

    return {
      roomReady,
      interviewStarted,
      notesPresent,
      availabilityConfirmed,
      compensationConfirmed,
      recommendationSelected,
      dealerTimeSelected,
      scribeReviewSatisfied,
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

  function startListening() {
    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      setSpeechSupported(false);
      setStatus("Speech capture is not supported in this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (let index = event.resultIndex; index < event.results.length; index++) {
        const transcript = event.results[index][0]?.transcript || "";

        if (event.results[index].isFinal) {
          finalText += transcript;
        } else {
          interimText += transcript;
        }
      }

      if (finalText.trim()) {
        setLiveTranscript((current) =>
          `${current}${current ? "\n" : ""}${finalText.trim()}`
        );
        setScribeReviewed(false);
      }

      setInterimTranscript(interimText.trim());
    };

    recognition.onerror = (event) => {
      setStatus(`Speech capture error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setStatus("Listening. Transcript is draft-only until Don reviews and commits.");
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setInterimTranscript("");
    setStatus("Listening stopped. Review transcript before generating the scribe draft.");
  }

  function joinInterviewRoom() {
    if (!roomUrl || committed) return;

    setInterviewState("in_progress");
    setStatus(
      "Interview in progress. Capture guided notes or use Listen & Draft, then commit the handoff."
    );
  }

  async function generateScribe() {
    if (combinedNotes.trim().length < 20) {
      setStatus("Capture interview notes or transcript before generating scribe.");
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
          transcript: liveTranscript,
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
          transcript: liveTranscript,
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

  function updateGuidedField<K extends keyof GuidedNotes>(
    field: K,
    value: GuidedNotes[K]
  ) {
    setGuidedNotes((current) => ({ ...current, [field]: value }));
    setScribeReviewed(false);
  }

  const canCommit = validation.ready;

  return (
    <main style={layoutStyle}>
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

      <aside style={asideStyle}>
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
            Listen, capture, draft, review, and commit the dealer handoff through
            one governed execution surface.
          </p>
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

        <div style={statusBox}>{status}</div>

        <div style={scribePanel}>
          <div style={panelHeaderRow}>
            <div>
              <div style={eyebrowStyle}>Listen & Draft</div>
              <h2 style={{ margin: "6px 0 0", fontSize: 22 }}>
                Governed live transcript
              </h2>
            </div>

            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              disabled={saving || committed}
              style={{
                ...smallButton,
                border: listening
                  ? "1px solid rgba(74,222,128,0.4)"
                  : smallButton.border,
                background: listening
                  ? "rgba(22,163,74,0.14)"
                  : smallButton.background,
              }}
            >
              {listening ? "Stop listening" : "Start listening"}
            </button>
          </div>

          <p style={{ color: "#9fb4d6", lineHeight: 1.5, fontSize: 14 }}>
            Transcript is draft-only. It feeds the scribe, but nothing reaches
            the dealer packet until reviewed and committed.
          </p>

          {!speechSupported && (
            <div style={warningBox}>
              Browser speech capture is unavailable. Use typed notes instead.
            </div>
          )}

          <textarea
            value={
              interimTranscript
                ? `${liveTranscript}${liveTranscript ? "\n" : ""}${interimTranscript}`
                : liveTranscript
            }
            onChange={(event) => {
              setLiveTranscript(event.target.value);
              setScribeReviewed(false);
            }}
            rows={7}
            placeholder="Live transcript appears here. Don can edit before drafting."
            style={inputStyle}
            disabled={saving || committed}
          />
        </div>

        <div style={sectionPanel}>
          <div style={eyebrowStyle}>Guided Notes</div>
          <h2 style={{ margin: "6px 0 14px", fontSize: 22 }}>
            Interview record
          </h2>

          <ScribeTextField title="Candidate motivation" value={guidedNotes.motivation} onChange={(v) => updateGuidedField("motivation", v)} disabled={saving || committed} />
          <ScribeTextField title="Relevant experience" value={guidedNotes.experience} onChange={(v) => updateGuidedField("experience", v)} disabled={saving || committed} />
          <ScribeTextArea title="Strengths" value={guidedNotes.strengths} onChange={(v) => updateGuidedField("strengths", v)} disabled={saving || committed} />
          <ScribeTextArea title="Concerns / risks" value={guidedNotes.concerns} onChange={(v) => updateGuidedField("concerns", v)} disabled={saving || committed} />
          <ScribeTextField title="Availability" value={guidedNotes.availability} onChange={(v) => updateGuidedField("availability", v)} disabled={saving || committed} />
          <ScribeTextField title="Compensation alignment" value={guidedNotes.compensation} onChange={(v) => updateGuidedField("compensation", v)} disabled={saving || committed} />
          <ScribeTextField title="Communication quality" value={guidedNotes.communication} onChange={(v) => updateGuidedField("communication", v)} disabled={saving || committed} />

          <label style={{ display: "grid", gap: 7, marginTop: 12 }}>
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

          <label style={{ display: "grid", gap: 8, marginTop: 12 }}>
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

          {scribeDraft ? (
            <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
              <div style={splitHeader}>Dealer-facing packet</div>
              <ScribeListField title="Candidate strengths" value={scribeDraft.candidateStrengths.join("\n")} onChange={(v) => updateScribeList("candidateStrengths", v)} disabled={saving || committed} />
              <ScribeTextField title="Availability" value={scribeDraft.availability} onChange={(v) => updateScribeField("availability", v)} disabled={saving || committed} />
              <ScribeTextField title="Compensation alignment" value={scribeDraft.compensationAlignment} onChange={(v) => updateScribeField("compensationAlignment", v)} disabled={saving || committed} />
              <ScribeTextField title="Communication quality" value={scribeDraft.communicationQuality} onChange={(v) => updateScribeField("communicationQuality", v)} disabled={saving || committed} />
              <ScribeTextField title="Role fit" value={scribeDraft.roleFit} onChange={(v) => updateScribeField("roleFit", v)} disabled={saving || committed} />
              <ScribeTextField title="Recommended next step" value={scribeDraft.recommendedNextStep} onChange={(v) => updateScribeField("recommendedNextStep", v)} disabled={saving || committed} />
              <ScribeTextArea title="Dealer-facing summary" value={scribeDraft.dealerFacingSummary} onChange={(v) => updateScribeField("dealerFacingSummary", v)} disabled={saving || committed} />

              <div style={splitHeader}>Internal-only review</div>
              <ScribeListField title="Concerns / risks" value={scribeDraft.concernsOrRisks.join("\n")} onChange={(v) => updateScribeList("concernsOrRisks", v)} disabled={saving || committed} />
              <ScribeTextArea title="Internal-only notes" value={scribeDraft.internalOnlyNotes} onChange={(v) => updateScribeField("internalOnlyNotes", v)} disabled={saving || committed} />

              <label style={reviewBox}>
                <input
                  type="checkbox"
                  checked={scribeReviewed}
                  onChange={(event) => setScribeReviewed(event.target.checked)}
                  disabled={saving || committed}
                />
                <span>
                  Don reviewed this transcript/scribe draft. It is approved for
                  packet handoff.
                </span>
              </label>
            </div>
          ) : (
            <div style={emptyScribeState}>
              Draft after notes or transcript are captured. No scribe content is
              committed until reviewed.
            </div>
          )}
        </div>

        <div style={handoffPanel}>
          <h2 style={{ margin: 0, fontSize: 22 }}>Dealer interview handoff</h2>

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

            <ValidationRow valid={validation.roomReady} label="Interview room exists" />
            <ValidationRow valid={validation.interviewStarted} label="Interview joined / started" />
            <ValidationRow valid={validation.notesPresent} label="Interview record or transcript captured" />
            <ValidationRow valid={validation.availabilityConfirmed} label="Availability confirmed" />
            <ValidationRow valid={validation.compensationConfirmed} label="Compensation confirmed" />
            <ValidationRow valid={validation.recommendationSelected} label="Recommendation selected" />
            <ValidationRow valid={validation.scribeReviewSatisfied} label="Scribe draft reviewed if generated" />
            <ValidationRow valid={validation.dealerTimeSelected} label="Dealer interview time selected" />
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, color: valid ? "#bbf7d0" : "#fef3c7", fontSize: 13, lineHeight: 1.5 }}>
      <span>{valid ? "✔" : "⚠"}</span>
      <span>{label}</span>
    </div>
  );
}

function ScribeTextField({ title, value, onChange, disabled }: { title: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label style={{ display: "grid", gap: 7, marginTop: 12 }}>
      <span style={scribeLabel}>{title}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled} />
    </label>
  );
}

function ScribeTextArea({ title, value, onChange, disabled }: { title: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label style={{ display: "grid", gap: 7, marginTop: 12 }}>
      <span style={scribeLabel}>{title}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} style={inputStyle} disabled={disabled} />
    </label>
  );
}

function ScribeListField({ title, value, onChange, disabled }: { title: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={scribeLabel}>{title}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} placeholder="One item per line" style={inputStyle} disabled={disabled} />
    </label>
  );
}

const layoutStyle = {
  minHeight: "100vh",
  background: "#07111f",
  color: "#fff",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.55fr) minmax(460px, 0.95fr)",
} as const;

const asideStyle = {
  padding: 24,
  borderLeft: "1px solid rgba(255,255,255,0.1)",
  background:
    "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(7,17,31,0.98))",
  overflowY: "auto",
} as const;

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
  background: "rgba(37,99,235,0.12)",
  border: "1px solid rgba(96,165,250,0.24)",
  color: "#dbeafe",
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

const handoffPanel = {
  marginTop: 24,
  paddingTop: 20,
  borderTop: "1px solid rgba(255,255,255,0.1)",
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

const warningBox = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(220,38,38,0.12)",
  border: "1px solid rgba(248,113,113,0.25)",
  color: "#fecaca",
  fontSize: 13,
  lineHeight: 1.45,
  marginBottom: 12,
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

const validationBox = {
  marginTop: 16,
  padding: 14,
  borderRadius: 16,
  background: "rgba(2,6,23,0.62)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;
