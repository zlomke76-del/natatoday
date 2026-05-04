import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildCandidateScheduleUrl, sendInterviewInvite } from "@/lib/nataNotifications";
import { returnApplicationToCandidatePool } from "@/lib/nataCandidatePool";
import { sendEmail } from "@/lib/email";

type AnyRow = Record<string, any>;

type SchedulingMessageMode =
  | "reengage_1"
  | "reengage_2"
  | "final_notice"
  | "manual_reengage";

const WAITING_STATUSES = new Set([
  "virtual_invited",
  "invited",
  "reengage_1_sent",
  "reengage_2_sent",
  "final_notice_sent",
  "removal_review_required",
]);

const REMOVAL_REVIEW_STATUSES = new Set(["removal_review_required"]);

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

function clean(value: FormDataEntryValue | string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function label(value: unknown, fallback = "Candidate") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function redirectToDashboard(
  request: NextRequest,
  recruiterSlug: string,
  params?: Record<string, string>,
) {
  const slug = recruiterSlug || "don";
  const url = new URL(`/recruiter/${slug}/dashboard`, request.url);

  for (const [key, value] of Object.entries(params || {})) {
    if (value) url.searchParams.set(key, value);
  }

  if (params?.anchor) {
    url.hash = params.anchor;
    url.searchParams.delete("anchor");
  }

  return NextResponse.redirect(url, { status: 303 });
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

function hasRemovalReviewState(application: AnyRow) {
  return [
    application.status,
    application.screening_status,
    application.virtual_interview_status,
  ]
    .map(normalize)
    .some((status) => REMOVAL_REVIEW_STATUSES.has(status));
}

function isWaitingOnCandidate(application: AnyRow) {
  if (hasAnyTerminalState(application)) return false;
  if (application.virtual_interview_completed_at) return false;

  return [
    application.status,
    application.screening_status,
    application.virtual_interview_status,
  ]
    .map(normalize)
    .some((status) => WAITING_STATUSES.has(status));
}

async function loadApplication(applicationId: string, recruiterId: string) {
  const { data: application, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("recruiter_id", recruiterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!application) throw new Error("Application not found for this recruiter.");

  return application as AnyRow;
}

async function loadRecruiter(recruiterId: string) {
  const { data: recruiter, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,name,slug,email,phone,title,role,email_alias,recruiter_email_alias")
    .eq("id", recruiterId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!recruiter) throw new Error("Recruiter not found.");

  return recruiter as AnyRow;
}

async function loadJob(jobId: string | null | undefined) {
  if (!jobId) return null;

  const { data: job, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load job for recruiter action:", error);
    return null;
  }

  return (job || null) as AnyRow | null;
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
  mode: SchedulingMessageMode;
  candidateName: string;
  roleTitle: string;
  dealerName: string;
  recruiterName: string;
  bookingUrl: string;
}) {
  const firstName = input.candidateName.split(/\s+/).filter(Boolean)[0] || input.candidateName;

  if (input.mode === "reengage_2") {
    return {
      subject: "Quick follow-up on your NATA interview scheduling",
      emailText: `Hi ${firstName} — checking in again.\n\nWe still have not seen a virtual interview time booked for the ${input.roleTitle} opportunity with ${input.dealerName}.\n\nIf you are still interested, please choose a time here:\n${input.bookingUrl}\n\nIf your availability changed, reply to this message and we can help coordinate.\n\n— ${input.recruiterName}`,
      smsText: `Hi ${firstName}, this is NATA Today. We still have not seen an interview time booked. If you're still interested, please schedule here: ${input.bookingUrl}`,
    };
  }

  if (input.mode === "final_notice") {
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

async function logSms(input: {
  recruiterId: string;
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
    console.error("Failed to log scheduling SMS:", error);
  }
}

async function sendSchedulingSms(input: {
  recruiterId: string;
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
    console.error("Scheduling SMS failed:", response.status, providerPayload);
  }
}

async function sendSchedulingFollowup(input: {
  mode: SchedulingMessageMode;
  application: AnyRow;
  job: AnyRow | null;
  recruiter: AnyRow;
  recruiterId: string;
  bookingUrl: string;
}) {
  const alias = getRecruiterAlias(input.recruiter);
  const candidateName = label(input.application.name || input.application.email, "Candidate");
  const message = buildSchedulingMessage({
    mode: input.mode,
    candidateName,
    roleTitle: label(input.job?.title || input.application.role, "Candidate"),
    dealerName: label(input.job?.public_dealer_name || input.job?.dealer_slug, "Dealer"),
    recruiterName: label(input.recruiter.name, "your recruiter"),
    bookingUrl: input.bookingUrl,
  });

  if (input.application.email) {
    await sendEmail({
      to: String(input.application.email),
      subject: message.subject,
      text: message.emailText,
      html: plainToHtml(message.emailText),
      from: getRecruiterFromLine(input.recruiter),
      replyTo: alias,
      recruiterId: input.recruiterId,
      applicationId: String(input.application.id),
      signatureName: label(input.recruiter.name, "NATA Recruiting Team"),
      signatureTitle: label(input.recruiter.title || input.recruiter.role, "Recruiting Operations"),
      signatureEmail: alias,
      signaturePhone: label(input.recruiter.phone, ""),
    } as any);
  }

  await sendSchedulingSms({
    recruiterId: input.recruiterId,
    applicationId: String(input.application.id),
    dealerSlug: input.job?.dealer_slug || null,
    to: input.application.phone || null,
    body: message.smsText,
  });
}

async function sendInitialInviteSafely(input: {
  application: AnyRow;
  job: AnyRow | null;
  recruiter: AnyRow;
  bookingUrl: string;
}) {
  try {
    await sendInterviewInvite({
      applicationId: String(input.application.id),
      candidateName: label(input.application.name || input.application.email, "Candidate"),
      candidateEmail: input.application.email || null,
      candidatePhone: input.application.phone || null,
      roleTitle: label(input.job?.title || input.application.role, "Candidate"),
      dealerName: label(input.job?.public_dealer_name || input.job?.dealer_slug, "Dealer"),
      recruiterName: label(input.recruiter.name, "your recruiter"),
      bookingUrl: input.bookingUrl,
    });
  } catch (notificationError) {
    console.error("Recruiter action initial invite notification failed:", notificationError);
  }
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const action = clean(formData.get("action"));
  const applicationId = clean(formData.get("application_id"));
  const recruiterId = clean(formData.get("recruiter_id"));
  const recruiterSlug = clean(formData.get("recruiter_slug"));
  const reason = clean(formData.get("reason"));

  try {
    if (!action || !applicationId || !recruiterId) {
      return redirectToDashboard(request, recruiterSlug, { action: "missing" });
    }

    const [application, recruiter] = await Promise.all([
      loadApplication(applicationId, recruiterId),
      loadRecruiter(recruiterId),
    ]);

    if (
      hasAnyTerminalState(application) &&
      !["reengage_waiting", "approve_scheduling_removal"].includes(action)
    ) {
      return redirectToDashboard(request, recruiterSlug || String(recruiter.slug || "don"), {
        action: "terminal_blocked",
      });
    }

    const now = new Date().toISOString();
    const job = await loadJob(application.job_id);
    const safeRecruiterSlug = recruiterSlug || String(recruiter.slug || "don");
    const previousReason = label(application.decision_reason, "");

    if (action === "approve_interview") {
      const bookingUrl = buildCandidateScheduleUrl(applicationId);
      const note = reason || "Recruiter approved candidate for virtual interview after review.";

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "virtual_invited",
          screening_status: "virtual_invited",
          virtual_interview_status: "invited",
          virtual_interview_url: bookingUrl,
          decision_reason: note,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await sendInitialInviteSafely({ application, job, recruiter, bookingUrl });

      return redirectToDashboard(request, safeRecruiterSlug, { action: "invited" });
    }

    if (action === "reengage_waiting") {
      if (!isWaitingOnCandidate(application)) {
        return redirectToDashboard(request, safeRecruiterSlug, {
          action: "not_waiting",
          anchor: "candidate-scheduling-pending",
        });
      }

      const bookingUrl = buildCandidateScheduleUrl(applicationId);
      const note = `[Manual candidate re-engagement ${now}] ${reason || "Recruiter manually re-engaged candidate after schedule invite went stale."}`;

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "virtual_invited",
          screening_status: "virtual_invited",
          virtual_interview_status: "reengage_1_sent",
          virtual_interview_url: bookingUrl,
          decision_reason: previousReason ? `${previousReason}\n${note}` : note,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await sendSchedulingFollowup({
        mode: "manual_reengage",
        application,
        job,
        recruiter,
        recruiterId,
        bookingUrl,
      });

      return redirectToDashboard(request, safeRecruiterSlug, {
        action: "reengaged",
        anchor: "candidate-scheduling-pending",
      });
    }

    if (action === "keep_waiting") {
      if (!isWaitingOnCandidate(application)) {
        return redirectToDashboard(request, safeRecruiterSlug, {
          action: "not_waiting",
          anchor: "candidate-scheduling-pending",
        });
      }

      const note = `[Recruiter kept candidate active ${now}] ${reason || "Recruiter kept candidate active after removal review."}`;

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "virtual_invited",
          screening_status: "virtual_invited",
          virtual_interview_status: "invited",
          decision_reason: previousReason ? `${previousReason}\n${note}` : note,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      return redirectToDashboard(request, safeRecruiterSlug, {
        action: "kept_waiting",
        anchor: "candidate-scheduling-pending",
      });
    }

    if (action === "approve_scheduling_removal" || action === "remove_waiting") {
      if (!isWaitingOnCandidate(application)) {
        return redirectToDashboard(request, safeRecruiterSlug, {
          action: "not_waiting",
          anchor: "candidate-scheduling-pending",
        });
      }

      if (action === "approve_scheduling_removal" && !hasRemovalReviewState(application)) {
        return redirectToDashboard(request, safeRecruiterSlug, {
          action: "removal_not_ready",
          anchor: "candidate-scheduling-pending",
        });
      }

      const note = `[Scheduling removal approved ${now}] ${reason || "Recruiter approved removal after automated scheduling follow-ups."}`;

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "withdrawn",
          screening_status: "withdrawn",
          virtual_interview_status: "withdrawn",
          recruiter_id: null,
          assigned_recruiter: null,
          decision_reason: previousReason ? `${previousReason}\n${note}` : note,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await returnApplicationToCandidatePool({
        applicationId,
        source: "withdrawn",
        reason: reason || "Removed after automated scheduling follow-up sequence.",
      });

      await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({ recruiter_id: null, assigned_recruiter: null })
        .eq("id", applicationId);

      return redirectToDashboard(request, safeRecruiterSlug, {
        action: "removed",
        anchor: "candidate-scheduling-pending",
      });
    }

    if (action === "hold_candidate") {
      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "needs_review",
          screening_status: "needs_review",
          decision_reason:
            reason || "Recruiter hold: more candidate proof required before interview.",
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      return redirectToDashboard(request, safeRecruiterSlug, { action: "held" });
    }

    if (action === "pass_candidate") {
      const passReason = reason || "Recruiter passed candidate after role-specific review.";

      const { error } = await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({
          status: "not_fit",
          screening_status: "not_fit",
          decision_reason: passReason,
        })
        .eq("id", applicationId)
        .eq("recruiter_id", recruiterId);

      if (error) throw new Error(error.message);

      await returnApplicationToCandidatePool({
        applicationId,
        source: "recruiter_rejected",
        reason: passReason,
      });

      return redirectToDashboard(request, safeRecruiterSlug, { action: "passed" });
    }

    return redirectToDashboard(request, safeRecruiterSlug, { action: "unknown" });
  } catch (error) {
    console.error("POST /api/nata/recruiter-actions failed:", error);
    return redirectToDashboard(request, recruiterSlug || "don", { action: "error" });
  }
}
