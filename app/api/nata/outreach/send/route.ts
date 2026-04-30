import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outreach_id } = body;

    if (!outreach_id) {
      return NextResponse.json({ error: "Missing outreach_id" }, { status: 400 });
    }

    const { data: outreach, error } = await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .select("*")
      .eq("id", outreach_id)
      .single();

    if (error || !outreach) {
      return NextResponse.json({ error: "Outreach not found" }, { status: 404 });
    }

    if (outreach.outreach_status !== "approved") {
      return NextResponse.json(
        { error: "Outreach must be approved before sending" },
        { status: 400 }
      );
    }

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <p>Hi ${outreach.candidate_name || "there"},</p>

        <p>
          We reviewed your profile again while preparing a new opportunity.
        </p>

        <p>
          Based on your background and prior notes, this role may be a stronger fit
          than what you previously considered.
        </p>

        <p>
          If you're open to it, we can move you forward without restarting the process.
        </p>

        <p>
          <a href="https://natatoday.ai/careers/${outreach.job_id}">
            View role
          </a>
        </p>

        <p>– NATA Recruiting Team</p>
      </div>
    `;

    await sendEmail({
      to: outreach.candidate_email,
      subject: outreach.message_subject || "A new role may be a strong fit",
      html,
    });

    await supabaseAdmin
      .schema("nata")
      .from("candidate_outreach")
      .update({
        outreach_status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", outreach_id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }
}
