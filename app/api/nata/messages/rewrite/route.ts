import { NextResponse } from "next/server";

type RewritePayload = {
  channel?: "email" | "sms";
  tone?: string;
  subject?: string;
  body?: string;
  audience?: string;
  recipientName?: string;
};

function fallbackRewrite(input: RewritePayload) {
  const channel = input.channel === "sms" ? "sms" : "email";
  const subject = (input.subject || "").trim();
  const body = (input.body || "").trim();

  if (channel === "sms") {
    return {
      subject: "",
      body: body
        .replace(/\s+/g, " ")
        .slice(0, 300),
      fallback: true,
    };
  }

  return {
    subject: subject || "Follow-up from NATA Today",
    body,
    fallback: true,
  };
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as RewritePayload | null;

  if (!payload || !payload.body?.trim()) {
    return NextResponse.json(
      { error: "Message body is required." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(fallbackRewrite(payload));
  }

  const channel = payload.channel === "sms" ? "sms" : "email";
  const tone = payload.tone || "Professional";
  const audience = payload.audience || "recipient";

  const instructions =
    channel === "sms"
      ? "Rewrite the draft as a concise professional SMS. Keep it between 160 and 300 characters when possible. Use one clear purpose, one CTA max, no fluff, no legal or HR overclaim. Return JSON only with keys subject and body. Subject must be an empty string."
      : "Rewrite the draft as a professional NATA Today email. Keep it clear, warm, concise, dealership-appropriate, with a strong CTA and a simple NATA Today signature. Return JSON only with keys subject and body.";

  const prompt = {
    channel,
    tone,
    audience,
    recipientName: payload.recipientName || "",
    currentSubject: payload.subject || "",
    currentBody: payload.body,
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.NATA_REWRITE_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: instructions,
          },
          {
            role: "user",
            content: JSON.stringify(prompt),
          },
        ],
        text: {
          format: {
            type: "json_object",
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("Solace rewrite failed:", response.status, text);
      return NextResponse.json(fallbackRewrite(payload));
    }

    const data = await response.json();
    const outputText =
      data.output_text ||
      data.output?.[0]?.content?.[0]?.text ||
      data.output?.[0]?.content?.[0]?.value ||
      "";

    const parsed = JSON.parse(outputText || "{}");

    return NextResponse.json({
      subject:
        typeof parsed.subject === "string"
          ? parsed.subject.trim()
          : channel === "sms"
            ? ""
            : payload.subject || "Follow-up from NATA Today",
      body:
        typeof parsed.body === "string" && parsed.body.trim()
          ? parsed.body.trim()
          : payload.body,
      fallback: false,
    });
  } catch (error) {
    console.error("Solace rewrite route error:", error);
    return NextResponse.json(fallbackRewrite(payload));
  }
}
