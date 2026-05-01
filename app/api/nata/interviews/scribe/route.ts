import { NextRequest, NextResponse } from "next/server";

type ScribeRequest = {
  applicationId?: string;
  notes?: string;
  dealerInterviewAt?: string;
};

export async function POST(req: NextRequest) {
  try {
    const { applicationId, notes, dealerInterviewAt }: ScribeRequest =
      await req.json();

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
      candidateStrengths: extractStrengths(cleanedNotes),
      concernsOrRisks: extractConcerns(cleanedNotes),
      availability: extractAvailability(cleanedNotes),
      compensationAlignment: extractCompensation(cleanedNotes),
      communicationQuality: extractCommunication(cleanedNotes),
      roleFit: extractRoleFit(cleanedNotes),
      recommendedNextStep: dealerInterviewAt
        ? "Proceed to dealer interview."
        : "Proceed only after dealer interview time is selected.",
      dealerFacingSummary:
        "Candidate completed the virtual interview. Recruiter notes indicate the candidate is suitable for dealer review pending final handoff approval.",
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
    return sentenceFallback(notes, ["Potential concerns were identified in the recruiter notes."]);
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
