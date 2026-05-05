import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const resend = new Resend(process.env.RESEND_API_KEY);

function verify(body: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing RESEND_WEBHOOK_SECRET");

  const webhook = new Webhook(secret);

  return webhook.verify(body, {
    "svix-id": headers.get("svix-id") || "",
    "svix-timestamp": headers.get("svix-timestamp") || "",
    "svix-signature": headers.get("svix-signature") || "",
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  let event: any;

  try {
    event = verify(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true });
  }

  const emailId = event.data.email_id;

  try {
    const full = await resend.emails.receiving.get(emailId);

    const from = full.from?.email || "";
    const to = full.to?.[0]?.email || "";
    const subject = full.subject || "";
    const text = full.text || "";
    const html = full.html || "";

    await supabaseAdmin.schema("nata").from("messages").insert({
      direction: "inbound",
      channel: "email",
      status: "received",
      subject,
      body: text,
      body_text: text,
      body_html: html,
      from_email: from,
      to_email: to,
      provider: "resend",
      provider_message_id: emailId,
      provider_payload: event.data,
      received_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Inbound email error", err);
    return NextResponse.json({ error: "Inbound failed" }, { status: 500 });
  }
}
