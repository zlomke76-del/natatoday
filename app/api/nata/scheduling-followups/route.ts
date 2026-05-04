import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCandidateScheduleUrl } from "@/lib/nataNotifications";
import { sendEmail } from "@/lib/email";

type AnyRow = Record<string, any>;

type FollowupStep = {
  key: "reengage_1" | "reengage_2" | "final_notice" | "removal_review";
  status: "reengage_1_sent" | "reengage_2_sent" | "final_notice_sent" | "removal_review_required";
  minDays: number;
  marker: string;
};

const FOLLOWUP_STEPS: FollowupStep[] = [
  {
    key: "reengage_1",
    status: "reengage_1_sent",
    minDays: 2,
    marker: "[Scheduling follow-up 1 sent]",
  },
  {
    key: "reengage_2",
    status: "reengage_2_sent",
    minDays: 5,
    marker: "[Scheduling follow-up 2 sent]",
  },
  {
    key: "final_notice",
    status: "final_notice_sent",
    minDays: 8,
    marker: "[Final scheduling notice sent]",
  },
  {
    key: "removal_review",
    status: "removal_review_required",
    minDays: 10,
    marker: "[Scheduling removal review required]",
  },
];

const WAITING_STATUSES = [
  "virtual_invited",
  "invited",
  "reengage_1_sent",
  "reengage_2_sent",
  "final_notice_sent",
  "removal_review_required",
];

const TERMINAL_STATUSES = new Set([
  "placed",
  "hired",
  "dealer_hired",
  "placement_complete",
  "completed_placement",
  "archived",
  "closed",
  "not_hired",
  "not_selected",
  "dealer_rejected",
  "no_show",
  "withdrawn",
  "candidate_unresponsive",
  "invite_expired",
  "not_fit",
  "passed",
  "pass",
  "rejected",
]);

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function label(value: unknown, fallback = "Candidate") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function hasAnyTerminalState(application: AnyRow) {
  return [
    application.status,
    application.screening_status,
    application.virtual_interview_status,
  ]
    .map(normalize)
    .some((status) => TERMINAL_STATUSES.has(status));
}

function hasWaitingState(application: AnyRow) {
  const values = [
    application.status,
    application.screening_status,
    application.virtual_interview_status,
  ].map(normalize);

  return values.some((status) => WAITING_STATUSES.includes(status));
}

function getWaitingSince(application: AnyRow) {
  return String(
    application.virtual_invited_at ||
      application.invited_at ||
      application.created_at ||
      application.updated_at ||
      "",
  );
}

function getAgeInDays(value: unknown) {
  if (!value || typeof value !== "string") return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24)));
}

function getAlreadySentMarkers(application: AnyRow) {
  const notes = String(application.decision_reason || "");
  return new Set(
    FOLLOWUP_STEPS
      .filter((step) => notes.includes(step.marker))
      .map((step) => step.key),
  );
}

function getCurrentFollowupStep(application: AnyRow) {
  if (hasAnyTerminalState(application)) return null;
  if (application.virtual_interview_completed_at) return null;
  if (!hasWaitingState(application)) return null;

  const ageDays = getAgeInDays(getWaitingSince(application));
  if (ageDays === null) return null;

  const sentMarkers = getAlreadySentMarkers(application);

  for (const step of FOLLOWUP_STEPS) {
    if (ageDays >= step.minDays && !sentMarkers.has(step.key)) {
      return step;
    }
  }

  return null;
}

function getRecruiterAlias(recruiter: AnyRow) {
  return label(
    recruiter.email_alias || recruiter.recruiter_email_alias,
    `${label(recruiter.slug, "recruiter")}@natatoday.ai`,
  ).toLowerCase();
}

function getRecruiterFromLine(recruiter: AnyRow) {
  const name = label(recruiter.name, "NATA Recruiting Team");
  const alias = getRecruiterAlias(recruiter);
  return `${name} @ NATA <${alias}>`;
}

