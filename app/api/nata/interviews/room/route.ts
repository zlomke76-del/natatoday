import { NextRequest, NextResponse } from "next/server";

const DAILY_API_URL = "https://api.daily.co/v1";

export async function POST(req: NextRequest) {
  try {
    const { applicationId, recruiterName } = await req.json();

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId" },
        { status: 400 }
      );
    }

    if (!process.env.DAILY_API_KEY) {
      return NextResponse.json(
        { error: "Daily API key is not configured" },
        { status: 500 }
      );
    }

    const roomName = `nata-${applicationId}-${Date.now()}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

    const roomResponse = await fetch(`${DAILY_API_URL}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: expiresAt,
          enable_chat: true,
          enable_screenshare: true,
        },
      }),
    });

    const roomData = await roomResponse.json();

    if (!roomResponse.ok || !roomData?.url) {
      return NextResponse.json(
        {
          error: roomData?.error || roomData?.info || "Room could not be created",
        },
        { status: roomResponse.status || 500 }
      );
    }

    const tokenResponse = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          room_name: roomName,
          user_name: recruiterName || "Don",
          is_owner: true,
          exp: expiresAt,
        },
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData?.token) {
      return NextResponse.json(
        {
          error:
            tokenData?.error ||
            tokenData?.info ||
            "Meeting token could not be created",
        },
        { status: tokenResponse.status || 500 }
      );
    }

    const roomUrl = `${roomData.url}?t=${encodeURIComponent(tokenData.token)}`;

    return NextResponse.json({
      roomUrl,
      roomName,
    });
  } catch (err) {
    console.error("POST /api/nata/interviews/room failed", err);

    return NextResponse.json(
      { error: "Room creation failed" },
      { status: 500 }
    );
  }
}
