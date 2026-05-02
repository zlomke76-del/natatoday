"use client";

import { useMemo, useState, useTransition } from "react";

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

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  alias: string;
  recruiterName: string;
  contacts: ContactOption[];
  templates: TemplateOption[];
};

const toneOptions = [
  "Professional",
  "Warm",
  "Shorter",
  "Stronger",
  "Dealer-facing",
  "Candidate-facing",
  "Prospect outreach",
];

function applyTokens(value: string, contact: ContactOption | null, recruiterName: string) {
  return value
    .replaceAll("{{name}}", contact?.name || "there")
    .replaceAll("{{role}}", contact?.organization || "the role")
    .replaceAll("{{recruiterName}}", recruiterName)
    .replaceAll("{{link}}", "[link]");
}

export default function CommunicationsComposerClient({
  action,
  alias,
  recruiterName,
  contacts,
  templates,
}: Props) {
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [tone, setTone] = useState("Professional");
  const [toEmail, setToEmail] = useState("");
  const [toPhone, setToPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [rewriteStatus, setRewriteStatus] = useState("");

  const selectedContact = useMemo(() => {
    return contacts.find((contact) => contact.id === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  const channelTemplates = useMemo(() => {
    return templates.filter((template) => template.channel === channel);
  }, [templates, channel]);

  function handleContactChange(contactId: string) {
    setSelectedContactId(contactId);

    const contact = contacts.find((item) => item.id === contactId);

    if (!contact) return;

    setToEmail(contact.email || "");
    setToPhone(contact.phone || "");
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);

    const template = templates.find((item) => item.id === templateId);

    if (!template) return;

    setChannel(template.channel);
    setSubject(applyTokens(template.subject || "", selectedContact, recruiterName));
    setBody(applyTokens(template.body, selectedContact, recruiterName));
  }

  async function rewriteWithSolace() {
    setRewriteStatus("");

    if (!body.trim()) {
      setRewriteStatus("Write a draft before asking Solace to rewrite it.");
      return;
    }

    try {
      setRewriteStatus("Solace is rewriting...");

      const response = await fetch("/api/nata/messages/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          tone,
          subject,
          body,
          audience: selectedContact?.type || "custom",
          recipientName: selectedContact?.name || "",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.error || "Rewrite failed.");
      }

      if (typeof result.subject === "string") {
        setSubject(result.subject);
      }

      if (typeof result.body === "string") {
        setBody(result.body);
      }

      setRewriteStatus("Rewrite ready. Review before sending.");
    } catch (error) {
      console.error(error);
      setRewriteStatus("Solace rewrite is unavailable. Keep editing manually.");
    }
  }

  function handleSubmit(formData: FormData) {
    formData.set("channel", channel);
    formData.set("application_id", selectedContact?.applicationId || "");
    formData.set("dealer_slug", selectedContact?.dealerSlug || "");
    formData.set("to_email", toEmail);
    formData.set("to_phone", toPhone);
    formData.set("subject", subject);
    formData.set("body", body);

    startTransition(() => {
      void action(formData);
    });
  }

  return (
    <form action={handleSubmit} style={composeCard}>
      <div style={cardTopline}>Send message</div>

      <div style={toggleRow}>
        <button
          type="button"
          onClick={() => setChannel("email")}
          style={{
            ...toggleButton,
            ...(channel === "email" ? toggleActive : null),
          }}
        >
          Email
        </button>
        <button
          type="button"
          onClick={() => setChannel("sms")}
          style={{
            ...toggleButton,
            ...(channel === "sms" ? toggleActive : null),
          }}
        >
          SMS
        </button>
      </div>

      <label style={fieldStyle}>
        <span>Address book</span>
        <select
          value={selectedContactId}
          onChange={(event) => handleContactChange(event.target.value)}
          style={inputStyle}
        >
          <option value="">Custom recipient</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name} · {contact.type}
              {contact.organization ? ` · ${contact.organization}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldStyle}>
        <span>Template</span>
        <select
          value={selectedTemplateId}
          onChange={(event) => handleTemplateChange(event.target.value)}
          style={inputStyle}
        >
          <option value="">No template</option>
          {channelTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} · {template.audience}
            </option>
          ))}
        </select>
      </label>

      {channel === "email" ? (
        <>
          <label style={fieldStyle}>
            <span>To email</span>
            <input
              value={toEmail}
              onChange={(event) => setToEmail(event.target.value)}
              placeholder="candidate@email.com"
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span>Subject</span>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Interview follow-up"
              style={inputStyle}
            />
          </label>
        </>
      ) : (
        <label style={fieldStyle}>
          <span>To phone</span>
          <input
            value={toPhone}
            onChange={(event) => setToPhone(event.target.value)}
            placeholder="+17135551212"
            style={inputStyle}
          />
        </label>
      )}

      <label style={fieldStyle}>
        <span>Message</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={
            channel === "sms"
              ? "Write a short SMS..."
              : "Write the email message..."
          }
          rows={channel === "sms" ? 4 : 8}
          style={{ ...inputStyle, paddingTop: 12, resize: "vertical" }}
        />
      </label>

      <div style={rewritePanel}>
        <label style={fieldStyle}>
          <span>Solace tone</span>
          <select
            value={tone}
            onChange={(event) => setTone(event.target.value)}
            style={inputStyle}
          >
            {toneOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={rewriteWithSolace}
          style={rewriteButton}
          disabled={isPending}
        >
          Rewrite with Solace
        </button>
      </div>

      {rewriteStatus ? <div style={helperText}>{rewriteStatus}</div> : null}

      <button
        className="btn btn-primary"
        type="submit"
        style={{ border: 0, cursor: "pointer" }}
        disabled={isPending}
      >
        {isPending
          ? "Sending..."
          : channel === "sms"
            ? `Send SMS from ${alias}`
            : `Send email from ${alias}`}
      </button>
    </form>
  );
}

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

const toggleRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
};

const toggleButton: React.CSSProperties = {
  minHeight: 42,
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.055)",
  color: "#bfd6f5",
  fontWeight: 900,
  cursor: "pointer",
};

const toggleActive: React.CSSProperties = {
  background: "rgba(20,115,255,0.22)",
  border: "1px solid rgba(96,165,250,0.38)",
  color: "#ffffff",
};

const rewritePanel: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "end",
};

const rewriteButton: React.CSSProperties = {
  minHeight: 44,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(251,191,36,0.24)",
  background: "rgba(251,191,36,0.12)",
  color: "#fde68a",
  fontWeight: 950,
  cursor: "pointer",
};

const helperText: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "rgba(255,255,255,0.045)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#bfd6f5",
  fontSize: 13,
  lineHeight: 1.45,
};
