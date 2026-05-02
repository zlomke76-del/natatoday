import { redirect } from "next/navigation";
import { sendEmail } from "../../../../lib/email";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type AnyRow = Record<string, any>;

type CommunicationsCenterProps = {
  dealerSlug: string;
};

function label(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
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

function getDirection(message: AnyRow) {
  const direction = String(message.direction || "").toLowerCase();

  if (direction === "inbound") return "inbound";
  if (direction === "outbound") return "outbound";

  return "outbound";
}

function getMessageSubject(message: AnyRow) {
  return label(message.subject, "No subject");
}

function getMessageBody(message: AnyRow) {
  return label(
    message.body_text ||
      message.text ||
      message.preview ||
      message.snippet ||
      message.body ||
      message.html,
    "No message body recorded.",
  );
}

function getSender(message: AnyRow) {
  return label(
    message.from_email ||
      message.sender_email ||
      message.from_address ||
      message.sender,
    "Unknown sender",
  );
}

function getRecipient(message: AnyRow) {
  return label(
    message.to_email ||
      message.recipient_email ||
      message.to_address ||
      message.recipient,
    "Unknown recipient",
  );
}

function getStatus(message: AnyRow) {
  return label(message.status || message.delivery_status, "recorded");
}

async function loadDealerMessages(dealerSlug: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("messages")
    .select("*")
    .eq("dealer_slug", dealerSlug)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    console.error("Failed to load dealer messages:", error);
  }

  return (data || []) as AnyRow[];
}

export default async function CommunicationsCenter({
  dealerSlug,
}: CommunicationsCenterProps) {
  const messages = await loadDealerMessages(dealerSlug);
  const inbox = messages.filter((message) => getDirection(message) === "inbound");
  const outbox = messages.filter((message) => getDirection(message) === "outbound");

  return (
    <section
      style={{
        marginTop: 16,
        padding: 22,
        borderRadius: 26,
        background:
          "linear-gradient(145deg, rgba(20,115,255,0.105), rgba(255,255,255,0.04))",
        border: "1px solid rgba(147,197,253,0.16)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "#fff",
              fontSize: 30,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            Dealer communications.
          </h2>

          <p
            style={{
              margin: "10px 0 0",
              color: "#bfd6f5",
              lineHeight: 1.6,
              maxWidth: 720,
            }}
          >
            Inbox and outbox activity tied to this dealership. Candidate,
            recruiter, and dealer messages stay attached to the hiring workflow.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(88px, 1fr))",
            gap: 10,
            minWidth: 300,
          }}
        >
          <CommunicationMetric label="Total" value={messages.length} />
          <CommunicationMetric label="Inbox" value={inbox.length} />
          <CommunicationMetric label="Outbox" value={outbox.length} />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 16,
          marginTop: 20,
        }}
      >
        <MessageColumn
          title="Inbox"
          empty="No inbound messages have been recorded for this dealer yet."
          messages={inbox}
          mode="inbox"
        />

        <MessageColumn
          title="Outbox"
          empty="No outbound messages have been recorded for this dealer yet."
          messages={outbox}
          mode="outbox"
        />
      </div>
    </section>
  );
}

function CommunicationMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 18,
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <strong
        style={{
          display: "block",
          color: "#fff",
          fontSize: 24,
          lineHeight: 1,
        }}
      >
        {value}
      </strong>
      <span
        style={{
          display: "block",
          color: "#9fb4d6",
          fontSize: 12,
          marginTop: 5,
          fontWeight: 850,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function MessageColumn({
  title,
  empty,
  messages,
  mode,
}: {
  title: string;
  empty: string;
  messages: AnyRow[];
  mode: "inbox" | "outbox";
}) {
  return (
    <div
      style={{
        minHeight: 280,
        padding: 16,
        borderRadius: 22,
        background: "rgba(3,10,20,0.32)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <strong
          style={{
            color: "#fff",
            fontSize: 18,
          }}
        >
          {title}
        </strong>

        <span
          style={{
            padding: "7px 10px",
            borderRadius: 999,
            background:
              mode === "inbox"
                ? "rgba(34,197,94,0.12)"
                : "rgba(59,130,246,0.14)",
            border:
              mode === "inbox"
                ? "1px solid rgba(34,197,94,0.24)"
                : "1px solid rgba(96,165,250,0.26)",
            color: mode === "inbox" ? "#86efac" : "#bfdbfe",
            fontSize: 12,
            fontWeight: 950,
          }}
        >
          {messages.length}
        </span>
      </div>

      {messages.length === 0 ? (
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: "rgba(255,255,255,0.035)",
            border: "1px dashed rgba(255,255,255,0.12)",
            color: "#bfd6f5",
            lineHeight: 1.55,
          }}
        >
          {empty}
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {messages.slice(0, 8).map((message) => (
            <MessageCard
              key={String(
                message.id || `${mode}-${message.created_at}-${message.subject}`,
              )}
              message={message}
              mode={mode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageCard({
  message,
  mode,
}: {
  message: AnyRow;
  mode: "inbox" | "outbox";
}) {
  const body = getMessageBody(message);

  return (
    <article
      style={{
        padding: 14,
        borderRadius: 18,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <strong
          style={{
            color: "#fff",
            fontSize: 15,
            lineHeight: 1.25,
          }}
        >
          {getMessageSubject(message)}
        </strong>

        <span
          style={{
            flex: "0 0 auto",
            color: "#9fb4d6",
            fontSize: 12,
          }}
        >
          {formatMessageDate(message.created_at)}
        </span>
      </div>

      <p
        style={{
          margin: "8px 0 0",
          color: "#9fb4d6",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {mode === "inbox"
          ? `From: ${getSender(message)}`
          : `To: ${getRecipient(message)}`}
      </p>

      <p
        style={{
          margin: "8px 0 0",
          color: "#cfe2ff",
          lineHeight: 1.5,
          fontSize: 13,
          whiteSpace: "pre-line",
        }}
      >
        {body.slice(0, 280)}
        {body.length > 280 ? "…" : ""}
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 10,
        }}
      >
        <span
          style={{
            padding: "6px 9px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#bfd6f5",
            fontSize: 11,
            fontWeight: 900,
          }}
        >
          {getStatus(message)}
        </span>

        {message.application_id ? (
          <span
            style={{
              padding: "6px 9px",
              borderRadius: 999,
              background: "rgba(20,115,255,0.12)",
              border: "1px solid rgba(96,165,250,0.2)",
              color: "#bfdbfe",
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            Application linked
          </span>
        ) : null}
      </div>
    </article>
  );
}
