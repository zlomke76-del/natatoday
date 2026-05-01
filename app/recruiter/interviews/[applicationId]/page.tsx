"use client";

import { useEffect, useRef, useState } from "react";

export default function InterviewStudio({
  params,
}: {
  params: { applicationId: string };
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function createRoom() {
      const res = await fetch("/api/nata/interviews/room", {
        method: "POST",
        body: JSON.stringify({ applicationId: params.applicationId }),
      });

      const data = await res.json();
      setRoomUrl(data.roomUrl);
    }

    createRoom();
  }, [params.applicationId]);

  async function saveNotes() {
    await fetch("/api/nata/interviews/notes", {
      method: "POST",
      body: JSON.stringify({
        applicationId: params.applicationId,
        notes,
      }),
    });

    alert("Notes saved");
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* VIDEO */}
      <div style={{ flex: 2 }}>
        {roomUrl && (
          <iframe
            ref={iframeRef}
            src={roomUrl}
            allow="camera; microphone; fullscreen; display-capture"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        )}
      </div>

      {/* NOTES PANEL */}
      <div style={{ flex: 1, padding: 20, background: "#0b1220", color: "#fff" }}>
        <h2>Interview Notes</h2>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{
            width: "100%",
            height: 300,
            marginTop: 10,
            background: "#111827",
            color: "#fff",
            padding: 10,
          }}
        />

        <button
          onClick={saveNotes}
          style={{
            marginTop: 20,
            padding: "10px 16px",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
          }}
        >
          Save Notes
        </button>
      </div>
    </div>
  );
}
