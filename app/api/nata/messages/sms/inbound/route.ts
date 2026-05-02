import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const formData = await req.formData();

  const from = formData.get("From")?.toString() || "";
  const to = formData.get("To")?.toString() || "";
  const body = formData.get("Body")?.toString() || "";

  // 🔎 match application by phone
  const { data: application } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("id, dealer_slug")
    .eq("phone", from)
    .maybeSingle();

  await supabaseAdmin.schema("nata").from("messages").insert({
    channel: "sms",
    direction: "inbound",
    body,
    from_phone: from,
    to_phone: to,
    application_id: application?.id || null,
    dealer_slug: application?.dealer_slug || null,
    provider: "twilio",
    status: "received",
  });

  return NextResponse.json({ success: true });
}
