import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("music_tracks")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to load music tracks:", error);
    return NextResponse.json({ tracks: [] });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const tracks = (data || []).map((track) => ({
    id: track.id,
    title: track.title,
    artist: track.artist,
    mood: track.mood,
    url: `${baseUrl}/storage/v1/object/public/${track.storage_bucket}/${track.storage_path}`,
  }));

  return NextResponse.json({ tracks });
}
