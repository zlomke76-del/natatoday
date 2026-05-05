import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ResendWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: Record<string, any>;
};

type ReceivedEmail = {
  id?: string;
  to?: string[];
  from?: string;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string>;
  bcc?: string[];
  cc?: string[];
  reply_to?: string[];
  message_id?: string | null;
  attachments?: unknown[];
  created_at?: string;
  raw?: unknown;
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
  }) as ResendWebhookEvent;
}

function cleanText(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
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

function emailAddressOnly(value: unknown) {
  const raw = cleanText(value, 500);
  if (!raw) return "";

  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

function firstEmail(value: unknown) {
  if (Array.isArray(value)) {
    return emailAddressOnly(value[0]);
  }

  return emailAddressOnly(value);
}

async function fetchReceivedEmail(emailId: string) {
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

  const payload = await response.json().catch(async () => {
    return { raw: await response.text().catch(() => "") };
  });

  if (!response.ok) {
    throw new Error(
      `Resend received email lookup failed (${response.status}): ${JSON.stringify(
        payload,
      )}`,
    );
  }

  return payload as ReceivedEmail;
}

async function findThreadForInbound(input: {
  fromEmail: string;
  toEmail: string;
  subject: string;
}) {
  const alias = input.toEmail.toLowerCase();
  const fromEmail = input.fromEmail.toLowerCase();

  const { data: recruiter } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("id,email_alias,recruiter_email_alias")
    .or(`email_alias.eq.${alias},recruiter_email_alias.eq.${alias}`)
    .maybeSingle();

  const recruiterId =
    typeof recruiter?.id === "string" ? String(recruiter.id) : null;

  let existingThread: { id: string; application_id?: string | null; dealer_id?: string | null } | null =
    null;

  if (recruiterId && fromEmail) {
    const { data } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id,application_id,dealer_id")
      .eq("recruiter_id", recruiterId)
      .eq("candidate_email", fromEmail)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    existingThread = data as typeof existingThread;
  }

  if (!existingThread && fromEmail) {
    const { data } = await supabaseAdmin
      .schema("nata")
      .from("message_threads")
      .select("id,application_id,dealer_id")
      .eq("candidate_email", fromEmail)
      .order("last_message_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    existingThread = data as typeof existingThread;
  }

  if (existingThread?.id) {
    return {
      threadId: String(existingThread.id),
      recruiterId,
      applicationId: existingThread.application_id || null,
      dealerId: existingThread.dealer_id || null,
    };
  }

  const { data: created, error } = await supabaseAdmin
    .schema("nata")
    .from("message_threads")
    .insert({
      recruiter_id: recruiterId,
      candidate_email: fromEmail || null,
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
      applicationId: null,
      dealerId: null,
    };
  }

  return {
    threadId: String(created.id),
    recruiterId,
    applicationId: null,
    dealerId: null,
  };
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let event: ResendWebhookEvent;

  try {
    event = verifyWebhook(raw, req.headers);
  } catch (error) {
    console.error("Invalid Resend inbound webhook signature:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type || "unknown" });
  }

  const emailId = cleanText(event.data?.email_id, 120);

  if (!emailId) {
    return NextResponse.json(
      { error: "Missing received email id." },
      { status: 400 },
    );
  }

  try {
    const receivedEmail = await fetchReceivedEmail(emailId);

    const fromEmail = emailAddressOnly(receivedEmail.from || event.data?.from);
    const toEmail = firstEmail(receivedEmail.to || event.data?.to);
    const subject = cleanText(receivedEmail.subject || event.data?.subject, 500);
    const html = cleanText(receivedEmail.html || "", 100000);
    const text = cleanText(receivedEmail.text || "", 100000);
    const bodyText = text || stripHtml(html) || "Inbound email received.";
    const receivedAt =
      cleanText(receivedEmail.created_at || event.data?.created_at, 80) ||
      new Date().toISOString();

    const thread = await findThreadForInbound({
      fromEmail,
      toEmail,
      subject,
    });

    const providerPayload = {
      webhook: event.data || {},
      received_email: receivedEmail,
    };

    const { error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("messages")
      .insert({
        thread_id: thread.threadId,
        recruiter_id: thread.recruiterId,
        application_id: thread.applicationId,
        dealer_id: thread.dealerId,
        direction: "inbound",
        channel: "email",
        status: "received",
        subject,
        body: bodyText,
        body_text: bodyText,
        body_html: html || null,
        html: html || null,
        from_email: fromEmail || null,
        to_email: toEmail || null,
        provider: "resend",
        provider_message_id: emailId,
        provider_payload: JSON.parse(JSON.stringify(providerPayload)),
        received_at: receivedAt,
      });

    if (insertError) {
      throw new Error(`Failed to log inbound email: ${insertError.message}`);
    }

    if (thread.threadId) {
      await supabaseAdmin
        .schema("nata")
        .from("message_threads")
        .update({
          status: "open",
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", thread.threadId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend inbound handler failed:", error);
    const message =
      error instanceof Error ? error.message : "Inbound email handler failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
