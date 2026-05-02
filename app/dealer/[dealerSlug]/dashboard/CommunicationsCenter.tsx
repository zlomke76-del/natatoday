"use client";

import { useEffect, useState } from "react";

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  from_email: string;
  to_email: string;
  created_at: string;
};

export default function CommunicationsCenter({
  dealerSlug,
}: {
  dealerSlug: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<"inbox" | "outbox">("inbox");

  useEffect(() => {
    loadMessages();
  }, []);

  async function loadMessages() {
    const res = await fetch(
      `/api/nata/messages?dealer_slug=${dealerSlug}`
    );

    const data = await res.json();
    setMessages(data || []);
  }

  const filtered = messages.filter((m) =>
    tab === "inbox" ? m.direction === "inbound" : m.direction === "outbound"
  );

  return (
    <div
      style={{
        marginTop: 16,
        padding: 20,
        borderRadius: 24,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {/* Tabs */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button onClick={() => setTab("inbox")}>
          Inbox
        </button>
        <button onClick={() => setTab("outbox")}>
          Outbox
        </button>
      </div>

      {/* Messages */}
      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((msg) => (
          <div
            key={msg.id}
            style={{
              padding: 14,
              borderRadius: 16,
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <strong>{msg.subject}</strong>

            <p style={{ margin: "6px 0", color: "#9fb4d6" }}>
              {msg.direction === "inbound"
                ? `From: ${msg.from_email}`
                : `To: ${msg.to_email}`}
            </p>

            <p style={{ color: "#cfe2ff" }}>{msg.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
