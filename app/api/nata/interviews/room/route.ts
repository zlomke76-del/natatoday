import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { applicationId } = await req.json();

    const roomName = `nata-${applicationId}-${Date.now()}`;

    const res = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
          enable_chat: true,
          enable_screenshare: true,
        },
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      roomUrl: data.url,
      roomName,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Room creation failed" },
      { status: 500 }
    );
  }
}
