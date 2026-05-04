import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendEmail } from "../../../../lib/email";
import { incrementCandidateContactByEmail } from "../../../../lib/nataCandidatePool";
import CommunicationsComposerClient from "./CommunicationsComposerClient";

type AnyRow = Record<string, any>;

type CommunicationsCenterProps = {
  recruiter: AnyRow;
  recruiterSlug: string;
  applications: AnyRow[];
};

type ContactOption = {
  id: string;
  type: string;
  name: string;
  organization: string;
  email: string;
  phone: string;
  applicationId: string;
  dealerSlug: string;
};

type TemplateOption = {
  id: string;
  name: string;
  channel: "email" | "sms";
  audience: string;
  subject: string;
  body: string;
};

type UploadedAttachment = {
  fileName: string;
  fileType: string;
  fileSize: number;
  storageBucket: string;
  storagePath: string;
  applicationId: string | null;
  threadId: string | null;
  messageDraftId: string | null;
};

function label(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAttachments(value: string): UploadedAttachment[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        fileName: label(item?.fileName, ""),
        fileType: label(item?.fileType, ""),
        fileSize: Number(item?.fileSize || 0),
        storageBucket: label(item?.storageBucket, ""),
        storagePath: label(item?.storagePath, ""),
        applicationId: item?.applicationId || null,
        threadId: item?.threadId || null,
        messageDraftId: item?.messageDraftId || null,
      }))
      .filter((item) => item.fileName && item.storageBucket && item.storagePath);
  } catch {
    return [];
  }
}

function formatMessageDate(value: unknown) {
  if (!value || typeof value !== "string") return "—";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "—";
  }
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

function getRecruiterAlias(recruiter: AnyRow, recruiterSlug: string) {
  return label(
    recruiter.email_alias || recruiter.recruiter_email_alias,
    `${recruiterSlug}@natatoday.ai`,
  ).toLowerCase();
}

function getRecruiterFromLine(recruiter: AnyRow, recruiterSlug: string) {
  const name = label(recruiter.name, "NATA Recruiter");
  const alias = getRecruiterAlias(recruiter, recruiterSlug);

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

function getMessagePreview(message: AnyRow) {
  return label(
    message.body_text ||
      message.body ||
      String(message.body_html || message.html || "").replace(/<[^>]+>/g, " "),
    "No message body",
  );
}

function getMessageAddress(message: AnyRow) {
  if (message.channel === "sms") {
    return message.direction === "inbound"
      ? label(message.from_phone, "Unknown sender")
      : label(message.to_phone, "Unknown recipient");
  }

  return message.direction === "inbound"
    ? label(message.from_email, "Unknown sender")
    : label(message.to_email, "Unknown recipient");
}

async function loadMessages(recruiterId: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("messages")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) {
    console.error("Failed to load recruiter messages:", error);
  }

  return (data || []) as AnyRow[];
}

function applicationToContact(application: AnyRow): ContactOption | null {
  const email = label(application.email || application.candidate_email, "");
  const phone = label(application.phone || application.candidate_phone, "");

  if (!email && !phone) return null;

  return {
    id: `application:${String(application.id)}`,
    type: "candidate",
    name: label(application.name || application.candidate_name || application.email, "Candidate"),
    organization: label(application.role || application.job_title, ""),
    email,
    phone,
    applicationId: String(application.id || ""),
    dealerSlug: label(application.dealer_slug, ""),
  };
}

async function loadAddressBook(recruiterId: string, applications: AnyRow[]) {
  const applicationContacts = applications
    .map(applicationToContact)
    .filter((contact): contact is ContactOption => Boolean(contact));

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("contacts")
    .select("*")
    .or(`recruiter_id.eq.${recruiterId},recruiter_id.is.null`)
    .eq("is_active", true)
    .order("display_name", { ascending: true })
    .limit(120);

  if (error) {
    console.error("Failed to load address book contacts:", error);
  }

  const storedContacts = ((data || []) as AnyRow[]).map((contact) => ({
    id: String(contact.id),
    type: label(contact.contact_type, "custom"),
    name: label(contact.display_name, "Contact"),
    organization: label(contact.organization, ""),
    email: label(contact.email, ""),
    phone: label(contact.phone, ""),
    applicationId: label(contact.application_id, ""),
    dealerSlug: label(contact.dealer_slug, ""),
  }));

  return [...applicationContacts, ...storedContacts];
}

