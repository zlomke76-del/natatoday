import { NextRequest, NextResponse } from "next/server";

type GuidedNotes = {
  motivation?: string;
  experience?: string;
  strengths?: string;
  concerns?: string;
  availability?: string;
  compensation?: string;
  communication?: string;
  recommendation?: string;
};

type ScribeRequest = {
  applicationId?: string;
  notes?: string;
  guidedNotes?: GuidedNotes;
  dealerInterviewAt?: string;
};

export async function POST(req: NextRequest) {
  try {
    const {
      applicationId,
      notes,
      guidedNotes = {},
      dealerInterviewAt,
    }: ScribeRequest = await req.json();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId" },
        { status: 400 }
      );
    }

    if (!notes || notes.trim().length < 20) {
      return NextResponse.json(
        { error: "Interview notes are required before scribe generation" },
        { status: 400 }
      );
    }

    const cleanedNotes = notes.trim();

    const scribeDraft = {
      candidateStrengths: listFromText(guidedNotes.strengths) ?? extractStrengths(cleanedNotes),
      concernsOrRisks: listFromText(guidedNotes.concerns) ?? extractConcerns(cleanedNotes),
      availability:
        clean(guidedNotes.availability) || extractAvailability(cleanedNotes),
      compensationAlignment:
        clean(guidedNotes.compensation) || extractCompensation(cleanedNotes),
      communicationQuality:
        clean(guidedNotes.communication) || extractCommunication(cleanedNotes),
      roleFit: buildRoleFit(cleanedNotes, guidedNotes),
      recommendedNextStep: buildRecommendation(guidedNotes.recommendation, dealerInterviewAt),
      dealerFacingSummary: buildDealerSummary(cleanedNotes, guidedNotes),
      internalOnlyNotes: cleanedNotes,
      governance: {
        status: "draft_requires_human_review",
        rule: "Scribe output is not committed until recruiter review and handoff approval.",
      },
    };

    return NextResponse.json({ scribeDraft });
  } catch (error) {
    console.error("POST /api/nata/interviews/scribe failed", error);

    return NextResponse.json(
      { error: "Scribe generation failed" },
      { status: 500 }
    );
  }
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

function buildRecommendation(
  recommendation: unknown,
  dealerInterviewAt?: string
): string {
  const value = clean(recommendation);

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
    : "Proceed only after dealer interview time is selected.";
}

function buildDealerSummary(notes: string, guidedNotes: GuidedNotes): string {
  const motivation = clean(guidedNotes.motivation);
  const experience = clean(guidedNotes.experience);
  const strengths = clean(guidedNotes.strengths);
  const availability = clean(guidedNotes.availability);
  const compensation = clean(guidedNotes.compensation);

  const parts = [
    motivation ? `Motivation: ${motivation}` : "",
    experience ? `Experience: ${experience}` : "",
    strengths ? `Strengths: ${strengths}` : "",
    availability ? `Availability: ${availability}` : "",
    compensation ? `Compensation alignment: ${compensation}` : "",
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  return `Candidate completed the virtual interview. Recruiter notes indicate the candidate is suitable for review pending final handoff approval. ${notes
    .split(/[.!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(". ")}.`;
}

function buildRoleFit(notes: string, guidedNotes: GuidedNotes): string {
  const experience = clean(guidedNotes.experience);
  const strengths = clean(guidedNotes.strengths);

  if (experience || strengths) {
    return "Role fit supported by documented experience and recruiter-observed strengths.";
  }

  return extractRoleFit(notes);
}

function extractStrengths(notes: string) {
  return sentenceFallback(notes, [
    "Candidate showed relevant communication ability and interview readiness.",
  ]);
}

function extractConcerns(notes: string) {
  const lower = notes.toLowerCase();

  if (
    lower.includes("concern") ||
    lower.includes("risk") ||
    lower.includes("hesitant") ||
    lower.includes("weak")
  ) {
    return sentenceFallback(notes, [
      "Potential concerns were identified in the recruiter notes.",
    ]);
  }

  return ["No major concerns documented yet."];
}

function extractAvailability(notes: string) {
  const lower = notes.toLowerCase();

  if (lower.includes("available") || lower.includes("availability")) {
    return "Availability discussed during interview. Review notes for exact timing.";
  }

  return "Availability not clearly documented.";
}

function extractCompensation(notes: string) {
  const lower = notes.toLowerCase();

  if (
    lower.includes("pay") ||
    lower.includes("salary") ||
    lower.includes("compensation") ||
    lower.includes("commission")
  ) {
    return "Compensation expectations discussed. Review notes before dealer handoff.";
  }

  return "Compensation alignment not clearly documented.";
}

function extractCommunication(notes: string) {
  const lower = notes.toLowerCase();

  if (
    lower.includes("communicat") ||
    lower.includes("well spoken") ||
    lower.includes("clear") ||
    lower.includes("confident")
  ) {
    return "Communication quality appears positive based on recruiter notes.";
  }

  return "Communication quality requires recruiter confirmation.";
}

function extractRoleFit(notes: string) {
  const lower = notes.toLowerCase();

  if (
    lower.includes("sales") ||
    lower.includes("customer") ||
    lower.includes("follow up") ||
    lower.includes("dealership")
  ) {
    return "Candidate appears aligned with dealership-facing role requirements.";
  }

  return "Role fit requires recruiter confirmation.";
}

function sentenceFallback(notes: string, fallback: string[]) {
  const sentences = notes
    .split(/[.!?]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);

  return sentences.length > 0 ? sentences : fallback;
}