function plainToHtml(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

function normalizePhone(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.startsWith("+")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function buildSchedulingMessage(input: {
  step: FollowupStep;
  candidateName: string;
  roleTitle: string;
  dealerName: string;
  recruiterName: string;
  bookingUrl: string;
}) {
  const firstName = input.candidateName.split(/\s+/).filter(Boolean)[0] || input.candidateName;

  if (input.step.key === "reengage_2") {
    return {
      subject: "Quick follow-up on your NATA interview scheduling",
      emailText: `Hi ${firstName} — checking in again.\n\nWe still have not seen a virtual interview time booked for the ${input.roleTitle} opportunity with ${input.dealerName}.\n\nIf you are still interested, please choose a time here:\n${input.bookingUrl}\n\nIf your availability changed, reply to this message and we can help coordinate.\n\n— ${input.recruiterName}`,
      smsText: `Hi ${firstName}, this is NATA Today. We still have not seen an interview time booked. If you're still interested, please schedule here: ${input.bookingUrl}`,
    };
  }

  if (input.step.key === "final_notice") {
    return {
      subject: "Final follow-up: NATA interview scheduling",
      emailText: `Hi ${firstName} — this is our final scheduling follow-up for the ${input.roleTitle} opportunity with ${input.dealerName}.\n\nIf you are still interested, please book your virtual interview here:\n${input.bookingUrl}\n\nIf we do not see a time scheduled, we may pause this application for now. You can always reply if your availability changed.\n\n— ${input.recruiterName}`,
      smsText: `Hi ${firstName}, final NATA Today follow-up: please schedule your virtual interview here if you're still interested: ${input.bookingUrl}`,
    };
  }

  return {
    subject: "Still interested in scheduling your NATA interview?",
    emailText: `Hi ${firstName} — just checking in.\n\nWe previously sent your virtual interview scheduling link for the ${input.roleTitle} opportunity with ${input.dealerName}, but it looks like a time has not been booked yet.\n\nIf you are still interested, please choose a time here:\n${input.bookingUrl}\n\nIf your availability changed, no problem — reply here and we will help coordinate.\n\n— ${input.recruiterName}`,
    smsText: `Hi ${firstName}, this is NATA Today. Just checking in — we sent your interview scheduling link, but no time has been booked yet. If you're still interested, schedule here: ${input.bookingUrl}`,
  };
}

async function loadRecruiter(recruiterId: string | null | undefined) {
  if (!recruiterId) return null;

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,name,slug,email,phone,title,role,email_alias,recruiter_email_alias")
    .eq("id", recruiterId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recruiter for scheduling follow-up:", error);
    return null;
  }

  return (data || null) as AnyRow | null;
}

async function loadJob(jobId: string | null | undefined) {
  if (!jobId) return null;

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load job for scheduling follow-up:", error);
    return null;
  }

  return (data || null) as AnyRow | null;
}

async function logSms(input: {
  recruiterId: string | null;
  applicationId: string;
  dealerSlug: string | null;
  fromPhone: string | null;
  toPhone: string | null;
  body: string;
  status: "sent" | "failed" | "skipped";
  providerPayload?: unknown;
  providerMessageId?: string | null;
}) {
  const { error } = await supabaseAdmin.schema("nata").from("messages").insert({
    recruiter_id: input.recruiterId,
    application_id: input.applicationId,
    dealer_slug: input.dealerSlug,
    direction: "outbound",
    channel: "sms",
    status: input.status,
    body: input.body,
    body_text: input.body,
    from_phone: input.fromPhone,
    to_phone: input.toPhone,
    provider: "twilio",
    provider_message_id: input.providerMessageId || null,
    provider_payload: JSON.parse(JSON.stringify(input.providerPayload || {})),
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
  });

  if (error) {
    console.error("Failed to log scheduling follow-up SMS:", error);
  }
}

async function sendSms(input: {
  recruiterId: string | null;
  applicationId: string;
  dealerSlug: string | null;
  to: string | null;
  body: string;
}) {
  const normalizedTo = normalizePhone(input.to || "");
  const from = process.env.TWILIO_PHONE_NUMBER || "";

  if (!normalizedTo) {
    await logSms({
      recruiterId: input.recruiterId,
      applicationId: input.applicationId,
      dealerSlug: input.dealerSlug,
      fromPhone: from || null,
      toPhone: null,
      body: input.body,
      status: "skipped",
      providerPayload: { reason: "missing_or_invalid_phone", originalTo: input.to },
    });
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken || !from) {
    await logSms({
      recruiterId: input.recruiterId,
      applicationId: input.applicationId,
      dealerSlug: input.dealerSlug,
      fromPhone: from || null,
      toPhone: normalizedTo,
      body: input.body,
      status: "skipped",
      providerPayload: { reason: "missing_twilio_config" },
    });
    return;
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizedTo,
        From: from,
        Body: input.body,
      }),
    },
  );

  const rawPayload = await response.text().catch(() => "");
  let providerPayload: Record<string, any> = {};

  try {
    providerPayload = rawPayload ? JSON.parse(rawPayload) : {};
  } catch {
    providerPayload = { raw: rawPayload };
  }

  await logSms({
    recruiterId: input.recruiterId,
    applicationId: input.applicationId,
    dealerSlug: input.dealerSlug,
    fromPhone: from,
    toPhone: normalizedTo,
    body: input.body,
    status: response.ok ? "sent" : "failed",
    providerPayload,
    providerMessageId:
      typeof providerPayload.sid === "string" ? providerPayload.sid : null,
  });

  if (!response.ok) {
    console.error("Scheduling follow-up SMS failed:", response.status, providerPayload);
  }
}

