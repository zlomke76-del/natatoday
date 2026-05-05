import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const type = event.type;
    const data = event.data;

    // DELIVERY EVENTS
    if (
      type === "email.delivered" ||
      type === "email.bounced" ||
      type === "email.complained"
    ) {
      const messageId = data.email_id;

      const status =
        type === "email.delivered"
          ? "delivered"
          : type === "email.bounced"
          ? "bounced"
          : "complained";

      await supabaseAdmin
        .schema("nata")
        .from("messages")
        .update({
          status,
          provider_payload: data,
        })
        .eq("provider_message_id", messageId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
