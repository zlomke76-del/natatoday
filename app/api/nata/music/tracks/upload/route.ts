import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MUSIC_BUCKET = "nata-music-library";
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\w.\-() ]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 160) || `track-${Date.now()}.mp3`
  );
}

function cleanTitle(fileName: string): string {
  return fileName
    .replace(/\.mp3$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+\(\d+\)$/g, "")
    .replace(/\d{4}-\d{2}-\d{2}T\d{6}/g, "")
    .replace(/\s+/g, " ")
    .trim() || "Untitled track";
}

function isAllowedAudio(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  return type === "audio/mpeg" || type === "audio/mp3" || name.endsWith(".mp3");
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const title = clean(formData.get("title"));
  const artist = clean(formData.get("artist")) || "NATA Today";
  const mood = clean(formData.get("mood"));
  const category = clean(formData.get("category")) || "workspace";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "A file field named 'file' is required." },
      { status: 400 },
    );
  }

  if (!isAllowedAudio(file)) {
    return NextResponse.json(
      { ok: false, error: "Only MP3 audio files are supported." },
      { status: 400 },
    );
  }

  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Audio file must be greater than 0 bytes and under 50MB." },
      { status: 400 },
    );
  }

  const fileName = safeFileName(file.name || `track-${Date.now()}.mp3`);
  const storagePath = fileName;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from(MUSIC_BUCKET)
    .upload(storagePath, buffer, {
      contentType: "audio/mpeg",
      upsert: true,
    });

  if (uploadError) {
    console.error("Failed to upload music track:", uploadError);
    return NextResponse.json(
      { ok: false, error: uploadError.message },
      { status: 500 },
    );
  }

  const { data: row, error: dbError } = await supabaseAdmin
    .schema("nata")
    .from("music_tracks")
    .upsert(
      {
        title: title || cleanTitle(fileName),
        artist,
        mood: mood || null,
        category,
        storage_bucket: MUSIC_BUCKET,
        storage_path: storagePath,
        file_name: fileName,
        file_type: "audio/mpeg",
        file_size: buffer.length,
        is_active: true,
      },
      { onConflict: "storage_bucket,storage_path" },
    )
    .select("*")
    .single();

  if (dbError) {
    console.error("Failed to store music track metadata:", dbError);
    return NextResponse.json(
      { ok: false, error: dbError.message },
      { status: 500 },
    );
  }

  const { data: publicUrl } = supabaseAdmin.storage
    .from(MUSIC_BUCKET)
    .getPublicUrl(storagePath);

  return NextResponse.json({
    ok: true,
    track: {
      id: row.id,
      title: row.title,
      artist: row.artist,
      mood: row.mood,
      category: row.category,
      url: publicUrl.publicUrl,
    },
  });
}
