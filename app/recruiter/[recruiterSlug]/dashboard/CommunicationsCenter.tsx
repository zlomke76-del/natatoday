import { redirect } from "next/navigation";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendEmail } from "../../../../lib/email";
import { incrementCandidateContactByEmail } from "../../../../lib/nataCandidatePool";

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

type ThreadSummary = {
  key: string;
  title: string;
  address: string;
  channel: string;
  lastAt: string;
  preview: string;
  inboundCount: number;
  outboundCount: number;
  total: number;
  needsReply: boolean;
  messages: AnyRow[];
};

function label(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
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

function getMessageTimestamp(message: AnyRow) {
  return label(message.created_at || message.sent_at || message.received_at, "");
}

function getThreadKey(message: AnyRow) {
  if (message.thread_id) return `thread:${String(message.thread_id)}`;

  const channel = label(message.channel, "email").toLowerCase();
  const address = getMessageAddress(message).toLowerCase();
  const applicationId = label(message.application_id, "");
  const subject = label(message.subject, channel === "sms" ? "sms" : "no-subject").toLowerCase();

  return `${channel}:${applicationId}:${address}:${subject}`;
}

function buildThreads(messages: AnyRow[]) {
  const threadMap = new Map<string, AnyRow[]>();

  for (const message of messages) {
    const key = getThreadKey(message);
    const existing = threadMap.get(key) || [];
    existing.push(message);
    threadMap.set(key, existing);
  }

  return Array.from(threadMap.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort((a, b) => {
        const aTime = new Date(getMessageTimestamp(a)).getTime() || 0;
        const bTime = new Date(getMessageTimestamp(b)).getTime() || 0;
        return bTime - aTime;
      });
      const latest = sorted[0] || {};
      const inboundCount = sorted.filter((message) => message.direction === "inbound").length;
      const outboundCount = sorted.filter((message) => message.direction === "outbound").length;
      const latestDirection = label(latest.direction, "outbound");
      const needsReply = latestDirection === "inbound" && label(latest.status, "logged") !== "resolved";

      return {
        key,
        title: label(latest.subject, latest.channel === "sms" ? getMessageAddress(latest) : "No subject"),
        address: getMessageAddress(latest),
        channel: label(latest.channel, "email").toUpperCase(),
        lastAt: getMessageTimestamp(latest),
        preview: getMessagePreview(latest),
        inboundCount,
        outboundCount,
        total: sorted.length,
        needsReply,
        messages: sorted,
      } as ThreadSummary;
    })
    .sort((a, b) => (new Date(b.lastAt).getTime() || 0) - (new Date(a.lastAt).getTime() || 0));
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
    .limit(80);

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

  const threads = buildThreads(messages);
  const needsReply = threads.filter((thread) => thread.needsReply).slice(0, 4);
  const activeThreads = threads.slice(0, 8);
  const recentOutbound = messages.filter((message) => message.direction === "outbound").slice(0, 6);

  async function sendRecruiterMessage(formData: FormData) {
    "use server";

    const channel = clean(formData.get("channel")) === "sms" ? "sms" : "email";
    const applicationId = clean(formData.get("application_id"));
    const dealerSlug = clean(formData.get("dealer_slug"));
    const toEmail = clean(formData.get("to_email"));
    const toPhone = clean(formData.get("to_phone"));
    const subject = clean(formData.get("subject"));
    const body = clean(formData.get("body"));

    if (!body) {
      throw new Error("Message body is required.");
    }

    if (channel === "email") {
      if (!toEmail || !subject) {
        throw new Error("Email recipient and subject are required.");
      }

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
      } as any);

      await incrementCandidateContactByEmail(toEmail);
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
    }

    redirect(`/recruiter/${recruiterSlug}/dashboard#communications`);
  }

  return (
    <section id="communications" style={communicationsShell}>
      <div style={communicationsHeader}>
        <div>
          <div className="section-kicker" style={{ marginBottom: 6 }}>
            Communications Center
          </div>
          <h2 style={communicationsTitle}>Action inbox for {label(recruiter.name, "recruiter")}</h2>
          <p style={communicationsCopy}>Focused on replies, active conversations, and latest outbound signal.</p>
        </div>

        <div style={identityCard}>
          <span>Assigned identity</span>
          <strong>{alias}</strong>
        </div>
      </div>

      <div style={communicationsGrid}>
        <form action={sendRecruiterMessage} style={composerPanel}>
          <div style={panelKicker}>Send message</div>

          <div style={channelGrid}>
            <label style={channelPill}>
              <input type="radio" name="channel" value="email" defaultChecked />
              Email
            </label>
            <label style={channelPill}>
              <input type="radio" name="channel" value="sms" />
              SMS
            </label>
          </div>

          <label style={fieldLabel}>
            Address book
            <select name="contact" style={inputStyle} defaultValue="">
              <option value="">Custom recipient</option>
              {contacts.slice(0, 40).map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}{contact.organization ? ` · ${contact.organization}` : ""}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldLabel}>
            Template
            <select name="template" style={inputStyle} defaultValue="">
              <option value="">No template</option>
              {templates.slice(0, 40).map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} · {template.channel.toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          <input type="hidden" name="application_id" value="" />
          <input type="hidden" name="dealer_slug" value="" />

          <div style={recipientGrid}>
            <label style={fieldLabel}>
              To email
              <input name="to_email" type="email" placeholder="candidate@email.com" style={inputStyle} />
            </label>
            <label style={fieldLabel}>
              To phone
              <input name="to_phone" placeholder="7135552011" style={inputStyle} />
            </label>
          </div>

          <label style={fieldLabel}>
            Subject
            <input name="subject" placeholder="Interview follow-up" style={inputStyle} />
          </label>

          <label style={fieldLabel}>
            Message
            <textarea name="body" placeholder="Write the message..." rows={5} style={textAreaStyle} />
          </label>

          <button className="btn btn-primary" type="submit" style={sendButtonStyle}>
            Send message
          </button>
        </form>

        <div style={rightPanel}>
          <div style={filterBar}>
            <a href="#comms-needs-reply" style={filterPill}>Inbox</a>
            <a href="#comms-threads" style={filterPill}>Threads</a>
            <a href="#comms-outbound" style={filterPill}>Outbox</a>
          </div>

          <div style={singleScrollPane}>
            <MessageSection
              id="comms-needs-reply"
              title="Needs reply"
              count={needsReply.length}
              empty="No inbound replies need action."
            >
              {needsReply.map((thread) => <ThreadCard key={thread.key} thread={thread} />)}
            </MessageSection>

            <MessageSection
              id="comms-threads"
              title="Active conversations"
              count={activeThreads.length}
              empty="No conversations found."
            >
              {activeThreads.map((thread) => <ThreadCard key={thread.key} thread={thread} />)}
            </MessageSection>

            <MessageSection
              id="comms-outbound"
              title="Recent outbound"
              count={recentOutbound.length}
              empty="No recent outbound messages."
            >
              {recentOutbound.map((message) => <OutboundCard key={String(message.id)} message={message} />)}
            </MessageSection>
          </div>
        </div>
      </div>
    </section>
  );
}

