import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ATTACHMENT_BUCKET =
  process.env.NATA_MESSAGE_ATTACHMENT_BUCKET || "nata-message-attachments";

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^\w.\-() ]+/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 120) || "attachment"
  );
}

function extensionFromFileName(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

function fallbackContentType(fileName: string, incomingType: string): string {
  if (incomingType && incomingType !== "application/octet-stream") {
    return incomingType.toLowerCase();
  }

  const extension = extensionFromFileName(fileName);

  if (extension === "pdf") return "application/pdf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";

  return incomingType || "application/octet-stream";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const recruiterId = clean(formData.get("recruiter_id"));
  const applicationId = clean(formData.get("application_id"));
  const threadId = clean(formData.get("thread_id"));
  const messageDraftId = clean(formData.get("message_draft_id"));

  const files = formData.getAll("files").filter((entry): entry is File => {
    return entry instanceof File;
  });

  if (!recruiterId) {
    return NextResponse.json(
      { ok: false, error: "recruiter_id is required." },
      { status: 400 }
    );
  }

  if (!files.length) {
    return NextResponse.json(
      { ok: false, error: "At least one file is required." },
      { status: 400 }
    );
  }

  const uploaded: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    storageBucket: string;
    storagePath: string;
    applicationId: string | null;
    threadId: string | null;
    messageDraftId: string | null;
  }> = [];

  const skipped: string[] = [];

  for (const file of files) {
    const fileName = safeFileName(file.name || "attachment");
    const fileType = fallbackContentType(fileName, file.type || "");
    const fileSize = file.size;

    if (!ALLOWED_ATTACHMENT_TYPES.has(fileType)) {
      skipped.push(`${fileName}: unsupported type ${fileType}`);
      continue;
    }

    if (fileSize > MAX_ATTACHMENT_BYTES) {
      skipped.push(`${fileName}: exceeds 15MB limit`);
      continue;
    }

    if (fileSize <= 0) {
      skipped.push(`${fileName}: empty file`);
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
      skipped.push(`${fileName}: empty file`);
      continue;
    }

    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      skipped.push(`${fileName}: exceeds 15MB limit`);
      continue;
    }

    const storagePath = [
      "outbound",
      recruiterId,
      threadId || applicationId || "unassigned",
      `${Date.now()}-${crypto.randomUUID()}-${fileName}`,
    ].join("/");

    const { error: uploadError } = await supabaseAdmin.storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, buffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload outbound attachment:", uploadError);
      skipped.push(`${fileName}: upload failed`);
      continue;
    }

    uploaded.push({
      fileName,
      fileType,
      fileSize: buffer.length,
      storageBucket: ATTACHMENT_BUCKET,
      storagePath,
      applicationId: applicationId || null,
      threadId: threadId || null,
      messageDraftId: messageDraftId || null,
    });
  }

  if (!uploaded.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "No files were uploaded.",
        skipped,
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    uploaded,
    skipped,
  });
}
