import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MUSIC_BUCKET = "nata-music-library";

function cleanTitle(fileName: string): string {
  return (
    fileName
      .replace(/\.mp3$/i, "")
      .replace(/_/g, " ")
      .replace(/\s+\(\d+\)$/g, "")
      .replace(/\d{4}-\d{2}-\d{2}T\d{6}/g, "")
      .replace(/\s+/g, " ")
      .trim() || "Untitled track"
  );
}

function inferMood(fileName: string): string {
  const lower = fileName.toLowerCase();

  if (lower.includes("backroad")) return "Country / reflective";
  if (lower.includes("red_dirt")) return "Country";
  if (lower.includes("burn")) return "High energy";
  if (lower.includes("fire")) return "Motivational";
  if (lower.includes("vibe")) return "Upbeat";
  if (lower.includes("five_minutes")) return "Focused";
  if (lower.includes("signal")) return "Reflective";
  if (lower.includes("blink")) return "Modern / punchy";

  return "Workspace";
}

function isMp3(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".mp3");
}

async function syncStorageTracks(): Promise<{
  scanned: number;
  error?: string;
}> {
  const { data: files, error: listError } = await supabaseAdmin.storage
    .from(MUSIC_BUCKET)
    .list("", {
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

  if (listError) {
    console.error("Failed to list music storage bucket:", listError);
    return { scanned: 0, error: listError.message };
  }

  const mp3Files = (files || []).filter((file) => isMp3(file.name));

  if (!mp3Files.length) return { scanned: 0 };

  const rows = mp3Files.map((file, index) => ({
    title: cleanTitle(file.name),
    artist: "NATA Today",
    mood: inferMood(file.name),
    category: "workspace",
    storage_bucket: MUSIC_BUCKET,
    storage_path: file.name,
    file_name: file.name,
    file_type: "audio/mpeg",
    file_size:
      typeof file.metadata?.size === "number" ? file.metadata.size : null,
    is_active: true,
    sort_order: 100 + index,
  }));

  const { error: upsertError } = await supabaseAdmin
    .schema("nata")
    .from("music_tracks")
    .upsert(rows, {
      onConflict: "storage_bucket,storage_path",
      ignoreDuplicates: true,
    });

  if (upsertError) {
    console.error("Failed to sync music tracks:", upsertError);
    return { scanned: rows.length, error: upsertError.message };
  }

  return { scanned: rows.length };
}

export async function GET() {
  const syncResult = await syncStorageTracks();

  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("music_tracks")
    .select(
      "id,title,artist,mood,category,storage_bucket,storage_path,file_name,sort_order,created_at",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load music tracks:", error);

    return NextResponse.json(
      {
        ok: false,
        tracks: [],
        error: error.message,
        sync: syncResult,
      },
      { status: 500 },
    );
  }

  const tracks = (data || []).map((track) => {
    const { data: publicUrl } = supabaseAdmin.storage
      .from(track.storage_bucket || MUSIC_BUCKET)
      .getPublicUrl(track.storage_path);

    return {
      id: String(track.id),
      title: track.title || cleanTitle(track.file_name || track.storage_path),
      artist: track.artist || "NATA Today",
      mood: track.mood || inferMood(track.file_name || track.storage_path),
      category: track.category || "workspace",
      url: publicUrl.publicUrl,
    };
  });

  return NextResponse.json({
    ok: true,
    synced: !syncResult.error,
    sync: syncResult,
    tracks,
  });
}
