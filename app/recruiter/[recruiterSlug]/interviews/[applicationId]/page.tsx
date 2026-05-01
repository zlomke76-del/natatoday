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

type GuidedField = Exclude<keyof GuidedNotes, "recommendation">;

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

const guidedFieldLabels: Record<keyof GuidedNotes, string> = {
  motivation: "Motivation",
  experience: "Experience",
  strengths: "Strengths",
  concerns: "Concerns",
  availability: "Availability",
  compensation: "Compensation",
  communication: "Communication",
  recommendation: "Recommendation",
};

const guidedFieldOrder: GuidedField[] = [
  "motivation",
  "experience",
  "strengths",
  "concerns",
  "availability",
  "compensation",
  "communication",
];

export default function RecruiterInterviewStudio({ params }: StudioProps) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [expandedField, setExpandedField] = useState<GuidedField | null>(null);

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
            "Room ready. Capture the interview, let Solace fill the record, then commit the dealer handoff."
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
      ["Recruiter notes", notes],
      ["Transcript reviewed by recruiter", liveTranscript],
    ];

    return sections
      .filter(([, value]) => String(value || "").trim().length > 0)
      .map(([label, value]) => `${label}: ${value}`)
      .join("\n\n");
  }, [guidedNotes, notes, liveTranscript]);

  const validation = useMemo(() => {
    const roomReady = Boolean(roomUrl);
    const interviewStarted = interviewState === "in_progress" || committed;
    const motivationCaptured = guidedNotes.motivation.trim().length > 0;
    const experienceVerified = guidedNotes.experience.trim().length > 0;
    const availabilityConfirmed = guidedNotes.availability.trim().length > 0;
    const compensationConfirmed = guidedNotes.compensation.trim().length > 0;
    const recommendationSelected = guidedNotes.recommendation.length > 0;
    const notesPresent = combinedNotes.trim().length >= 20;
    const dealerTimeSelected = dealerInterviewAt.trim().length > 0;
    const scribeReviewSatisfied = !scribeDraft || scribeReviewed;

    const checks = [
      roomReady,
      interviewStarted,
      motivationCaptured,
      experienceVerified,
      availabilityConfirmed,
      compensationConfirmed,
      recommendationSelected,
      notesPresent,
      dealerTimeSelected,
      scribeReviewSatisfied,
    ];

    return {
      roomReady,
      interviewStarted,
      motivationCaptured,
      experienceVerified,
      availabilityConfirmed,
      compensationConfirmed,
      recommendationSelected,
      notesPresent,
      dealerTimeSelected,
      scribeReviewSatisfied,
      score: checks.filter(Boolean).length,
      total: checks.length,
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
    : validation.score >= 7
      ? "Review needed"
      : "Not ready";

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
    setStatus("Listening. Transcript remains draft-only until reviewed.");
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
    setInterimTranscript("");
    setStatus("Listening stopped. Use Solace auto-fill to structure the record.");
  }

  function joinInterviewRoom() {
    if (!roomUrl || committed) return;

    setInterviewState("in_progress");
    setStatus(
      "Interview in progress. Capture notes or transcript, then let Solace fill the record."
    );
  }

  async function generateScribe() {
    if (combinedNotes.trim().length < 20) {
      setStatus("Capture notes or transcript before asking Solace to fill the record.");
      return;
    }

    setGeneratingScribe(true);
    setScribeReviewed(false);
    setStatus("Solace is filling the interview record and drafting the packet…");

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

      const nextGuidedNotes = normalizeGuidedNotes(data.guidedNotes || {});
      const nextScribeDraft = normalizeScribeDraft(data.scribeDraft || {});

      setGuidedNotes((current) => ({ ...current, ...nextGuidedNotes }));
      setScribeDraft(nextScribeDraft);
      setStatus("Solace filled the record. Review highlighted fields before commit.");
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
      "Committing packet, packet readiness, and dealer interview handoff…"
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

  function normalizeGuidedNotes(raw: Partial<GuidedNotes>): GuidedNotes {
    return {
      motivation: clean(raw.motivation),
      experience: clean(raw.experience),
      strengths: clean(raw.strengths),
      concerns: clean(raw.concerns),
      availability: clean(raw.availability),
      compensation: clean(raw.compensation),
      communication: clean(raw.communication),
      recommendation: normalizeRecommendation(raw.recommendation),
    };
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

  function updateGuidedField<K extends keyof GuidedNotes>(
    field: K,
    value: GuidedNotes[K]
  ) {
    setGuidedNotes((current) => ({ ...current, [field]: value }));
    setScribeReviewed(false);
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

  const transcriptPreview = interimTranscript
    ? `${liveTranscript}${liveTranscript ? "\n" : ""}${interimTranscript}`
    : liveTranscript;

  const canCommit = validation.ready;

  return (
    <main style={layoutStyle}>
      <section style={roomPaneStyle}>
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

        <div style={{ marginTop: 18 }}>
          <div style={eyebrowStyle}>NATA Virtual Interview Studio</div>
          <h1 style={{ margin: "8px 0 0", fontSize: 32, lineHeight: 1 }}>
            Interview cockpit.
          </h1>
          <p style={{ color: "#bfd6f5", lineHeight: 1.5, marginBottom: 0 }}>
            Capture once. Let Solace structure the record. Review only what matters before handoff.
          </p>
        </div>

        <div style={topActionGrid}>
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
              ? "Interview active"
              : committed
                ? "Interview completed"
                : "Join room"}
          </button>

          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            disabled={saving || committed}
            style={{
              ...secondaryButton,
              border: listening
                ? "1px solid rgba(74,222,128,0.4)"
                : secondaryButton.border,
              background: listening
                ? "rgba(22,163,74,0.14)"
                : secondaryButton.background,
            }}
          >
            {listening ? "Stop listening" : "Start listening"}
          </button>
        </div>

        <div style={statusBox}>{status}</div>

        <div style={readinessBand}>
          <div>
            <div style={eyebrowStyle}>Packet readiness</div>
            <h2 style={{ margin: "5px 0 0", fontSize: 21 }}>{readinessLabel}</h2>
          </div>
          <div style={scorePill}>{validation.score}/{validation.total}</div>
        </div>

        <section style={sectionPanelCompact}>
          <div style={panelHeaderRow}>
            <div>
              <div style={eyebrowStyle}>1 · Capture</div>
              <h2 style={panelTitle}>Transcript + notes</h2>
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
              {generatingScribe ? "Filling…" : "Solace auto-fill"}
            </button>
          </div>

          {!speechSupported && (
            <div style={warningBox}>
              Browser speech capture is unavailable. Use typed notes instead.
            </div>
          )}

          <textarea
            value={transcriptPreview}
            onChange={(event) => {
              setLiveTranscript(event.target.value);
              setScribeReviewed(false);
            }}
            rows={5}
            placeholder="Live transcript appears here. Don can edit before Solace structures it."
            style={inputStyle}
            disabled={saving || committed}
          />

          <textarea
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setScribeReviewed(false);
            }}
            rows={3}
            placeholder="Additional recruiter notes. Optional if transcript is enough."
            style={{ ...inputStyle, marginTop: 10 }}
            disabled={saving || committed}
          />
        </section>

        <section style={sectionPanelCompact}>
          <div style={panelHeaderRow}>
            <div>
              <div style={eyebrowStyle}>2 · Solace Record</div>
              <h2 style={panelTitle}>Review compact fields</h2>
            </div>
          </div>

          <div style={fieldGrid}>
            {guidedFieldOrder.map((field) => (
              <button
                key={field}
                type="button"
                onClick={() => setExpandedField(expandedField === field ? null : field)}
                style={fieldCardStyle(Boolean(guidedNotes[field]))}
              >
                <span style={fieldCardLabel}>{guidedFieldLabels[field]}</span>
                <span style={fieldCardStatus}>
                  {guidedNotes[field] ? "Captured" : "Missing"}
                </span>
              </button>
            ))}
          </div>

          {expandedField && (
            <label style={{ display: "grid", gap: 8, marginTop: 12 }}>
              <span style={scribeLabel}>{guidedFieldLabels[expandedField]}</span>
              <textarea
                value={guidedNotes[expandedField]}
                onChange={(event) =>
                  updateGuidedField(expandedField, event.target.value)
                }
                rows={4}
                style={inputStyle}
                disabled={saving || committed}
              />
            </label>
          )}

          <label style={{ display: "grid", gap: 8, marginTop: 12 }}>
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
        </section>

        <section style={scribePanelCompact}>
          <div style={panelHeaderRow}>
            <div>
              <div style={eyebrowStyle}>3 · Governed Scribe</div>
              <h2 style={panelTitle}>Dealer/internal packet</h2>
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
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              <ScribeTextArea
                title="Dealer-facing summary"
                value={scribeDraft.dealerFacingSummary}
                onChange={(value) => updateScribeField("dealerFacingSummary", value)}
                disabled={saving || committed}
                rows={4}
              />

              <div style={twoColumnGrid}>
                <ScribeListField
                  title="Strengths"
                  value={scribeDraft.candidateStrengths.join("\n")}
                  onChange={(value) => updateScribeList("candidateStrengths", value)}
                  disabled={saving || committed}
                />
                <ScribeListField
                  title="Concerns"
                  value={scribeDraft.concernsOrRisks.join("\n")}
                  onChange={(value) => updateScribeList("concernsOrRisks", value)}
                  disabled={saving || committed}
                />
              </div>

              <details style={detailsStyle}>
                <summary style={summaryStyle}>Show full packet fields</summary>
                <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  <ScribeTextField title="Availability" value={scribeDraft.availability} onChange={(v) => updateScribeField("availability", v)} disabled={saving || committed} />
                  <ScribeTextField title="Compensation alignment" value={scribeDraft.compensationAlignment} onChange={(v) => updateScribeField("compensationAlignment", v)} disabled={saving || committed} />
                  <ScribeTextField title="Communication quality" value={scribeDraft.communicationQuality} onChange={(v) => updateScribeField("communicationQuality", v)} disabled={saving || committed} />
                  <ScribeTextField title="Role fit" value={scribeDraft.roleFit} onChange={(v) => updateScribeField("roleFit", v)} disabled={saving || committed} />
                  <ScribeTextField title="Recommended next step" value={scribeDraft.recommendedNextStep} onChange={(v) => updateScribeField("recommendedNextStep", v)} disabled={saving || committed} />
                  <ScribeTextArea title="Internal-only notes" value={scribeDraft.internalOnlyNotes} onChange={(v) => updateScribeField("internalOnlyNotes", v)} disabled={saving || committed} rows={4} />
                </div>
              </details>

              <label style={reviewBox}>
                <input
                  type="checkbox"
                  checked={scribeReviewed}
                  onChange={(event) => setScribeReviewed(event.target.checked)}
                  disabled={saving || committed}
                />
                <span>
                  Don reviewed this Solace-filled record and approves it for packet handoff.
                </span>
              </label>
            </div>
          ) : (
            <div style={emptyScribeState}>
              Use Solace auto-fill after capturing notes/transcript. The packet stays draft-only until reviewed.
            </div>
          )}
        </section>

        <section style={handoffPanel}>
          <div style={panelHeaderRow}>
            <div>
              <div style={eyebrowStyle}>4 · Commit</div>
              <h2 style={panelTitle}>Dealer interview handoff</h2>
            </div>
          </div>

          <label style={{ display: "grid", gap: 8, marginTop: 12 }}>
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
            <div style={{ fontWeight: 950, marginBottom: 8 }}>
              {committed ? "Committed" : canCommit ? "Ready to commit" : "Missing required state"}
            </div>
            <ValidationRow valid={validation.roomReady} label="Interview room exists" />
            <ValidationRow valid={validation.interviewStarted} label="Interview joined / started" />
            <ValidationRow valid={validation.notesPresent} label="Notes or transcript captured" />
            <ValidationRow valid={validation.availabilityConfirmed} label="Availability confirmed" />
            <ValidationRow valid={validation.compensationConfirmed} label="Compensation confirmed" />
            <ValidationRow valid={validation.recommendationSelected} label="Recommendation selected" />
            <ValidationRow valid={validation.scribeReviewSatisfied} label="Scribe reviewed if generated" />
            <ValidationRow valid={validation.dealerTimeSelected} label="Dealer time selected" />
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
        </section>
      </aside>
    </main>
  );
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRecommendation(value: unknown): Recommendation {
  if (value === "advance" || value === "hold" || value === "pass") {
    return value;
  }

  return "";
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
    <label style={{ display: "grid", gap: 7 }}>
      <span style={scribeLabel}>{title}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} style={inputStyle} disabled={disabled} />
    </label>
  );
}

