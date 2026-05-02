import { NextResponse } from "next/server";

type RewritePayload = {
  channel?: "email" | "sms";
  tone?: string;
  subject?: string;
  body?: string;
  audience?: string;
  recipientName?: string;
};

type RewriteResult = {
  subject: string;
  body: string;
  fallback: boolean;
  reason?: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function fallbackRewrite(input: RewritePayload, reason = "fallback"): RewriteResult {
  const channel = input.channel === "sms" ? "sms" : "email";
  const subject = clean(input.subject);
  const body = clean(input.body);

  if (channel === "sms") {
    const sms = normalizeWhitespace(body);

    return {
      subject: "",
      body: sms.length > 300 ? `${sms.slice(0, 297)}...` : sms,
      fallback: true,
      reason,
    };
  }

  return {
    subject: subject || "Follow-up from NATA Today",
    body,
    fallback: true,
    reason,
  };
}

function extractResponsesOutputText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        return part.text.trim();
      }

      if (typeof part?.value === "string" && part.value.trim()) {
        return part.value.trim();
      }

      if (typeof part?.content === "string" && part.content.trim()) {
        return part.content.trim();
      }
    }
  }

  return "";
}

function safeParseJsonObject(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);

    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function buildInstructions(channel: "email" | "sms", tone: string, audience: string) {
  const base = [
    "You are Solace Rewrite Assist inside NATA Today.",
    "Rewrite the user's draft. Do not merely repeat it.",
    "Preserve the factual meaning, names, dates, links, role titles, dealership names, and commitments.",
    "Do not invent new facts, promises, legal claims, compensation terms, hiring decisions, or deadlines.",
    "Improve clarity, professionalism, structure, and conversion quality.",
    `Tone requested: ${tone}.`,
    `Audience: ${audience}.`,
    "Return JSON only with exactly these keys: subject, body.",
  ];

  if (channel === "sms") {
    return [
      ...base,
      "This is an SMS rewrite.",
      "Keep the message concise and natural.",
      "Target 160-300 characters when possible.",
      "Use one clear purpose and one CTA max.",
      "No fluff. No HR/legal overclaim. No signature block.",
      "The subject must be an empty string.",
    ].join("\n");
  }

  return [
    ...base,
    "This is an email rewrite.",
    "Create a professional email body suitable for dealership recruiting communication.",
    "Use short paragraphs.",
    "Include a clear next step or CTA when appropriate.",
    "Do not include a full HTML wrapper.",
    "Do not include a large signature block; the system adds the branded signature separately.",
    "Subject should be professional and specific.",
  ].join("\n");
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as RewritePayload | null;

  if (!payload || !clean(payload.body)) {
    return NextResponse.json(
      { error: "Message body is required." },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(fallbackRewrite(payload, "missing_openai_api_key"));
  }

  const channel = payload.channel === "sms" ? "sms" : "email";
  const tone = clean(payload.tone) || "Professional";
  const audience = clean(payload.audience) || "recipient";
  const currentSubject = clean(payload.subject);
  const currentBody = clean(payload.body);

  const prompt = {
    channel,
    tone,
    audience,
    recipientName: clean(payload.recipientName),
    currentSubject,
    currentBody,
    rewriteRequirement:
      "Return a materially improved rewrite. Keep facts intact, but improve wording, structure, and usefulness.",
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
            content: buildInstructions(channel, tone, audience),
          },
          {
            role: "user",
            content: JSON.stringify(prompt),
          },
        ],
        temperature: 0.55,
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

      return NextResponse.json(
        fallbackRewrite(payload, `openai_error_${response.status}`),
      );
    }

    const data = await response.json();
    const outputText = extractResponsesOutputText(data);
    const parsed = safeParseJsonObject(outputText);

    if (!parsed || typeof parsed !== "object") {
      console.error("Solace rewrite returned unparseable output:", outputText);

      return NextResponse.json(fallbackRewrite(payload, "unparseable_output"));
    }

    const rewrittenSubject =
      channel === "sms"
        ? ""
        : clean(parsed.subject) || currentSubject || "Follow-up from NATA Today";

    const rewrittenBody = clean(parsed.body);

    if (!rewrittenBody) {
      return NextResponse.json(fallbackRewrite(payload, "empty_rewrite_body"));
    }

    const bodyChanged =
      normalizeWhitespace(rewrittenBody).toLowerCase() !==
      normalizeWhitespace(currentBody).toLowerCase();

    return NextResponse.json({
      subject: rewrittenSubject,
      body: rewrittenBody,
      fallback: false,
      changed: bodyChanged,
    });
  } catch (error) {
    console.error("Solace rewrite route error:", error);

    return NextResponse.json(fallbackRewrite(payload, "route_exception"));
  }
}
