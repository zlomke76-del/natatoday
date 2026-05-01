import { NextRequest, NextResponse } from "next/server";

type Recommendation = "advance" | "hold" | "pass" | "";

type GuidedNotes = {
  motivation?: string;
  experience?: string;
  strengths?: string;
  concerns?: string;
  availability?: string;
  compensation?: string;
  communication?: string;
  recommendation?: Recommendation | string;
};

type ScribeRequest = {
  applicationId?: string;
  notes?: string;
  guidedNotes?: GuidedNotes;
  transcript?: string;
  dealerInterviewAt?: string;
};

export async function POST(req: NextRequest) {
  try {
    const {
      applicationId,
      notes,
      guidedNotes = {},
      transcript = "",
      dealerInterviewAt,
    }: ScribeRequest = await req.json();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId" },
        { status: 400 }
      );
    }

    const sourceText = [notes, transcript]
      .map((value) => clean(value))
      .filter(Boolean)
      .join("\n\n");

    if (sourceText.length < 20) {
      return NextResponse.json(
        { error: "Interview notes or transcript are required before scribe generation" },
        { status: 400 }
      );
    }

    const filledGuidedNotes = buildGuidedNotes(sourceText, guidedNotes);

    const scribeDraft = {
      candidateStrengths: listFromText(filledGuidedNotes.strengths) || [
        "Strengths require recruiter confirmation.",
      ],
      concernsOrRisks: listFromText(filledGuidedNotes.concerns) || [
        "No major concerns documented yet.",
      ],
      availability:
        filledGuidedNotes.availability ||
        "Availability not clearly documented.",
      compensationAlignment:
        filledGuidedNotes.compensation ||
        "Compensation alignment not clearly documented.",
      communicationQuality:
        filledGuidedNotes.communication ||
        "Communication quality requires recruiter confirmation.",
      roleFit: buildRoleFit(filledGuidedNotes),
      recommendedNextStep: buildRecommendation(
        filledGuidedNotes.recommendation,
        dealerInterviewAt
      ),
      dealerFacingSummary: buildDealerSummary(filledGuidedNotes),
      internalOnlyNotes: sourceText,
      governance: {
        status: "draft_requires_human_review",
        rule: "Scribe output is not committed until recruiter review and handoff approval.",
      },
    };

    return NextResponse.json({
      guidedNotes: filledGuidedNotes,
      scribeDraft,
    });
  } catch (error) {
    console.error("POST /api/nata/interviews/scribe failed", error);

    return NextResponse.json(
      { error: "Scribe generation failed" },
      { status: 500 }
    );
  }
}

function buildGuidedNotes(sourceText: string, provided: GuidedNotes): Required<GuidedNotes> {
  return {
    motivation:
      clean(provided.motivation) ||
      extractBySignals(sourceText, ["motivat", "why", "interested", "looking", "career", "opportunity"]) ||
      "",
    experience:
      clean(provided.experience) ||
      extractBySignals(sourceText, ["experience", "worked", "years", "background", "sold", "sales", "customer"]) ||
      "",
    strengths:
      clean(provided.strengths) ||
      extractBySignals(sourceText, ["strength", "strong", "good", "great", "clear", "confident", "follow up"]) ||
      "",
    concerns:
      clean(provided.concerns) ||
      extractBySignals(sourceText, ["concern", "risk", "hesitant", "weak", "issue", "gap", "no show"]) ||
      "No major concerns documented yet.",
    availability:
      clean(provided.availability) ||
      extractBySignals(sourceText, ["available", "availability", "start", "schedule", "weekend", "weekday", "morning", "afternoon"]) ||
      "",
    compensation:
      clean(provided.compensation) ||
      extractBySignals(sourceText, ["pay", "salary", "compensation", "commission", "draw", "hourly", "income"]) ||
      "",
    communication:
      clean(provided.communication) ||
      extractBySignals(sourceText, ["communicat", "clear", "confident", "well spoken", "professional", "energy"]) ||
      "",
    recommendation: normalizeRecommendation(provided.recommendation),
  };
}

function buildRoleFit(guidedNotes: Required<GuidedNotes>): string {
  const signals = [
    guidedNotes.experience,
    guidedNotes.strengths,
    guidedNotes.communication,
  ]
    .filter(Boolean)
    .join(" ");

  if (signals.length > 20) {
    return "Role fit is supported by documented experience, strengths, and recruiter-observed communication quality.";
  }

  return "Role fit requires recruiter confirmation.";
}

function buildDealerSummary(guidedNotes: Required<GuidedNotes>): string {
  const parts = [
    guidedNotes.motivation ? `Motivation: ${guidedNotes.motivation}` : "",
    guidedNotes.experience ? `Experience: ${guidedNotes.experience}` : "",
    guidedNotes.strengths ? `Strengths: ${guidedNotes.strengths}` : "",
    guidedNotes.availability ? `Availability: ${guidedNotes.availability}` : "",
    guidedNotes.compensation ? `Compensation alignment: ${guidedNotes.compensation}` : "",
    guidedNotes.communication ? `Communication: ${guidedNotes.communication}` : "",
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  return "Candidate completed the virtual interview. Recruiter review is required before dealer exposure.";
}

function buildRecommendation(
  recommendation: unknown,
  dealerInterviewAt?: string
): string {
  const value = normalizeRecommendation(recommendation);

  if (value === "advance") {
    return dealerInterviewAt
      ? "Advance to dealer interview."
      : "Advance after dealer interview time is selected.";
  }

  if (value === "hold") {
    return "Hold for additional recruiter review before dealer exposure.";
  }

  if (value === "pass") {
    return "Do not advance to dealer interview.";
  }

  return dealerInterviewAt
    ? "Proceed to dealer interview if recruiter approves."
    : "Recommendation requires recruiter selection before commit.";
}

function extractBySignals(text: string, signals: string[]): string {
  const sentences = text
    .split(/[.!?\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const matches = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return signals.some((signal) => lower.includes(signal));
  });

  return matches.slice(0, 2).join(". ");
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function listFromText(value: unknown): string[] | null {
  const raw = clean(value);

  if (!raw) return null;

  const list = raw
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);

  return list.length > 0 ? list : [raw];
}

function normalizeRecommendation(value: unknown): Recommendation {
  if (value === "advance" || value === "hold" || value === "pass") {
    return value;
  }

  return "";
}