function ScribeTextArea({ title, value, onChange, disabled, rows = 4 }: { title: string; value: string; onChange: (value: string) => void; disabled: boolean; rows?: number }) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <span style={scribeLabel}>{title}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} style={inputStyle} disabled={disabled} />
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

function fieldCardStyle(valid: boolean) {
  return {
    display: "grid",
    gap: 5,
    textAlign: "left" as const,
    padding: "10px 11px",
    borderRadius: 14,
    border: valid ? "1px solid rgba(74,222,128,0.24)" : "1px solid rgba(250,204,21,0.25)",
    background: valid ? "rgba(22,163,74,0.1)" : "rgba(250,204,21,0.08)",
    color: "#fff",
    cursor: "pointer",
  };
}

const layoutStyle = {
  minHeight: "100vh",
  background: "#07111f",
  color: "#fff",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.6fr) minmax(430px, 0.82fr)",
} as const;

const roomPaneStyle = {
  minHeight: "100vh",
  background: "#030712",
  position: "sticky",
  top: 0,
  alignSelf: "start",
} as const;

const asideStyle = {
  height: "100vh",
  padding: 22,
  borderLeft: "1px solid rgba(255,255,255,0.1)",
  background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(7,17,31,0.98))",
  overflowY: "auto",
} as const;