async function sendFollowup(input: {
  application: AnyRow;
  job: AnyRow | null;
  recruiter: AnyRow | null;
  step: FollowupStep;
  bookingUrl: string;
}) {
  if (input.step.key === "removal_review") return;

  const recruiter = input.recruiter || {};
  const alias = getRecruiterAlias(recruiter);
  const recruiterName = label(recruiter.name, "NATA Recruiting Team");
  const message = buildSchedulingMessage({
    step: input.step,
    candidateName: label(input.application.name || input.application.email, "Candidate"),
    roleTitle: label(input.job?.title || input.application.role, "Candidate"),
    dealerName: label(input.job?.public_dealer_name || input.job?.dealer_slug, "Dealer"),
    recruiterName,
    bookingUrl: input.bookingUrl,
  });

  if (input.application.email) {
    await sendEmail({
      to: String(input.application.email),
      subject: message.subject,
      text: message.emailText,
      html: plainToHtml(message.emailText),
      from: getRecruiterFromLine(recruiter),
      replyTo: alias,
      recruiterId: input.application.recruiter_id || null,
      applicationId: String(input.application.id),
      signatureName: recruiterName,
      signatureTitle: label(recruiter.title || recruiter.role, "Recruiting Operations"),
      signatureEmail: alias,
      signaturePhone: label(recruiter.phone, ""),
    } as any);
  }

  await sendSms({
    recruiterId: input.application.recruiter_id || null,
    applicationId: String(input.application.id),
    dealerSlug: input.job?.dealer_slug || null,
    to: input.application.phone || null,
    body: message.smsText,
  });
}

function authorized(request: NextRequest) {
  const expected = process.env.NATA_ADMIN_KEY || process.env.CRON_SECRET || "";
  if (!expected) return true;

  const headerKey = request.headers.get("x-nata-admin-key") || "";
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  return headerKey === expected || bearer === expected;
}

async function runFollowups(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .in("virtual_interview_status", WAITING_STATUSES)
    .is("virtual_interview_completed_at", null)
    .limit(250);

  if (error) {
    console.error("Failed to load scheduling follow-up candidates:", error);
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
  }

  const applications = ((data || []) as AnyRow[]).filter((application) => {
    if (hasAnyTerminalState(application)) return false;
    if (!hasWaitingState(application)) return false;
    return Boolean(getCurrentFollowupStep(application));
  });

  const results: Array<{
    applicationId: string;
    candidate: string;
    step: string;
    status: string;
  }> = [];

  for (const application of applications) {
    const step = getCurrentFollowupStep(application);
    if (!step) continue;

    const now = new Date().toISOString();
    const bookingUrl = buildCandidateScheduleUrl(String(application.id));
    const job = await loadJob(application.job_id);
    const recruiter = await loadRecruiter(application.recruiter_id);
    const previousReason = label(application.decision_reason, "");
    const note = `${step.marker} ${now}`;

    const { error: updateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "virtual_invited",
        screening_status: "virtual_invited",
        virtual_interview_status: step.status,
        virtual_interview_url: bookingUrl,
        decision_reason: previousReason ? `${previousReason}\n${note}` : note,
      })
      .eq("id", application.id);

    if (updateError) {
      console.error("Failed to update scheduling follow-up state:", {
        applicationId: application.id,
        error: updateError,
      });
      continue;
    }

    await sendFollowup({ application, job, recruiter, step, bookingUrl });

    results.push({
      applicationId: String(application.id),
      candidate: label(application.name || application.email, "Candidate"),
      step: step.key,
      status: step.status,
    });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(request: NextRequest) {
  return runFollowups(request);
}

export async function POST(request: NextRequest) {
  return runFollowups(request);
}
