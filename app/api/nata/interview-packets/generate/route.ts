import { NextRequest, NextResponse } from "next/server";
import { generateInterviewPacket } from "../../../../../lib/nataInterviewPacket";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    const result = await generateInterviewPacket(applicationId);

    return NextResponse.json({
      success: true,
      packet: result.packet,
    });
  } catch (error) {
    console.error("Failed to generate interview packet:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Packet generation failed" },
      { status: 500 }
    );
  }
}