const eyebrowStyle = {
  color: "#facc15",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 11,
} as const;

const inputStyle = {
  width: "100%",
  padding: 11,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(3,7,18,0.88)",
  color: "#fff",
  outline: "none",
} as const;

const primaryButton = {
  marginTop: 12,
  width: "100%",
  padding: "13px 16px",
  borderRadius: 999,
  border: "none",
  background: "#1473ff",
  color: "#fff",
  fontWeight: 950,
} as const;

const secondaryButton = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 14,
  border: "1px solid rgba(147,197,253,0.35)",
  background: "rgba(37,99,235,0.18)",
  color: "#dbeafe",
  fontWeight: 950,
} as const;

const smallButton = {
  padding: "9px 11px",
  borderRadius: 999,
  border: "1px solid rgba(250,204,21,0.35)",
  background: "rgba(250,204,21,0.12)",
  color: "#fef3c7",
  fontWeight: 950,
  cursor: "pointer",
  whiteSpace: "nowrap",
} as const;

const topActionGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 16,
} as const;

const statusBox = {
  marginTop: 12,
  padding: 12,
  borderRadius: 15,
  lineHeight: 1.45,
  fontSize: 13,
  background: "rgba(37,99,235,0.12)",
  border: "1px solid rgba(96,165,250,0.24)",
  color: "#dbeafe",
} as const;