async function loadTemplates() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("message_templates")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load message templates:", error);
  }

  return ((data || []) as AnyRow[]).map((template) => ({
    id: String(template.id),
    name: label(template.name, "Template"),
    channel: template.channel === "sms" ? "sms" : "email",
    audience: label(template.audience, "candidate"),
    subject: label(template.subject, ""),
    body: label(template.body, ""),
  })) as TemplateOption[];
}

async function logSms(input: {
  recruiterId: string;
  applicationId: string | null;
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
    console.error("Failed to log outbound SMS:", error);
  }
}

async function sendLoggedSms(input: {
  to: string;
  body: string;
  recruiterId: string;
  applicationId: string | null;
  dealerSlug: string | null;
}) {
  const normalizedTo = normalizePhone(input.to);
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
    console.error("Twilio SMS failed:", response.status, providerPayload);
  }
}

async function buildEmailAttachments(attachments: UploadedAttachment[]) {
  const emailAttachments: Array<{ filename: string; content: string }> = [];

  for (const attachment of attachments) {
    const { data, error } = await supabaseAdmin.storage
      .from(attachment.storageBucket)
      .download(attachment.storagePath);

    if (error || !data) {
      console.error("Failed to load outbound attachment for email:", {
        storageBucket: attachment.storageBucket,
        storagePath: attachment.storagePath,
        error,
      });
      continue;
    }

    const arrayBuffer = await data.arrayBuffer();
    const content = Buffer.from(arrayBuffer).toString("base64");

    emailAttachments.push({
      filename: attachment.fileName,
      content,
    });
  }

  return emailAttachments;
}

