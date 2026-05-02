import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type ScreenDecision = "not_fit" | "virtual_invited" | "needs_review";

type JobContext = {
  id: string;
  title: string | null;
  slug: string | null;
  dealer_id?: string | null;
  dealer_slug: string | null;
  location: string | null;
  type: string | null;
  salary: string | null;
  description: string | null;
  requirements: string | null;
  role_hook: string | null;
  responsibilities: string[] | null;
  fit_signals: string[] | null;
  process_note: string | null;
  publish_mode: string | null;
  public_dealer_name: string | null;
  public_location: string | null;
  confidential_note: string | null;
};

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
}

function getDealerDisplay(job: JobContext) {
  if (job.publish_mode === "confidential") return "Confidential Dealership";
  return job.public_dealer_name || "Jersey Village Chrysler Jeep Dodge Ram";
}

function getLocationDisplay(job: JobContext) {
  if (job.publish_mode === "confidential") return job.public_location || "Houston, TX Market";
  return job.public_location || job.location || "Dealership location";
}

async function uploadFile({
  bucket,
  file,
  folder,
}: {
  bucket: string;
  file: File | null;
  folder: string;
}) {
  if (!file || file.size <= 0) return null;

  const safeName = sanitizeFilename(file.name || "upload");
  const extension = safeName.includes(".") ? safeName.split(".").pop() : "bin";
  const filePath = `${folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error } = await supabaseAdmin.storage.from(bucket).upload(filePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(`${bucket} upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}