const readinessBand = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 17,
  background: "linear-gradient(135deg, rgba(37,99,235,0.2), rgba(250,204,21,0.08))",
  border: "1px solid rgba(147,197,253,0.18)",
} as const;

const scorePill = {
  minWidth: 58,
  textAlign: "center",
  padding: "8px 11px",
  borderRadius: 999,
  background: "rgba(2,6,23,0.7)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#dbeafe",
  fontWeight: 950,
} as const;

const sectionPanelCompact = {
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(147,197,253,0.14)",
} as const;

const scribePanelCompact = {
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  background: "rgba(15,23,42,0.72)",
  border: "1px solid rgba(250,204,21,0.18)",
} as const;

const handoffPanel = {
  marginTop: 14,
  padding: 14,
  borderRadius: 18,
  background: "rgba(2,6,23,0.35)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;

const panelHeaderRow = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
} as const;

const panelTitle = {
  margin: "5px 0 0",
  fontSize: 20,
} as const;

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  marginTop: 12,
} as const;

const fieldCardLabel = {
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 950,
} as const;

const fieldCardStatus = {
  color: "#9fb4d6",
  fontSize: 12,
  fontWeight: 800,
} as const;

const scribeLabel = {
  color: "#dbeafe",
  fontSize: 13,
  fontWeight: 900,
} as const;

const twoColumnGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
} as const;

const detailsStyle = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(2,6,23,0.45)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;

const summaryStyle = {
  cursor: "pointer",
  color: "#dbeafe",
  fontWeight: 950,
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
  marginTop: 12,
  marginBottom: 12,
} as const;

const emptyScribeState = {
  marginTop: 12,
  padding: 13,
  borderRadius: 14,
  background: "rgba(2,6,23,0.48)",
  border: "1px dashed rgba(255,255,255,0.18)",
  color: "#9fb4d6",
  fontSize: 14,
  lineHeight: 1.5,
} as const;

const validationBox = {
  marginTop: 12,
  padding: 13,
  borderRadius: 16,
  background: "rgba(2,6,23,0.62)",
  border: "1px solid rgba(255,255,255,0.1)",
} as const;
