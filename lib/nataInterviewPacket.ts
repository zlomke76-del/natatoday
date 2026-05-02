// lib/nataInterviewPacket.ts

export type InterviewPacket = {
  candidate: {
    id: string;
    name: string;
    role: string;
    photoUrl: string | null;
  };
  interview: {
    scheduledAt: string | null;
    status: string;
  };
  resumeUrl: string | null;
  fitScore: number | null;
  summary: string | null;
  notes: string | null;
  questions: string[];
  verification: string[];
};

export function buildInterviewPacket(application: any): InterviewPacket {
  return {
    candidate: {
      id: application.id,
      name: application.name,
      role: application.role || "Candidate",
      photoUrl: application.profile_photo_url || null,
    },
    interview: {
      scheduledAt: application.virtual_interview_at || null,
      status: application.virtual_interview_status || "pending",
    },
    resumeUrl: application.resume_url || null,
    fitScore: application.fit_score || null,
    summary: application.summary || null,
    notes: application.nata_notes || null,
    questions: application.interview_questions || [],
    verification: [
      "Confirm weekend availability",
      "Confirm follow-up expectations",
      "Confirm schedule",
      "Confirm start date",
      "Confirm compensation alignment",
    ],
  };
}
