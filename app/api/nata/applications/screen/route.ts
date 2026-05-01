import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

type ScreenDecision = "not_fit" | "virtual_invited" | "needs_review";
type RoleBand = { interviewReady: number; review: number };

const ROLE_THRESHOLDS: Record<string, RoleBand> = {
  "sales consultant": { interviewReady: 80, review: 60 },
  "service advisor": { interviewReady: 82, review: 65 },
  "service technician": { interviewReady: 78, review: 60 },
  "bdc representative": { interviewReady: 76, review: 58 },
  "parts advisor": { interviewReady: 75, review: 58 },
  "finance manager": { interviewReady: 85, review: 70 },
};

function getRoleTitle(job: any) {
  return String(job?.title || "General dealership role");
}

function getRoleKey(roleTitle: string) {
  const normalized = roleTitle.toLowerCase();
  if (normalized.includes("sales")) return "sales consultant";
  if (normalized.includes("service") && normalized.includes("advisor")) return "service advisor";
  if (normalized.includes("technician") || normalized.includes("tech")) return "service technician";
  if (normalized.includes("bdc")) return "bdc representative";
  if (normalized.includes("parts")) return "parts advisor";
  if (normalized.includes("finance") || normalized.includes("f&i")) return "finance manager";
  return "sales consultant";
}

