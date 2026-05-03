import { NextResponse } from "next/server";
import {
  returnApplicationToCandidatePool,
  syncCandidateMatches,
} from "../../../../lib/nataCandidatePool";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { applicationId, source, reason } = body || {};

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId" },
        { status: 400 }
      );
    }

    const candidate = await returnApplicationToCandidatePool({
      applicationId,
      source: source || "system",
      reason: reason || "Returned to pool",
    });

    if (candidate) {
      await syncCandidateMatches(candidate);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("candidate-pool route error:", err);
    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