function MessageSection({
  id,
  title,
  count,
  empty,
  children,
}: {
  id: string;
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={messageSection}>
      <div style={sectionHeader}>
        <strong>{title}</strong>
        <span>{count}</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {count === 0 ? <div style={emptyState}>{empty}</div> : children}
      </div>
    </section>
  );
}

function ThreadCard({ thread }: { thread: ThreadSummary }) {
  return (
    <article style={messageRow}>
      <div style={messageMetaRow}>
        <strong>{thread.title}</strong>
        <span>{formatMessageDate(thread.lastAt)}</span>
      </div>
      <p style={messageAddress}>{thread.address}</p>
      <p style={messagePreview}>{thread.preview.slice(0, 170)}</p>
      <div style={messageFooter}>
        <span style={channelBadge}>{thread.channel}</span>
        <span>{thread.total} message{thread.total === 1 ? "" : "s"}</span>
        <span>{thread.inboundCount} in / {thread.outboundCount} out</span>
        {thread.needsReply ? <span style={needsReplyBadge}>needs reply</span> : <span>sent</span>}
      </div>
    </article>
  );
}

function OutboundCard({ message }: { message: AnyRow }) {
  return (
    <article style={messageRowCompact}>
      <div style={messageMetaRow}>
        <strong>{label(message.subject, message.channel === "sms" ? "SMS" : "No subject")}</strong>
        <span>{formatMessageDate(message.created_at || message.sent_at)}</span>
      </div>
      <p style={messagePreview}>{getMessagePreview(message).slice(0, 140)}</p>
      <div style={messageFooter}>
        <span>To {getMessageAddress(message)}</span>
        <span>{label(message.channel, "email")} · {label(message.status, "logged")}</span>
      </div>
    </article>
  );
}