function getThreshold(roleTitle: string) {
  const roleKey = getRoleKey(roleTitle);
  return { roleKey, ...ROLE_THRESHOLDS[roleKey] };
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function scoreApplication(input: {
  job: any;
  candidateName: string;
  coverNote: string;
  linkedin: string;
  resumeUrl: string;
}) {
  const roleTitle = getRoleTitle(input.job);
  const thresholds = getThreshold(roleTitle);
  const jobText = [
    input.job?.title,
    input.job?.description,
    input.job?.requirements,
    input.job?.role_hook,
    ...(input.job?.responsibilities || []),
    ...(input.job?.fit_signals || []),
    input.job?.process_note,
  ].filter(Boolean).join(" ").toLowerCase();

  const candidateText = [
    input.candidateName,
    input.coverNote,
    input.linkedin,
    input.resumeUrl,
  ].filter(Boolean).join(" ").toLowerCase();

  let score = 45;
  const strengths: string[] = [];
  const gaps: string[] = [];
  const verificationItems: string[] = [];
  const candidateCoaching: string[] = [];

  const keywords = Array.from(new Set(jobText.split(/\s+/).map((word) => word.replace(/[^a-z0-9]/g, "")).filter((word) => word.length > 5))).slice(0, 60);
  const matches = keywords.filter((word) => candidateText.includes(word)).length;

  if (matches >= 10) {
    score += 20;
    strengths.push("Strong overlap with role-specific requirements.");
  } else if (matches >= 5) {
    score += 12;
    strengths.push("Some overlap with role-specific requirements.");
    verificationItems.push("Verify direct experience with this role’s required responsibilities.");
  } else {
    score -= 8;
    gaps.push("Limited visible overlap with role-specific requirements.");
    candidateCoaching.push("Add examples that directly match the job responsibilities and dealership role requirements.");
  }

  const roleKey = thresholds.roleKey;

  if (roleKey === "sales consultant") {
    if (includesAny(candidateText, ["automotive", "dealership", "vehicle", "car sales", "auto sales"])) {
      score += 14;
      strengths.push("Automotive or dealership sales experience indicated.");
    } else {
      score -= 8;
      gaps.push("No clear automotive or dealership sales proof.");
      verificationItems.push("Confirm comfort selling vehicles, handling objections, and working a commission-driven sales floor.");
      candidateCoaching.push("Add sales metrics, closing examples, commission experience, units sold, or high-ticket sales proof.");
    }

    if (includesAny(candidateText, ["crm", "follow-up", "follow up", "appointment", "pipeline"])) {
      score += 10;
      strengths.push("Follow-up, CRM, or appointment-setting signal present.");
    } else {
      verificationItems.push("Verify follow-up discipline, CRM usage, and ability to manage multiple active customers.");
    }

    if (includesAny(candidateText, ["top performer", "ranked", "quota", "revenue", "closed", "closing", "converted"])) {
      score += 10;
      strengths.push("Performance or closing signal present.");
    } else {
      gaps.push("Limited measurable closing or revenue proof.");
      candidateCoaching.push("Add measurable sales outcomes: close rate, rank, revenue, quota, or customer conversion results.");
    }
  }

  if (roleKey === "service technician") {
    if (includesAny(candidateText, ["ase", "diagnostic", "repair", "technician", "tools", "certified"])) {
      score += 18;
      strengths.push("Technical, diagnostic, certification, or tool signal present.");
    } else {
      score -= 10;
      gaps.push("No clear technician certification, diagnostic, tool, or repair proof.");
      verificationItems.push("Confirm certifications, tool availability, diagnostic ability, and shop experience.");
    }
  }

  if (roleKey === "service advisor") {
    if (includesAny(candidateText, ["service", "advisor", "repair order", "customer", "estimate", "lane"])) {
      score += 16;
      strengths.push("Service-lane or customer advisory signal present.");
    } else {
      score -= 6;
      gaps.push("Limited service advisor or repair-order experience proof.");
      verificationItems.push("Verify ability to manage repair orders, customer expectations, and service-lane pressure.");
    }
  }

  if (roleKey === "bdc representative") {
    if (includesAny(candidateText, ["phone", "call", "text", "appointment", "lead", "crm", "follow-up", "follow up"])) {
      score += 18;
      strengths.push("BDC-relevant phone, lead, follow-up, or appointment signal present.");
    } else {
      score -= 8;
      gaps.push("Limited visible BDC lead handling or appointment-setting proof.");
      verificationItems.push("Verify call volume comfort, appointment setting, CRM notes, and text/email follow-up discipline.");
    }
  }

  if (roleKey === "parts advisor") {
    if (includesAny(candidateText, ["parts", "inventory", "counter", "advisor", "oem", "catalog"])) {
      score += 16;
      strengths.push("Parts, inventory, counter, or catalog signal present.");
    } else {
      score -= 6;
      gaps.push("Limited visible parts counter or inventory proof.");
      verificationItems.push("Verify parts lookup, inventory discipline, customer handling, and counter experience.");
    }
  }

  if (roleKey === "finance manager") {
    if (includesAny(candidateText, ["finance", "f&i", "warranty", "lender", "compliance", "menu", "deal jacket"])) {
      score += 20;
      strengths.push("Finance, F&I, lender, warranty, or compliance signal present.");
    } else {
      score -= 14;
      gaps.push("No clear F&I, lender, warranty, or compliance proof.");
      verificationItems.push("Verify F&I experience, compliance discipline, product presentation, and lender familiarity.");
    }
  }

  if (includesAny(candidateText, ["customer", "service", "rapport", "communication", "relationship"])) {
    score += 8;
    strengths.push("Customer-facing communication signal present.");
  }

  if (includesAny(candidateText, ["available", "weekend", "full-time", "flexible"])) {
    score += 6;
    strengths.push("Availability signal present.");
  } else {
    verificationItems.push("Confirm schedule, weekend availability, start date, and compensation alignment.");
  }

  if (!input.resumeUrl) {
    score -= 15;
    gaps.push("Resume was not provided.");
    candidateCoaching.push("Upload a resume with role-specific results, dates, employers, and measurable outcomes.");
  }

  if (!input.coverNote && !input.linkedin && !input.resumeUrl) {
    score -= 20;
    gaps.push("Limited supporting information provided.");
    candidateCoaching.push("Provide a resume, LinkedIn profile, or short note explaining why this dealership role fits.");
  }

  const fitScore = Math.max(0, Math.min(100, score));
  let decision: ScreenDecision = "needs_review";
  if (fitScore >= thresholds.interviewReady) decision = "virtual_invited";
  if (fitScore < thresholds.review) decision = "not_fit";

  const thresholdLine = `${roleTitle}: interview ready ${thresholds.interviewReady}+; recruiter review ${thresholds.review}-${thresholds.interviewReady - 1}; do not advance below ${thresholds.review}.`;

  return {
    fitScore,
    decision,
    roleTitle,
    roleKey,
    thresholds,
    strengths,
    gaps,
    verificationItems: Array.from(new Set(verificationItems)).slice(0, 6),
    candidateCoaching: Array.from(new Set(candidateCoaching)).slice(0, 6),
    screeningSummary:
      decision === "virtual_invited"
        ? `Candidate meets the ${roleTitle} interview-ready threshold. ${thresholdLine}`
        : decision === "not_fit"
          ? `Candidate does not currently meet the ${roleTitle} advancement threshold. ${thresholdLine}`
          : `Candidate shows partial alignment and requires recruiter review before interview. ${thresholdLine}`,
    decisionReason:
      decision === "virtual_invited"
        ? "Role-specific threshold met. Candidate may advance to virtual interview."
        : decision === "not_fit"
          ? "Role-specific threshold not met. Do not advance automatically."
          : "Candidate sits in the recruiter review band. Verify missing proof before interview.",
  };
}

function buildVirtualInterviewLink(applicationId: string) {
  const base = process.env.NATA_VIRTUAL_INTERVIEW_URL || process.env.NEXT_PUBLIC_APP_URL || "https://natatoday.vercel.app";
  if (base.includes("?")) return `${base}&application=${applicationId}`;
  return `${base}?application=${applicationId}`;
}

async function sendCandidateEmail(input: { to: string; subject: string; body: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NATA_FROM_EMAIL || "Solace Recruiting <no-reply@natatoday.com>";

  if (!apiKey) {
    console.log("RESEND_API_KEY not set. Candidate email skipped:", input.subject);
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: input.to, subject: input.subject, text: input.body }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Candidate email failed:", detail);
    return { skipped: false, error: detail };
  }

  return { skipped: false };
}

function buildEmail(input: {
  candidateName: string;
  candidateEmail: string;
  job: any;
  decision: ScreenDecision;
  virtualInterviewUrl: string | null;
  candidateCoaching: string[];
}) {
  const firstName = input.candidateName.split(" ")[0] || "there";
  const title = input.job?.title || "the role";
  const dealer = input.job?.publish_mode === "confidential" ? "a confidential dealership" : input.job?.public_dealer_name || "the dealership";

  if (input.decision === "virtual_invited") {
    return {
      to: input.candidateEmail,
      subject: `Next step for ${title}`,
      body: `Hi ${firstName},\n\nThanks for applying for the ${title} role with ${dealer}.\n\nYour application meets the role-specific threshold for a virtual screening interview.\n\nStart here:\n${input.virtualInterviewUrl}\n\nThank you,\nSolace Recruiting`,
    };
  }

  if (input.decision === "not_fit") {
    const coaching = input.candidateCoaching.length ? `\n\nTo strengthen future applications, consider:\n- ${input.candidateCoaching.join("\n- ")}` : "";
    return {
      to: input.candidateEmail,
      subject: `Update on your ${title} application`,
      body: `Hi ${firstName},\n\nThank you for applying for the ${title} role. Based on the information provided, this role does not appear to meet the advancement threshold at this time.${coaching}\n\nWe appreciate your interest and may keep your information in mind for future opportunities that better match your background.\n\nThank you,\nSolace Recruiting`,
    };
  }

  return {
    to: input.candidateEmail,
    subject: `Application received for ${title}`,
    body: `Hi ${firstName},\n\nThanks for applying for the ${title} role. Your application has been received and routed to recruiter review.\n\nIf more proof is needed, we may ask you to clarify experience, availability, or role-specific fit.\n\nThank you,\nSolace Recruiting`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const adminKey = request.headers.get("x-nata-admin-key");
    if (!adminKey || adminKey !== process.env.NATA_ADMIN_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const applicationId = String(body.application_id || "").trim();
    if (!applicationId) {
      return NextResponse.json({ error: "application_id is required" }, { status: 400 });
    }

    const { data: application, error: appError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select(`
        id,
        job_id,
        name,
        email,
        phone,
        linkedin,
        resume_url,
        cover_note,
        status,
        jobs (
          id,
          title,
          slug,
          dealer_slug,
          location,
          type,
          salary,
          description,
          requirements,
          role_hook,
          responsibilities,
          fit_signals,
          process_note,
          publish_mode,
          public_dealer_name,
          public_location,
          confidential_note
        )
      `)
      .eq("id", applicationId)
      .single();

    if (appError || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const job = Array.isArray(application.jobs) ? application.jobs[0] : application.jobs;
    const result = scoreApplication({
      job,
      candidateName: application.name || "",
      coverNote: application.cover_note || "",
      linkedin: application.linkedin || "",
      resumeUrl: application.resume_url || "",
    });

    const nextStatus = result.decision === "virtual_invited" ? "virtual_invited" : result.decision === "not_fit" ? "not_fit" : "needs_review";
    const virtualInterviewUrl = result.decision === "virtual_invited" ? buildVirtualInterviewLink(applicationId) : null;
    const summaryLines = [
      result.screeningSummary,
      result.strengths.length ? `Strengths: ${result.strengths.join(" ")}` : "",
      result.gaps.length ? `Gaps: ${result.gaps.join(" ")}` : "",
    ].filter(Boolean);

    const { data: updated, error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: nextStatus,
        screening_status: nextStatus,
        fit_score: result.fitScore,
        screening_summary: summaryLines.join("\n"),
        decision_reason: result.decisionReason,
        virtual_interview_url: virtualInterviewUrl,
        interview_questions: result.verificationItems,
        verification_items: result.candidateCoaching,
      })
      .eq("id", applicationId)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (application.email) {
      await sendCandidateEmail(buildEmail({
        candidateName: application.name || "",
        candidateEmail: application.email,
        job,
        decision: result.decision,
        virtualInterviewUrl,
        candidateCoaching: result.candidateCoaching,
      }));
    }

    return NextResponse.json({
      ok: true,
      application: updated,
      decision: result.decision,
      fit_score: result.fitScore,
      role: result.roleTitle,
      role_key: result.roleKey,
      threshold: result.thresholds,
      screening_summary: result.screeningSummary,
      decision_reason: result.decisionReason,
      strengths: result.strengths,
      gaps: result.gaps,
      verification_items: result.verificationItems,
      candidate_coaching: result.candidateCoaching,
      next_action: result.decision === "virtual_invited" ? "Candidate virtual interview invite sent or queued." : result.decision === "not_fit" ? "Candidate held from interview. Candidate coaching sent or queued." : "Candidate routed for recruiter review before interview.",
    });
  } catch (error) {
    console.error("Application screening error:", error);
    return NextResponse.json({ error: "Application screening failed." }, { status: 500 });
  }
}
