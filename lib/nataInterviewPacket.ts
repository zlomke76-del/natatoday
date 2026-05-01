import { supabaseAdmin } from "./supabaseAdmin";

type AnyRow = Record<string, any>;

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getRole(job: AnyRow | null, application: AnyRow) {
  return asText(job?.title, asText(application.role, asText(application.job_title, "the role")));
}

function getCandidateName(application: AnyRow) {
  return asText(
    application.name,
    asText(application.candidate_name, asText(application.full_name, "the candidate"))
  );
}

function buildInterviewQuestions(role: string) {
  const lower = role.toLowerCase();

  if (lower.includes("technician")) {
    return [
      "Walk me through the diagnostic or repair work you are strongest in.",
      "Which certifications, tools, or shop experience should we verify today?",
      "How do you communicate findings, delays, or additional repair needs to the advisor?",
      "What schedule and compensation structure are you looking for?",
    ];
  }

  if (lower.includes("advisor")) {
    return [
      "How do you handle a customer who is frustrated about cost, timing, or a repeat repair?",
      "How do you stay organized when multiple repair orders are moving at once?",
      "What service-lane metrics, DMS workflows, or follow-up processes have you worked with before?",
      "What would help you succeed quickly in this store?",
    ];
  }

  if (lower.includes("bdc")) {
    return [
      "How do you organize follow-up when several customers need contact the same day?",
      "What makes a phone or text follow-up feel helpful instead of pushy?",
      "Tell me about a time you turned a cold or stalled lead into an appointment.",
      "What schedule and call volume are you comfortable supporting?",
    ];
  }

  if (lower.includes("sales")) {
    return [
      "Walk me through how you follow up with a customer who is interested but not ready to buy today.",
      "Tell me about a time you had to explain a higher-priced product to a hesitant customer.",
      "How do you stay organized when multiple customers, calls, and appointments are in motion?",
      "What would help you ramp quickly in this dealership environment?",
    ];
  }

  return [
    "What about this role is the strongest fit for your background?",
    "What should we verify before making a hiring decision?",
    "What schedule, compensation, or start-date details matter for you?",
    "What would help you succeed quickly in this dealership environment?",
  ];
}

function buildVerificationItems(role: string) {
  const lower = role.toLowerCase();
  const common = ["Confirm schedule", "Confirm start date", "Confirm compensation alignment"];

  if (lower.includes("technician")) {
    return ["Confirm ASE/OEM certifications", "Confirm tool availability", ...common].slice(0, 5);
  }

  if (lower.includes("sales") || lower.includes("bdc")) {
    return ["Confirm weekend availability", "Confirm follow-up expectations", ...common].slice(0, 5);
  }

  if (lower.includes("advisor")) {
    return ["Confirm service-lane experience", "Confirm DMS/process familiarity", ...common].slice(0, 5);
  }

  return common;
}

function buildNataNotes({
  application,
  job,
  virtualNotes,
}: {
  application: AnyRow;
  job: AnyRow | null;
  virtualNotes: string;
}) {
  const name = getCandidateName(application);
  const role = getRole(job, application);
  const screeningSummary = asText(application.screening_summary);
  const coverNote = asText(application.cover_note);
  const fitScore = application.fit_score ? ` Fit score: ${application.fit_score}.` : "";
  const notesLine = virtualNotes ? ` Virtual interview notes: ${virtualNotes}` : "";
  const summaryLine = screeningSummary || coverNote || "Candidate has been reviewed for manager handoff.";

  return `NATA review: ${name} is being advanced for ${role}. ${summaryLine}${fitScore}${notesLine} Use the manager interview to verify role fit, availability, compensation alignment, communication discipline, and any remaining concerns before a final hiring decision.`;
}

export async function generateInterviewPacket(applicationId: string) {
  const { data: application, error: applicationError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (applicationError || !application) {
    throw new Error(applicationError?.message || "Application not found");
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", application.job_id)
    .single();

  if (jobError || !job) {
    throw new Error(jobError?.message || "Job not found");
  }

  const role = getRole(job, application);
  const virtualNotes = asText(application.virtual_interview_notes);
  const nataNotes = buildNataNotes({ application, job, virtualNotes });
  const interviewQuestions = buildInterviewQuestions(role);
  const verificationItems = buildVerificationItems(role);
  const resumeUrl = asText(application.resume_url);

  const { data: packet, error: packetError } = await supabaseAdmin
    .schema("nata")
    .from("interview_packets")
    .upsert(
      {
        application_id: application.id,
        job_id: job.id,
        packet_status: "ready",
        nata_notes: nataNotes,
        resume_url: resumeUrl,
        interview_questions: interviewQuestions,
        verification_items: verificationItems,
        generated_by: "Solace",
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "application_id" }
    )
    .select("*")
    .single();

  if (packetError || !packet) {
    throw new Error(packetError?.message || "Interview packet could not be generated");
  }

  const { error: updateError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .update({
      interview_packet_ready: true,
      interview_packet_id: packet.id,
      interview_packet_notes: nataNotes,
      interview_questions: interviewQuestions,
      verification_items: verificationItems,
    })
    .eq("id", application.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { application, job, packet };
}