const communicationsShell: React.CSSProperties = {
  marginTop: 34,
  padding: 18,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(145deg, rgba(20,115,255,0.12), rgba(255,255,255,0.045)), rgba(7,16,31,0.74)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
};

const communicationsHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  marginBottom: 14,
};

const communicationsTitle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 24,
  lineHeight: 1,
  letterSpacing: "-0.04em",
};

const communicationsCopy: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.35,
  fontSize: 13,
};

const identityCard: React.CSSProperties = {
  minWidth: 210,
  display: "grid",
  gap: 4,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(96,165,250,0.22)",
  background: "rgba(20,115,255,0.12)",
  color: "#dbeafe",
  fontSize: 13,
};

const communicationsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(320px, 0.78fr) minmax(0, 1.22fr)",
  gap: 14,
  alignItems: "start",
};

const composerPanel: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 14,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.34)",
};

const panelKicker: React.CSSProperties = {
  color: "#facc15",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  fontSize: 11,
};

const channelGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const channelPill: React.CSSProperties = {
  minHeight: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 999,
  border: "1px solid rgba(147,197,253,0.22)",
  background: "rgba(20,115,255,0.13)",
  color: "#dbeafe",
  fontWeight: 950,
};

const fieldLabel: React.CSSProperties = {
  display: "grid",
  gap: 5,
  color: "#dbeafe",
  fontSize: 12,
  fontWeight: 900,
};

const recipientGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  minHeight: 38,
  padding: "0 10px",
  borderRadius: 11,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(3,7,18,0.82)",
  color: "#fff",
  outline: "none",
  fontSize: 13,
};

const textAreaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 98,
  padding: 10,
  resize: "vertical",
};

const sendButtonStyle: React.CSSProperties = {
  minHeight: 44,
};

const rightPanel: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 10,
};

const filterBar: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterPill: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(147,197,253,0.12)",
  border: "1px solid rgba(147,197,253,0.18)",
  color: "#dbeafe",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 950,
};

const singleScrollPane: React.CSSProperties = {
  maxHeight: 506,
  overflowY: "auto",
  paddingRight: 4,
  display: "grid",
  gap: 10,
};

const messageSection: React.CSSProperties = {
  scrollMarginTop: 100,
  padding: 12,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.28)",
};

const sectionHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#ffffff",
  marginBottom: 10,
};

const messageRow: React.CSSProperties = {
  padding: 12,
  borderRadius: 15,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.045)",
};

const messageRowCompact: React.CSSProperties = {
  ...messageRow,
  padding: 11,
};

const messageMetaRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  color: "#ffffff",
  fontSize: 14,
};

const messageAddress: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#8fa6ca",
  fontSize: 12,
};

const messagePreview: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#bfd6f5",
  lineHeight: 1.38,
  fontSize: 12,
};

const messageFooter: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 8,
  color: "#8fa6ca",
  fontSize: 11,
};

const channelBadge: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  color: "#dbeafe",
  background: "rgba(96,165,250,0.22)",
  fontWeight: 950,
};

const needsReplyBadge: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  color: "#fde68a",
  background: "rgba(251,191,36,0.16)",
  fontWeight: 950,
};

const emptyState: React.CSSProperties = {
  padding: 14,
  borderRadius: 14,
  border: "1px dashed rgba(148,163,184,0.25)",
  background: "rgba(148,163,184,0.06)",
  color: "#9fb4d6",
  fontSize: 13,
};
