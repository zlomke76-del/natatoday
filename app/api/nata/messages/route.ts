import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const dealerSlug = searchParams.get("dealer_slug");

  const { data } = await supabaseAdmin
    .schema("nata")
    .from("messages")
    .select("*")
    .eq("dealer_slug", dealerSlug)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json(data || []);
}