function scoreApplication(input: {
  job: JobContext;
  candidateName: string;
  coverNote: string;
  linkedin: string;
  resumeUrl: string;
}) {
  const jobText = [
    input.job.title,
    input.job.description,
    input.job.requirements,
    input.job.role_hook,
    ...(input.job.responsibilities || []),
    ...(input.job.fit_signals || []),
    input.job.process_note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const candidateText = [
    input.candidateName,
    input.coverNote,
    input.linkedin,
    input.resumeUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 45;
  const strengths: string[] = [];
  const gaps: string[] = [];

  const keywords = Array.from(
    new Set(
      jobText
        .split(/\s+/)
        .map((word) => word.replace(/[^a-z0-9]/g, ""))
        .filter((word) => word.length > 5)
    )
  ).slice(0, 60);

  const matches = keywords.filter((word) => candidateText.includes(word)).length;

  if (matches >= 10) {
    score += 20;
    strengths.push("Strong overlap with role-specific requirements.");
  } else if (matches >= 5) {
    score += 12;
    strengths.push("Some overlap with role-specific requirements.");
  } else {
    score -= 8;
    gaps.push("Limited visible overlap with role-specific requirements.");
  }

  if (candidateText.includes("automotive") || candidateText.includes("dealership")) {
    score += 12;
    strengths.push("Automotive or dealership experience indicated.");
  }

  if (candidateText.includes("sales") || candidateText.includes("customer")) {
    score += 8;
    strengths.push("Customer-facing or sales-related signal present.");
  }

  if (candidateText.includes("technician") || candidateText.includes("ase") || candidateText.includes("diagnostic")) {
    score += 12;
    strengths.push("Technical or certification-related signal present.");
  }

  if (candidateText.includes("available") || candidateText.includes("weekend") || candidateText.includes("full-time")) {
    score += 6;
    strengths.push("Availability signal present.");
  }

  if (!input.resumeUrl) {
    score -= 15;
    gaps.push("Resume was not provided.");
  }

  if (!input.coverNote && !input.linkedin && !input.resumeUrl) {
    score -= 20;
    gaps.push("Limited supporting information provided.");
  }

  const fitScore = Math.max(0, Math.min(100, score));
  let decision: ScreenDecision = "needs_review";

  if (fitScore >= 70) decision = "virtual_invited";
  if (fitScore < 45) decision = "not_fit";

  return {
    fitScore,
    decision,
    strengths,
    gaps,
    screeningSummary:
      decision === "virtual_invited"
        ? "Candidate appears aligned with the job post and is ready for a virtual screening interview."
        : decision === "not_fit"
          ? "Candidate does not appear to match the current role based on available application information."
          : "Candidate shows partial alignment and should be reviewed before an interview invitation.",
    decisionReason:
      decision === "virtual_invited"
        ? "Sufficient application signals matched the stored job post."
        : decision === "not_fit"
          ? "Insufficient fit signals for the current role."
          : "Borderline fit requiring human review.",
  };
}

function buildVirtualInterviewLink(applicationId: string) {
  const base = process.env.NATA_VIRTUAL_INTERVIEW_URL || process.env.NEXT_PUBLIC_APP_URL || "https://natatoday.vercel.app";
  if (base.includes("?")) return `${base}&application=${applicationId}`;
  return `${base}?application=${applicationId}`;
}

async function sendCandidateEmail(input: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NATA_FROM_EMAIL || "Solace Recruiting <no-reply@natatoday.com>";

  if (!apiKey) {
    console.log("RESEND_API_KEY not set. Candidate email skipped:", input.subject);
    return { skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.body,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Candidate email failed:", detail);
    return { skipped: false, error: detail };
  }

  return { skipped: false };
}

function buildEmailForDecision(input: {
  candidateName: string;
  candidateEmail: string;
  job: JobContext;
  decision: ScreenDecision;
  virtualInterviewUrl: string | null;
}) {
  const dealerName = getDealerDisplay(input.job);
  const location = getLocationDisplay(input.job);
  const title = input.job.title || "the role";
  const firstName = input.candidateName.split(" ")[0] || "there";

  if (input.decision === "virtual_invited") {
    return {
      to: input.candidateEmail,
      subject: `Next step for ${title}`,
      body: `Hi ${firstName},\n\nThanks for applying for the ${title} role with ${dealerName} in ${location}.\n\nYour application looks like a potential fit, and we would like to invite you to complete a virtual screening interview.\n\nStart here:\n${input.virtualInterviewUrl}\n\nAfter the virtual screening, strong matches may be moved forward for dealership review and possible in-person interview.\n\nThank you,\nSolace Recruiting`,
    };
  }

  if (input.decision === "not_fit") {
    return {
      to: input.candidateEmail,
      subject: `Update on your ${title} application`,
      body: `Hi ${firstName},\n\nThank you for applying for the ${title} role. After reviewing the information provided, this role does not appear to be the strongest fit at this time.\n\nWe appreciate your interest and may keep your information in mind for future opportunities that better match your background.\n\nThank you,\nSolace Recruiting`,
    };
  }

  return {
    to: input.candidateEmail,
    subject: `Application received for ${title}`,
    body: `Hi ${firstName},\n\nThanks for applying for the ${title} role with ${dealerName}. Your application has been received and is being reviewed.\n\nIf your background matches the next step, you’ll hear from us with additional instructions.\n\nThank you,\nSolace Recruiting`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const jobId = clean(formData.get("job_id"));
    const name = clean(formData.get("name"));
    const email = clean(formData.get("email"));
    const phone = clean(formData.get("phone"));
    const linkedin = clean(formData.get("linkedin"));
    const coverNote = clean(formData.get("cover_note"));

    if (!jobId) {
      return NextResponse.json({ error: "Job is required." }, { status: 400 });
    }

    if (!name || !email || !phone) {
      return NextResponse.json(
        { error: "Name, email, and phone are required." },
        { status: 400 }
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select(
        "id,dealer_id,title,slug,dealer_slug,location,type,salary,description,requirements,role_hook,responsibilities,fit_signals,process_note,publish_mode,public_dealer_name,public_location,confidential_note,is_active,publish_status"
      )
      .eq("id", jobId)
      .eq("is_active", true)
      .eq("publish_status", "published")
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    let dealerAssignedRecruiter: { id: string; name: string | null } | null = null;

    if ((job as JobContext).dealer_id) {
      const { data: dealer } = await supabaseAdmin
        .schema("nata")
        .from("dealers")
        .select("assigned_recruiter_id")
        .eq("id", (job as JobContext).dealer_id)
        .maybeSingle();

      if (dealer?.assigned_recruiter_id) {
        const { data: recruiter } = await supabaseAdmin
          .schema("nata")
          .from("recruiters")
          .select("id,name,status,is_active")
          .eq("id", dealer.assigned_recruiter_id)
          .maybeSingle();

        if (
          recruiter &&
          recruiter.is_active !== false &&
          recruiter.status !== "suspended" &&
          recruiter.status !== "inactive" &&
          recruiter.status !== "invited"
        ) {
          dealerAssignedRecruiter = {
            id: recruiter.id,
            name: recruiter.name || null,
          };
        }
      }
    }

    const folder = `${job.slug || job.id}/${email.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const profilePhoto = formData.get("profile_photo") instanceof File ? (formData.get("profile_photo") as File) : null;
    const resume = formData.get("resume") instanceof File ? (formData.get("resume") as File) : null;

    const profilePhotoUrl = await uploadFile({
      bucket: "candidate-photos",
      file: profilePhoto,
      folder,
    });

    const resumeUrl = await uploadFile({
      bucket: "candidate-resumes",
      file: resume,
      folder,
    });

    const initialScreen = scoreApplication({
      job: job as JobContext,
      candidateName: name,
      coverNote,
      linkedin,
      resumeUrl: resumeUrl || "",
    });

    const virtualInterviewUrl =
      initialScreen.decision === "virtual_invited" ? buildVirtualInterviewLink("pending") : null;

    const { data: application, error: applicationError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .insert({
        job_id: job.id,
        name,
        email,
        phone,
        linkedin: linkedin || null,
        cover_note: coverNote || null,
        resume_url: resumeUrl,
        profile_photo_url: profilePhotoUrl,
        status:
          initialScreen.decision === "virtual_invited"
            ? "virtual_invited"
            : initialScreen.decision === "not_fit"
              ? "not_fit"
              : "needs_review",
        screening_status:
          initialScreen.decision === "virtual_invited"
            ? "virtual_invited"
            : initialScreen.decision === "not_fit"
              ? "not_fit"
              : "needs_review",
        fit_score: initialScreen.fitScore,
        screening_summary: initialScreen.screeningSummary,
        decision_reason: initialScreen.decisionReason,
        virtual_interview_url: virtualInterviewUrl,
        recruiter_id: dealerAssignedRecruiter?.id || null,
        assigned_recruiter: dealerAssignedRecruiter?.name || null,
      })
      .select("*")
      .single();

    if (applicationError || !application) {
      return NextResponse.json(
        { error: applicationError?.message || "Application insert failed." },
        { status: 500 }
      );
    }

    let finalVirtualInterviewUrl = virtualInterviewUrl;

    if (initialScreen.decision === "virtual_invited") {
      finalVirtualInterviewUrl = buildVirtualInterviewLink(application.id);

      await supabaseAdmin
        .schema("nata")
        .from("applications")
        .update({ virtual_interview_url: finalVirtualInterviewUrl })
        .eq("id", application.id);
    }

    const candidateEmail = buildEmailForDecision({
      candidateName: name,
      candidateEmail: email,
      job: job as JobContext,
      decision: initialScreen.decision,
      virtualInterviewUrl: finalVirtualInterviewUrl,
    });

    await sendCandidateEmail(candidateEmail);

    return NextResponse.redirect(
      new URL(`/careers/${job.slug}?submitted=1`, request.url),
      { status: 303 }
    );
  } catch (error) {
    console.error("Application submit error:", error);
    return NextResponse.json(
      { error: "Application submit failed." },
      { status: 500 }
    );
  }
}
