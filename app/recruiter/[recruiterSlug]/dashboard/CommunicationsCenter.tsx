import { redirect } from "next/navigation";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { sendEmail } from "../../../../../lib/email";

type AnyRow = Record<string, any>;

type CommunicationsCenterProps = {
  recruiter: AnyRow;
  recruiterSlug: string;
  applications: AnyRow[];
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

function getRecruiterAlias(recruiter: AnyRow, recruiterSlug: string) {
  return label(
    recruiter.email_alias || recruiter.recruiter_email_alias,
    `${recruiterSlug}@natatoday.ai`
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

async function loadMessages(recruiterId: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("messages")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .order("created_at", { ascending: false })
    .limit(18);

  if (error) {
    console.error("Failed to load recruiter messages:", error);
  }

  return (data || []) as AnyRow[];
}

export default async function CommunicationsCenter({
  recruiter,
  recruiterSlug,
  applications,
}: CommunicationsCenterProps) {
  const recruiterId = String(recruiter.id);
  const alias = getRecruiterAlias(recruiter, recruiterSlug);
  const fromLine = getRecruiterFromLine(recruiter, recruiterSlug);
  const messages = await loadMessages(recruiterId);
  const inbox = messages.filter((message) => message.direction === "inbound");
  const outbox = messages.filter((message) => message.direction === "outbound");

  async function sendRecruiterMessage(formData: FormData) {
    "use server";

    const applicationId = clean(formData.get("application_id"));
    const to = clean(formData.get("to"));
    const subject = clean(formData.get("subject"));
    const body = clean(formData.get("body"));

    if (!to || !subject || !body) {
      throw new Error("Recipient, subject, and message body are required.");
    }

    await sendEmail({
      to,
      subject,
      text: body,
      html: plainToHtml(body),
      from: fromLine,
      replyTo: alias,
      recruiterId,
      applicationId: applicationId || null,
    });

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  const selectableApplications = applications
    .filter((application) => application.email)
    .slice(0, 80);

  return (
    <section style={communicationsShell}>
      <div style={communicationsHeader}>
        <div>
          <div className="section-kicker" style={{ marginBottom: 10 }}>
            Communications Center
          </div>
          <h2 style={communicationsTitle}>Inbox + outbox for {label(recruiter.name, "recruiter")}</h2>
          <p style={communicationsCopy}>
            Messages are recruiter-scoped and attached to candidates when possible. Outbound email sends from {alias} and replies route back into the NATA record when inbound parsing is enabled.
          </p>
        </div>

        <div style={identityCard}>
          <span>Assigned identity</span>
          <strong>{alias}</strong>
        </div>
      </div>

      <div style={communicationsGrid}>
        <form action={sendRecruiterMessage} style={composeCard}>
          <div style={cardTopline}>Send message</div>

          <label style={fieldStyle}>
            <span>Candidate / application</span>
            <select name="application_id" style={inputStyle}>
              <option value="">No application selected</option>
              {selectableApplications.map((application) => (
                <option key={String(application.id)} value={String(application.id)}>
                  {label(application.name || application.email, "Candidate")} · {application.email}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>To</span>
            <input
              name="to"
              placeholder="candidate@email.com"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>Subject</span>
            <input
              name="subject"
              placeholder="Interview follow-up"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>Message</span>
            <textarea
              name="body"
              placeholder="Write the message Don or the recruiter should send..."
              rows={7}
              style={{ ...inputStyle, paddingTop: 12, resize: "vertical" }}
            />
          </label>

          <button className="btn btn-primary" type="submit" style={{ border: 0, cursor: "pointer" }}>
            Send from {alias}
          </button>
        </form>

        <div style={messageColumn}>
          <MessageList title="Inbox" empty="No inbound replies yet." messages={inbox} />
          <MessageList title="Outbox" empty="No outbound messages logged yet." messages={outbox} />
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
                <strong>{label(message.subject, "No subject")}</strong>
                <span>{formatMessageDate(message.created_at || message.sent_at || message.received_at)}</span>
              </div>
              <p style={messagePreview}>
                {label(
                  message.body_text ||
                    String(message.body_html || "").replace(/<[^>]+>/g, " "),
                  "No message body"
                ).slice(0, 190)}
              </p>
              <div style={messageFooter}>
                <span>{message.direction === "inbound" ? `From ${label(message.from_email)}` : `To ${label(message.to_email)}`}</span>
                <span>{label(message.status, "logged")}</span>
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
  maxWidth: 800,
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
  gridTemplateColumns: "minmax(320px, 0.86fr) minmax(0, 1.14fr)",
  gap: 18,
  marginTop: 22,
};

const composeCard: React.CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 18,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.36)",
};

const cardTopline: React.CSSProperties = {
  color: "#fbbf24",
  fontWeight: 950,
  fontSize: 12,
  letterSpacing: ".14em",
  textTransform: "uppercase",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  color: "#d7e8ff",
  fontSize: 13,
  fontWeight: 850,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#07101f",
  color: "#ffffff",
  padding: "0 12px",
  outline: "none",
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
