import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type AnyRecord = Record<string, any>;

type ResendReceivedEmail = {
  id?: string;
  from?: string | { email?: string; name?: string };
  to?: Array<string | { email?: string; name?: string }>;
  cc?: Array<string | { email?: string; name?: string }>;
  bcc?: Array<string | { email?: string; name?: string }>;
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  created_at?: string | null;
  headers?: AnyRecord | null;
  attachments?: unknown[] | null;
};

type ThreadResolution = {
  threadId: string | null;
  recruiterId: string | null;
  applicationId: string | null;
  dealerSlug: string | null;
};

function verifyWebhook(body: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("Missing RESEND_WEBHOOK_SECRET");
  }

  const webhook = new Webhook(secret);

  return webhook.verify(body, {
    "svix-id": headers.get("svix-id") || "",
    "svix-timestamp": headers.get("svix-timestamp") || "",
    "svix-signature": headers.get("svix-signature") || "",
  }) as AnyRecord;
}

function normalizeEmail(value: unknown) {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim().toLowerCase();
  }

  if (typeof value === "object" && value !== null) {
    const record = value as AnyRecord;
    return String(record.email || "").trim().toLowerCase();
  }

  return "";
}

function firstEmail(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeEmail(value[0]);
  }

  return normalizeEmail(value);
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeSubject(value: unknown) {
  return String(value || "")
    .replace(/^\s*(re|fw|fwd):\s*/i, "")
    .trim()
    .toLowerCase();
}

function aliasSlugFromEmail(email: string) {
  const localPart = email.split("@")[0] || "";
  return localPart.trim().toLowerCase();
}

async function fetchReceivedEmail(emailId: string): Promise<ResendReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => ({}))) as AnyRecord;

  if (!response.ok) {
    throw new Error(
      typeof payload?.message === "string"
        ? payload.message
        : `Could not retrieve inbound email ${emailId}`,
    );
  }

  return payload as ResendReceivedEmail;
}

async function findRecruiterByAlias(toEmail: string) {
  const aliasSlug = aliasSlugFromEmail(toEmail);
  if (!aliasSlug) return null;

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,slug,email_alias,recruiter_email_alias")
    .or(
      `slug.eq.${aliasSlug},email_alias.eq.${toEmail},recruiter_email_alias.eq.${toEmail}`,
    )
    .limit(1);

  if (error) {
    console.error("Failed to resolve recruiter alias:", error);
    return null;
  }

  const rows = (data || []) as AnyRecord[];
  return rows[0] || null;
}

async function findApplicationByEmail(candidateEmail: string) {
  if (!candidateEmail) return null;

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id,recruiter_id,dealer_slug,email,candidate_email")
    .or(`email.eq.${candidateEmail},candidate_email.eq.${candidateEmail}`)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Failed to resolve application from inbound email:", error);
    return null;
  }

  const rows = (data || []) as AnyRecord[];
  return rows[0] || null;
}

async function resolveThread(input: {
  fromEmail: string;
  toEmail: string;
  subject: string;
}): Promise<ThreadResolution> {
  const recruiter = await findRecruiterByAlias(input.toEmail);
  const application = await findApplicationByEmail(input.fromEmail);

  const recruiterId =
    String(recruiter?.id || application?.recruiter_id || "") || null;
  const applicationId = String(application?.id || "") || null;
  const dealerSlug = String(application?.dealer_slug || "") || null;

  let existingThread: AnyRecord | null = null;

  if (applicationId) {
    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("application_id", applicationId)
      .maybeSingle();

    if (error) {
      console.error("Failed to find message thread by application:", error);
    } else {
      existingThread = (data as AnyRecord | null) || null;
    }
  }

  if (!existingThread && recruiterId && input.fromEmail) {
    const { data, error } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id")
      .eq("recruiter_id", recruiterId)
      .eq("candidate_email", input.fromEmail)
      .maybeSingle();

    if (error) {
      console.error("Failed to find message thread by recruiter/email:", error);
    } else {
      existingThread = (data as AnyRecord | null) || null;
    }
  }

  if (existingThread?.id) {
    return {
      threadId: String(existingThread.id),
      recruiterId,
      applicationId,
      dealerSlug,
    };
  }

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("message_threads")
    .insert({
      recruiter_id: recruiterId,
      application_id: applicationId,
      candidate_email: input.fromEmail || null,
      dealer_id: null,
      subject: input.subject || null,
      status: "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create inbound message thread:", error);
    return {
      threadId: null,
      recruiterId,
      applicationId,
      dealerSlug,
    };
  }

  const createdThread = (data as AnyRecord | null) || null;

  return {
    threadId: createdThread?.id ? String(createdThread.id) : null,
    recruiterId,
    applicationId,
    dealerSlug,
  };
}

async function updateThread(threadId: string | null) {
  if (!threadId) return;

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("message_threads")
    .update({
      status: "open",
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId);

  if (error) {
    console.error("Failed to update inbound thread timestamp:", error);
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let event: AnyRecord;

  try {
    event = verifyWebhook(raw, req.headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true });
  }

  const emailId = String(event?.data?.email_id || event?.data?.id || "");

  if (!emailId) {
    return NextResponse.json(
      { error: "Missing received email id." },
      { status: 400 },
    );
  }

  try {
    const full = await fetchReceivedEmail(emailId);

    const fromEmail = normalizeEmail(full.from);
    const toEmail = firstEmail(full.to);
    const subject = String(full.subject || "").trim();
    const bodyHtml = String(full.html || "");
    const bodyText = String(full.text || "").trim() || stripHtml(bodyHtml);
    const receivedAt = full.created_at || new Date().toISOString();

    const thread = await resolveThread({
      fromEmail,
      toEmail,
      subject: normalizeSubject(subject),
    });

    const providerPayload = {
      event: event.data || {},
      received: full,
    };

    const { error } = await supabaseAdmin.schema("nata").from("messages").insert({
      thread_id: thread.threadId,
      recruiter_id: thread.recruiterId,
      application_id: thread.applicationId,
      dealer_slug: thread.dealerSlug,
      direction: "inbound",
      channel: "email",
      status: "received",
      subject,
      body: bodyText,
      body_text: bodyText,
      body_html: bodyHtml || null,
      html: bodyHtml || null,
      from_email: fromEmail || null,
      to_email: toEmail || null,
      provider: "resend",
      provider_message_id: emailId,
      provider_payload: JSON.parse(JSON.stringify(providerPayload)),
      received_at: receivedAt,
    });

    if (error) {
      throw new Error(`Inbound message insert failed: ${error.message}`);
    }

    await updateThread(thread.threadId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Inbound Resend webhook failed:", error);
    const message = error instanceof Error ? error.message : "Inbound webhook failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