async function findLatestOutboundEmail(input: {
  recruiterId: string;
  applicationId: string | null;
  toEmail: string;
  subject: string;
}) {
  let query = supabaseAdmin
    .schema("nata")
    .from("messages")
    .select("id, thread_id")
    .eq("recruiter_id", input.recruiterId)
    .eq("direction", "outbound")
    .eq("channel", "email")
    .eq("to_email", input.toEmail)
    .eq("subject", input.subject)
    .order("created_at", { ascending: false })
    .limit(1);

  if (input.applicationId) {
    query = query.eq("application_id", input.applicationId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to resolve outbound message for attachments:", error);
    return null;
  }

  return data?.[0] || null;
}

async function linkOutboundAttachments(input: {
  attachments: UploadedAttachment[];
  messageId: string;
  threadId: string | null;
  recruiterId: string;
  applicationId: string | null;
}) {
  if (!input.attachments.length) return;

  const rows = input.attachments.map((attachment) => ({
    message_id: input.messageId,
    thread_id: input.threadId || attachment.threadId || null,
    recruiter_id: input.recruiterId,
    application_id: input.applicationId || attachment.applicationId || null,
    file_name: attachment.fileName,
    file_type: attachment.fileType || null,
    file_size: attachment.fileSize || null,
    storage_bucket: attachment.storageBucket,
    storage_path: attachment.storagePath,
    direction: "outbound",
    provider: "recruiter-upload",
    provider_attachment_id: null,
    provider_payload: {
      messageDraftId: attachment.messageDraftId || null,
      source: "communications-composer",
    },
  }));

  const { error } = await supabaseAdmin
    .schema("nata")
    .from("message_attachments")
    .insert(rows);

  if (error) {
    console.error("Failed to link outbound attachments:", error);
  }
}

async function findContactEmailForSms(input: {
  applicationId: string | null;
  recruiterId: string;
}) {
  if (!input.applicationId) return "";

  const { data: application, error: applicationError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("email,candidate_email")
    .eq("id", input.applicationId)
    .maybeSingle();

  if (applicationError) {
    console.error("Failed to load SMS contact email from application:", applicationError);
  }

  const applicationEmail = label(
    application?.email || application?.candidate_email,
    "",
  );

  if (applicationEmail) return applicationEmail;

  const { data: contact, error: contactError } = await supabaseAdmin
    .schema("nata")
    .from("contacts")
    .select("email")
    .eq("application_id", input.applicationId)
    .or(`recruiter_id.eq.${input.recruiterId},recruiter_id.is.null`)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (contactError) {
    console.error("Failed to load SMS contact email from address book:", contactError);
  }

  return label(contact?.email, "");
}

type ThreadSummary = {
  key: string;
  title: string;
  subtitle: string;
  channelLabel: string;
  lastAt: string;
  lastPreview: string;
  lastMessageId: string;
  lastDirection: string;
  inboundCount: number;
  outboundCount: number;
  totalCount: number;
  status: string;
  needsReply: boolean;
};

function getMessageTimeValue(message: AnyRow) {
  const raw = message.created_at || message.sent_at || message.received_at || "";
  const time = raw ? new Date(String(raw)).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getThreadKey(message: AnyRow) {
  return label(
    message.thread_id ||
      (message.application_id ? `application:${message.application_id}` : "") ||
      message.to_email ||
      message.from_email ||
      message.to_phone ||
      message.from_phone ||
      message.id,
    String(message.id || "message"),
  );
}

function getThreadTitle(message: AnyRow) {
  return label(
    message.contact_name ||
      message.candidate_name ||
      message.display_name ||
      message.subject ||
      getMessageAddress(message),
    message.channel === "sms" ? "SMS conversation" : "Email conversation",
  );
}

function getThreadSubtitle(message: AnyRow) {
  const organization = label(
    message.dealer_name || message.public_dealer_name || message.dealer_slug,
    "",
  );
  const address = getMessageAddress(message);
  return [organization, address].filter(Boolean).join(" · ") || "Conversation";
}

function isResolvedMessage(message: AnyRow) {
  const status = String(message.status || message.message_status || "")
    .trim()
    .toLowerCase();

  return ["resolved", "closed", "replied", "ignored", "archived"].includes(status);
}

function buildThreadSummaries(messages: AnyRow[]): ThreadSummary[] {
  const groups = new Map<string, AnyRow[]>();

  for (const message of messages) {
    const key = getThreadKey(message);
    const current = groups.get(key) || [];
    current.push(message);
    groups.set(key, current);
  }

  return Array.from(groups.entries())
    .map(([key, threadMessages]) => {
      const sorted = [...threadMessages].sort(
        (a, b) => getMessageTimeValue(b) - getMessageTimeValue(a),
      );
      const latest = sorted[0] || {};
      const inboundCount = sorted.filter((message) => message.direction === "inbound").length;
      const outboundCount = sorted.filter((message) => message.direction === "outbound").length;
      const latestDirection = label(latest.direction, "unknown").toLowerCase();
      const status = label(latest.message_status || latest.status, "open").toLowerCase();
      const needsReply = latestDirection === "inbound" && !isResolvedMessage(latest);

      return {
        key,
        title: getThreadTitle(latest),
        subtitle: getThreadSubtitle(latest),
        channelLabel: label(latest.channel, "email").toUpperCase(),
        lastAt: formatMessageDate(latest.created_at || latest.sent_at || latest.received_at),
        lastPreview: getMessagePreview(latest).slice(0, 180),
        lastMessageId: String(latest.id || ""),
        lastDirection: latestDirection,
        inboundCount,
        outboundCount,
        totalCount: sorted.length,
        status,
        needsReply,
      };
    })
    .sort((a, b) => {
      if (a.needsReply && !b.needsReply) return -1;
      if (!a.needsReply && b.needsReply) return 1;
      const latestA = messages.find((message) => String(message.id) === a.lastMessageId);
      const latestB = messages.find((message) => String(message.id) === b.lastMessageId);
      return getMessageTimeValue(latestB || {}) - getMessageTimeValue(latestA || {});
    });
}

export default async function CommunicationsCenter({
  recruiter,
  recruiterSlug,
  applications,
}: CommunicationsCenterProps) {
  const recruiterId = String(recruiter.id);
  const recruiterName = label(recruiter.name, "NATA Recruiter");
  const recruiterTitle = label(
    recruiter.title || recruiter.role,
    "Recruiting Operations",
  );
  const recruiterPhone = label(recruiter.phone, "");
  const alias = getRecruiterAlias(recruiter, recruiterSlug);
  const fromLine = `${recruiterName} @ NATA <${alias}>`;

  const [messages, contacts, templates] = await Promise.all([
    loadMessages(recruiterId),
    loadAddressBook(recruiterId, applications),
    loadTemplates(),
  ]);

  const threads = buildThreadSummaries(messages);
  const needsReply = threads.filter((thread) => thread.needsReply).slice(0, 4);
  const activeThreads = threads.filter((thread) => !thread.needsReply).slice(0, 3);
  const recentSent = messages
    .filter((message) => message.direction === "outbound")
    .slice(0, 2);

  async function sendRecruiterMessage(formData: FormData) {
    "use server";

    const channel = clean(formData.get("channel")) === "sms" ? "sms" : "email";
    const applicationId = clean(formData.get("application_id"));
    const dealerSlug = clean(formData.get("dealer_slug"));
    const toEmail = clean(formData.get("to_email"));
    const toPhone = clean(formData.get("to_phone"));
    const subject = clean(formData.get("subject"));
    const body = clean(formData.get("body"));
    const attachments = parseAttachments(clean(formData.get("attachments")));

    if (!body) {
      throw new Error("Message body is required.");
    }

    if (channel === "email") {
      if (!toEmail || !subject) {
        throw new Error("Email recipient and subject are required.");
      }

      const emailAttachments = attachments.length
        ? await buildEmailAttachments(attachments)
        : [];

      await sendEmail({
        to: toEmail,
        subject,
        text: body,
        html: plainToHtml(body),
        from: fromLine,
        replyTo: alias,
        recruiterId,
        applicationId: applicationId || null,
        signatureName: recruiterName,
        signatureTitle: recruiterTitle,
        signatureEmail: alias,
        signaturePhone: recruiterPhone,
        attachments: emailAttachments,
      } as any);

      await incrementCandidateContactByEmail(toEmail);

      if (attachments.length) {
        const loggedMessage = await findLatestOutboundEmail({
          recruiterId,
          applicationId: applicationId || null,
          toEmail,
          subject,
        });

        if (loggedMessage?.id) {
          await linkOutboundAttachments({
            attachments,
            messageId: String(loggedMessage.id),
            threadId: loggedMessage.thread_id ? String(loggedMessage.thread_id) : null,
            recruiterId,
            applicationId: applicationId || null,
          });
        } else {
          console.error("Outbound attachments uploaded but no outbound message record was found.");
        }
      }
    } else {
      if (!toPhone) {
        throw new Error("SMS recipient phone is required.");
      }

      await sendLoggedSms({
        to: toPhone,
        body,
        recruiterId,
        applicationId: applicationId || null,
        dealerSlug: dealerSlug || null,
      });

      const contactEmailForSms = await findContactEmailForSms({
        applicationId: applicationId || null,
        recruiterId,
      });

      if (contactEmailForSms) {
        await incrementCandidateContactByEmail(contactEmailForSms);
      }
    }

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  return (
    <section style={communicationsShell}>
      <div style={communicationsHeader}>
        <div>
          <div className="section-kicker" style={{ marginBottom: 10 }}>
            Communications Center
          </div>
          <h2 style={communicationsTitle}>Action inbox for {recruiterName}</h2>
          <p style={communicationsCopy}>
            Focused on replies, active conversations, and the latest outbound signal.
          </p>
        </div>

        <div style={identityCard}>
          <span>Assigned identity</span>
          <strong>{alias}</strong>
        </div>
      </div>

      <div style={communicationsGrid}>
        <div style={composerPane}>
          <CommunicationsComposerClient
            action={sendRecruiterMessage}
            alias={alias}
            recruiterId={recruiterId}
            recruiterName={recruiterName}
            contacts={contacts}
            templates={templates}
          />
        </div>

        <div style={messageColumn}>
          <ThreadPanel
            title="Needs reply"
            count={needsReply.length}
            empty="No inbound replies need action."
            threads={needsReply}
            recruiterId={recruiterId}
            recruiterSlug={recruiterSlug}
            tone="action"
          />

          <ThreadPanel
            title="Active conversations"
            count={activeThreads.length}
            empty="No active conversations to summarize yet."
            threads={activeThreads}
            recruiterId={recruiterId}
            recruiterSlug={recruiterSlug}
            tone="normal"
          />

          <RecentSentPanel messages={recentSent} totalSent={messages.filter((message) => message.direction === "outbound").length} />
        </div>
      </div>
    </section>
  );
}

function ThreadPanel({
  title,
  count,
  empty,
  threads,
  recruiterId,
  recruiterSlug,
  tone,
}: {
  title: string;
  count: number;
  empty: string;
  threads: ThreadSummary[];
  recruiterId: string;
  recruiterSlug: string;
  tone: "action" | "normal";
}) {
  return (
    <div style={tone === "action" ? actionMessagePanel : messagePanel}>
      <div style={messagePanelHeader}>
        <strong>{title}</strong>
        <span>{count}</span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {threads.length === 0 ? (
          <div style={emptyState}>{empty}</div>
        ) : (
          threads.map((thread) => (
            <article key={thread.key} style={threadRow}>
              <div style={messageMetaRow}>
                <strong>{thread.title}</strong>
                <span>{thread.lastAt}</span>
              </div>

              <p style={threadSubtitle}>{thread.subtitle}</p>
              <p style={messagePreview}>{thread.lastPreview}</p>

              <div style={threadFooter}>
                <span style={threadBadge}>{thread.channelLabel}</span>
                <span>{thread.totalCount} message{thread.totalCount === 1 ? "" : "s"}</span>
                <span>{thread.inboundCount} in / {thread.outboundCount} out</span>
                <span>{thread.status}</span>
              </div>

              {thread.needsReply && thread.lastMessageId ? (
                <div style={threadActions}>
                  <form method="POST" action="/api/nata/communications/resolve">
                    <input type="hidden" name="message_id" value={thread.lastMessageId} />
                    <input type="hidden" name="recruiter_id" value={recruiterId} />
                    <input type="hidden" name="recruiter_slug" value={recruiterSlug} />
                    <input type="hidden" name="status" value="resolved" />
                    <button type="submit" style={resolveButton}>Mark resolved</button>
                  </form>

                  <form method="POST" action="/api/nata/communications/resolve">
                    <input type="hidden" name="message_id" value={thread.lastMessageId} />
                    <input type="hidden" name="recruiter_id" value={recruiterId} />
                    <input type="hidden" name="recruiter_slug" value={recruiterSlug} />
                    <input type="hidden" name="status" value="ignored" />
                    <button type="submit" style={secondarySmallButton}>Ignore</button>
                  </form>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function RecentSentPanel({
  messages,
  totalSent,
}: {
  messages: AnyRow[];
  totalSent: number;
}) {
  return (
    <div style={compactHistoryPanel}>
      <div style={messagePanelHeader}>
        <strong>Recent outbound</strong>
        <span>{messages.length} of {totalSent}</span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {messages.length === 0 ? (
          <div style={emptyState}>No sent messages logged yet.</div>
        ) : (
          messages.map((message) => (
            <article key={String(message.id)} style={compactMessageRow}>
              <div style={messageMetaRow}>
                <strong>{label(message.subject, message.channel === "sms" ? "SMS" : "No subject")}</strong>
                <span>{formatMessageDate(message.created_at || message.sent_at || message.received_at)}</span>
              </div>
              <p style={messagePreview}>{getMessagePreview(message).slice(0, 140)}</p>
              <div style={messageFooter}>
                <span>To {getMessageAddress(message)}</span>
                <span>{label(message.channel, "email")} · {label(message.status, "logged")}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

const communicationsShell: CSSProperties = {
  marginTop: 42,
  padding: 18,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(145deg, rgba(20,115,255,0.12), rgba(255,255,255,0.045)), rgba(7,16,31,0.74)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
};

const communicationsHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const communicationsTitle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 24,
  lineHeight: 1,
  letterSpacing: "-0.04em",
};

const communicationsCopy: CSSProperties = {
  maxWidth: 720,
  margin: "8px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.45,
  fontSize: 13,
};

const identityCard: CSSProperties = {
  minWidth: 210,
  display: "grid",
  gap: 5,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(96,165,250,0.22)",
  background: "rgba(20,115,255,0.12)",
  color: "#dbeafe",
};

const communicationsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(300px, 380px) minmax(0, 1fr)",
  gap: 14,
  marginTop: 16,
  alignItems: "start",
};

const composerPane: CSSProperties = {
  maxHeight: 620,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
  borderRadius: 20,
};

const messageColumn: CSSProperties = {
  display: "grid",
  gap: 10,
  alignContent: "start",
  maxHeight: 620,
  overflowY: "auto",
  overflowX: "hidden",
  paddingRight: 4,
};

const messagePanel: CSSProperties = {
  padding: 12,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.28)",
};

const actionMessagePanel: CSSProperties = {
  ...messagePanel,
  border: "1px solid rgba(251,191,36,0.22)",
  background: "linear-gradient(145deg, rgba(251,191,36,0.09), rgba(3,10,20,0.28))",
};

const compactHistoryPanel: CSSProperties = {
  ...messagePanel,
  opacity: 0.92,
};

const messagePanelHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
  color: "#ffffff",
};

const threadRow: CSSProperties = {
  padding: 10,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.045)",
};

const compactMessageRow: CSSProperties = {
  padding: 10,
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.035)",
};

const messageMetaRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#ffffff",
};

const threadSubtitle: CSSProperties = {
  margin: "6px 0 0",
  color: "#8fa6ca",
  fontSize: 12,
};

const messagePreview: CSSProperties = {
  margin: "6px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.35,
  fontSize: 12,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const threadFooter: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
  color: "#8fa6ca",
  fontSize: 11,
};

const threadBadge: CSSProperties = {
  padding: "3px 7px",
  borderRadius: 999,
  background: "rgba(96,165,250,0.16)",
  border: "1px solid rgba(96,165,250,0.2)",
  color: "#bfdbfe",
  fontWeight: 900,
};

const threadActions: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 12,
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const resolveButton: CSSProperties = {
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg, #1473ff, #0757c9)",
  color: "#fff",
  fontWeight: 950,
  cursor: "pointer",
};

const secondarySmallButton: CSSProperties = {
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(147,197,253,0.22)",
  background: "rgba(147,197,253,0.1)",
  color: "#dbeafe",
  fontWeight: 950,
  cursor: "pointer",
};

const messageFooter: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  marginTop: 8,
  color: "#8fa6ca",
  fontSize: 11,
};

const emptyState: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px dashed rgba(148,163,184,0.25)",
  background: "rgba(148,163,184,0.06)",
  color: "#9fb4d6",
};
