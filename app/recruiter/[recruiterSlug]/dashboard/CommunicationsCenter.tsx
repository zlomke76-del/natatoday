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
    .limit(30);

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

export default async function CommunicationsCenter({
  recruiter,
  recruiterSlug,
  applications,
}: CommunicationsCenterProps) {
  const recruiterId = String(recruiter.id);
  const alias = getRecruiterAlias(recruiter, recruiterSlug);
  const fromLine = getRecruiterFromLine(recruiter, recruiterSlug);

  const [messages, contacts, templates] = await Promise.all([
    loadMessages(recruiterId),
    loadAddressBook(recruiterId, applications),
    loadTemplates(),
  ]);

  const inbox = messages.filter((message) => message.direction === "inbound");
  const sent = messages.filter((message) => message.direction === "outbound");

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
        signatureName: label(recruiter.name, "NATA Recruiting Team"),
        signatureTitle: label(recruiter.title || recruiter.role, "Recruiting Operations"),
        signatureEmail: alias,
        signaturePhone: label(recruiter.phone, ""),
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

      const contactEmailForSms = contacts.find(
        (contact) => contact.applicationId && contact.applicationId === applicationId,
      )?.email;

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
          <h2 style={communicationsTitle}>
            Inbox + sent for {label(recruiter.name, "recruiter")}
          </h2>
          <p style={communicationsCopy}>
            Send professional email or SMS from the recruiter identity, use the
            address book for candidates, dealers, prospects, and custom contacts,
            and use Solace Rewrite Assist before sending.
          </p>
        </div>

        <div style={identityCard}>
          <span>Assigned identity</span>
          <strong>{alias}</strong>
        </div>
      </div>

      <div style={communicationsGrid}>
        <CommunicationsComposerClient
          action={sendRecruiterMessage}
          alias={alias}
          recruiterId={recruiterId}
          recruiterName={label(recruiter.name, "NATA Recruiter")}
          contacts={contacts}
          templates={templates}
        />

        <div style={messageColumn}>
          <MessageList title="Inbox" empty="No inbound replies yet." messages={inbox} />
          <MessageList title="Sent" empty="No sent messages logged yet." messages={sent} />
        </div>
      </div>
    </section>
  );
}

function MessageList({
  title,
  empty,
  messages,
}: {
  title: string;
  empty: string;
  messages: AnyRow[];
}) {
  return (
    <div style={messagePanel}>
      <div style={messagePanelHeader}>
        <strong>{title}</strong>
        <span>{messages.length}</span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {messages.length === 0 ? (
          <div style={emptyState}>{empty}</div>
        ) : (
          messages.slice(0, 8).map((message) => (
            <article key={String(message.id)} style={messageRow}>
              <div style={messageMetaRow}>
                <strong>{label(message.subject, message.channel === "sms" ? "SMS" : "No subject")}</strong>
                <span>{formatMessageDate(message.created_at || message.sent_at || message.received_at)}</span>
              </div>
              <p style={messagePreview}>{getMessagePreview(message).slice(0, 220)}</p>
              <div style={messageFooter}>
                <span>
                  {message.direction === "inbound" ? "From" : "To"}{" "}
                  {getMessageAddress(message)}
                </span>
                <span>
                  {label(message.channel, "email")} · {label(message.status, "logged")}
                </span>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

const communicationsShell: React.CSSProperties = {
  marginTop: 42,
  padding: 24,
  borderRadius: 28,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(145deg, rgba(20,115,255,0.12), rgba(255,255,255,0.045)), rgba(7,16,31,0.74)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
};

const communicationsHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const communicationsTitle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 30,
  lineHeight: 1,
  letterSpacing: "-0.04em",
};

const communicationsCopy: React.CSSProperties = {
  maxWidth: 860,
  margin: "12px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.55,
};

const identityCard: React.CSSProperties = {
  minWidth: 230,
  display: "grid",
  gap: 6,
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(96,165,250,0.22)",
  background: "rgba(20,115,255,0.12)",
  color: "#dbeafe",
};

const communicationsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 0.94fr) minmax(0, 1.06fr)",
  gap: 18,
  marginTop: 22,
};

const messageColumn: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const messagePanel: React.CSSProperties = {
  padding: 16,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.28)",
};

const messagePanelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
  color: "#ffffff",
};

const messageRow: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.045)",
};

const messageMetaRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#ffffff",
};

const messagePreview: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.45,
  fontSize: 13,
};

const messageFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 10,
  color: "#8fa6ca",
  fontSize: 12,
};

const emptyState: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px dashed rgba(148,163,184,0.25)",
  background: "rgba(148,163,184,0.06)",
  color: "#9fb4d6",
};
