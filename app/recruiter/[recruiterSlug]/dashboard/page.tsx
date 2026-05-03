import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { buildCandidateScheduleUrl, sendInterviewInvite } from "../../../../lib/nataNotifications";
import CommunicationsCenter from "./CommunicationsCenter";
import MusicLibraryPlayer from "./MusicLibraryPlayer";
import NataSoundStateBridge from "./NataSoundStateBridge";

type AnyRow = Record<string, any>;

type FitBand = {
  roleKey: string;
  interviewReady: number;
  review: number;
};

type QueueSurface = "candidate" | "interview";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type MusicTrack = {
  id: string;
  title: string;
  artist?: string;
  mood?: string;
  category?: string;
  url: string;
};

const MUSIC_BUCKET = "nata-music-library";

async function loadInitialMusicTracks(): Promise<MusicTrack[]> {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("music_tracks")
    .select("id,title,artist,mood,category,storage_bucket,storage_path,sort_order,created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load music tracks:", error);
    return [];
  }

  return (data || []).map((track) => {
    const bucket = String(track.storage_bucket || MUSIC_BUCKET);
    const path = String(track.storage_path || "");
    const { data: publicUrl } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);

    return {
      id: String(track.id),
      title: label(track.title, "Untitled track"),
      artist: label(track.artist, "NATA Today"),
      mood: label(track.mood, ""),
      category: label(track.category, "workspace"),
      url: publicUrl.publicUrl,
    };
  });
}

const ROLE_THRESHOLDS: Record<string, Omit<FitBand, "roleKey">> = {
  "sales consultant": { interviewReady: 80, review: 60 },
  "service advisor": { interviewReady: 82, review: 65 },
  "service technician": { interviewReady: 78, review: 60 },
  "bdc representative": { interviewReady: 76, review: 58 },
  "parts advisor": { interviewReady: 75, review: 58 },
  "finance manager": { interviewReady: 85, review: 70 },
};

function label(value: unknown, fallback = "Unassigned") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "Not scheduled";

  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Not scheduled";
  }
}

function cleanFormValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getRoleKey(roleTitle: string) {
  const normalized = roleTitle.toLowerCase();

  if (normalized.includes("sales")) return "sales consultant";
  if (normalized.includes("service") && normalized.includes("advisor")) return "service advisor";
  if (normalized.includes("technician") || normalized.includes("tech")) return "service technician";
  if (normalized.includes("bdc")) return "bdc representative";
  if (normalized.includes("parts")) return "parts advisor";
  if (normalized.includes("finance") || normalized.includes("f&i")) return "finance manager";

  return "sales consultant";
}

function getFitBand(roleTitle: string): FitBand {
  const roleKey = getRoleKey(roleTitle);
  return { roleKey, ...ROLE_THRESHOLDS[roleKey] };
}

function getFitDecision(score: number | null, roleTitle: string) {
  const band = getFitBand(roleTitle);
  const safeScore = typeof score === "number" ? score : null;

  if (safeScore === null) {
    return {
      band,
      label: "Not scored",
      tone: "muted",
      nextAction: "Screen candidate",
      canOpenStudio: false,
    };
  }

  if (safeScore >= band.interviewReady) {
    return {
      band,
      label: "Interview ready",
      tone: "ready",
      nextAction: "Open studio",
      canOpenStudio: true,
    };
  }

  if (safeScore >= band.review) {
    return {
      band,
      label: "Recruiter review",
      tone: "review",
      nextAction: "Review before interview",
      canOpenStudio: false,
    };
  }

  return {
    band,
    label: "Do not advance",
    tone: "blocked",
    nextAction: "Hold or pass candidate",
    canOpenStudio: false,
  };
}

function splitList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n|;|\|/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getFallbackVerification(roleTitle: string, score: number | null) {
  const roleKey = getRoleKey(roleTitle);
  const items = ["Confirm schedule and weekend availability.", "Confirm compensation alignment."];

  if (roleKey === "sales consultant") {
    items.unshift("Verify comfort with commission pressure, objection handling, and high-ticket closing.");
    items.unshift("Ask for measurable sales results: close rate, rank, revenue, or units sold.");
  }

  if (roleKey === "service technician") {
    items.unshift("Verify certifications, tools, diagnostic ability, and shop experience.");
  }

  if (roleKey === "service advisor") {
    items.unshift("Verify service-lane pressure, repair-order handling, and customer escalation ability.");
  }

  if (roleKey === "bdc representative") {
    items.unshift("Verify call volume, CRM notes, appointment setting, and text/email follow-up discipline.");
  }

  if (roleKey === "parts advisor") {
    items.unshift("Verify parts lookup, catalog, inventory, and counter experience.");
  }

  if (roleKey === "finance manager") {
    items.unshift("Verify F&I, lender, warranty, compliance, and menu presentation experience.");
  }

  if (typeof score === "number" && score < getFitBand(roleTitle).review) {
    items.push("Do not advance unless recruiter documents a clear override reason.");
  }

  return items.slice(0, 5);
}

function getFallbackCoaching(roleTitle: string) {
  const roleKey = getRoleKey(roleTitle);

  if (roleKey === "sales consultant") {
    return [
      "Add measurable sales outcomes such as rank, revenue, close rate, or units sold.",
      "Add high-ticket, commission, or automotive sales proof if available.",
      "Add examples of objection handling, follow-up discipline, and appointment setting.",
    ];
  }

  if (roleKey === "service technician") {
    return ["Add certifications, diagnostic examples, tool ownership, and repair categories handled."];
  }

  if (roleKey === "service advisor") {
    return ["Add repair-order, service-lane, customer escalation, and estimate-writing experience."];
  }

  if (roleKey === "bdc representative") {
    return ["Add call volume, appointment rate, CRM tools, and follow-up examples."];
  }

  if (roleKey === "parts advisor") {
    return ["Add parts lookup, inventory, catalog, OEM, and counter/customer examples."];
  }

  return ["Add role-specific proof, measurable outcomes, and dealership-relevant experience."];
}

function getResumeUrl(application: AnyRow) {
  return label(
    application.resume_url ||
      application.resume_public_url ||
      application.resume_path,
    ""
  );
}

function getProfilePhotoUrl(application: AnyRow) {
  return label(
    application.profile_photo_url ||
      application.photo_url ||
      application.candidate_photo_url,
    ""
  );
}

function getCandidateInitials(application: AnyRow) {
  const raw = label(application.name || application.email, "Candidate");
  const parts = raw
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return raw.slice(0, 2).toUpperCase();
}

function hasAnyState(app: AnyRow, states: string[]) {
  const values = [app.status, app.screening_status, app.virtual_interview_status]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return values.some((value) => states.includes(value));
}

function isPassedOrBlocked(app: AnyRow) {
  return hasAnyState(app, [
    "not_fit",
    "passed",
    "pass",
    "rejected",
    "blocked",
    "disqualified",
    "withdrawn",
  ]);
}

function isDealerScheduled(app: AnyRow) {
  return (
    hasAnyState(app, ["dealer_interview_scheduled"]) ||
    Boolean(app.dealer_interview_at && app.interview_packet_ready)
  );
}

function isPacketPending(app: AnyRow) {
  return Boolean(app.virtual_interview_completed_at && !app.interview_packet_ready);
}

function isInterviewToComplete(app: AnyRow) {
  if (app.virtual_interview_completed_at) return false;

  return hasAnyState(app, ["virtual_scheduled", "scheduled"]);
}

function isWaitingOnCandidate(app: AnyRow) {
  if (app.virtual_interview_completed_at) return false;
  if (isInterviewToComplete(app)) return false;

  return hasAnyState(app, ["virtual_invited", "invited"]);
}

function isCandidateQueueActionable(app: AnyRow) {
  if (isPassedOrBlocked(app)) return false;
  if (isDealerScheduled(app)) return false;
  if (isPacketPending(app)) return false;
  if (isInterviewToComplete(app)) return false;
  if (isWaitingOnCandidate(app)) return false;

  return hasAnyState(app, [
    "new",
    "submitted",
    "applied",
    "screened",
    "screening_complete",
    "needs_review",
    "ready_for_recruiter_decision",
    "review",
  ]);
}

function getNextAction(app: AnyRow, roleTitle: string) {
  if (isInterviewToComplete(app)) return "Complete virtual interview";
  if (isWaitingOnCandidate(app)) return "Waiting on candidate to schedule";
  if (isPacketPending(app)) return "Generate packet";
  if (isDealerScheduled(app)) return "Ready for dealer";
  if (isPassedOrBlocked(app)) return "Archived";

  const fit = getFitDecision(typeof app.fit_score === "number" ? app.fit_score : null, roleTitle);

  if (!fit.canOpenStudio) {
    return fit.nextAction;
  }

  return "Approve or open studio";
}

function getBadgeStyle(tone: string): React.CSSProperties {
  if (tone === "ready") return { background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)", color: "#86efac" };
  if (tone === "review") return { background: "rgba(251,191,36,0.14)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" };
  if (tone === "blocked") return { background: "rgba(248,113,113,0.14)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5" };
  return { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "#cfe2ff" };
}

function normalizeOperatorRole(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hasAdminAccess(recruiter: AnyRow) {
  const role = normalizeOperatorRole(recruiter.role);
  const permissions = recruiter.permissions && typeof recruiter.permissions === "object"
    ? recruiter.permissions
    : {};

  return (
    role === "admin" ||
    permissions.can_manage_team === true ||
    permissions.can_view_all === true
  );
}

export default async function RecruiterDashboard({
  params,
}: {
  params: { recruiterSlug: string };
}) {
  noStore();

  const { recruiterSlug } = params;

  const { data: recruiter, error: recruiterError } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", recruiterSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (recruiterError) {
    console.error("Failed to load recruiter:", recruiterError);
  }

  if (!recruiter) {
    return (
      <main className="shell">
        <Nav />
        <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "60px 0" }}>
          <div className="eyebrow">Recruiter Control Center</div>
          <h1>Recruiter not found.</h1>
          <p style={{ color: "#cfe2ff" }}>This recruiter workspace does not exist or is inactive.</p>
        </section>
      </main>
    );
  }

  async function approveForInterview(formData: FormData) {
    "use server";

    const applicationId = cleanFormValue(formData.get("application_id"));
    const reason =
      cleanFormValue(formData.get("reason")) ||
      "Recruiter approved candidate for virtual interview after review.";

    if (!applicationId) throw new Error("Application id is required.");

    const { data: application, error: applicationLoadError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id)
      .maybeSingle();

    if (applicationLoadError) throw new Error(applicationLoadError.message);
    if (!application) throw new Error("Application not found for this recruiter.");

    const { data: job } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .eq("id", application.job_id)
      .maybeSingle();

    const bookingUrl = buildCandidateScheduleUrl(applicationId);

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "virtual_invited",
        screening_status: "virtual_invited",
        virtual_interview_status: "invited",
        virtual_interview_url: bookingUrl,
        decision_reason: reason,
      })
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id);

    if (error) throw new Error(error.message);

    try {
      await sendInterviewInvite({
        applicationId,
        candidateName: label(application.name || application.email, "Candidate"),
        candidateEmail: application.email || null,
        candidatePhone: application.phone || null,
        roleTitle: label(job?.title || application.role, "Candidate"),
        dealerName: label(job?.public_dealer_name || job?.dealer_slug, "Dealer"),
        recruiterName: label(recruiter.name, "your recruiter"),
        bookingUrl,
      });
    } catch (notificationError) {
      console.error("Candidate invite notification failed:", notificationError);
    }

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  async function holdCandidate(formData: FormData) {
    "use server";

    const applicationId = cleanFormValue(formData.get("application_id"));
    const reason = cleanFormValue(formData.get("reason")) || "Recruiter hold: more candidate proof required before interview.";

    if (!applicationId) throw new Error("Application id is required.");

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "needs_review",
        screening_status: "needs_review",
        decision_reason: reason,
      })
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id);

    if (error) throw new Error(error.message);

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  async function passCandidate(formData: FormData) {
    "use server";

    const applicationId = cleanFormValue(formData.get("application_id"));
    const reason = cleanFormValue(formData.get("reason")) || "Recruiter passed candidate after role-specific review.";

    if (!applicationId) throw new Error("Application id is required.");

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "not_fit",
        screening_status: "not_fit",
        decision_reason: reason,
      })
      .eq("id", applicationId)
      .eq("recruiter_id", recruiter.id);

    if (error) throw new Error(error.message);

    redirect(`/recruiter/${recruiterSlug}/dashboard`);
  }

  const { data: jobsData, error: jobsError } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (jobsError) console.error("Failed to load jobs:", jobsError);

  const { data: applicationsData, error: applicationsError } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("recruiter_id", recruiter.id)
    .order("created_at", { ascending: false });

  if (applicationsError) console.error("Failed to load recruiter applications:", applicationsError);

  const jobs = (jobsData || []) as AnyRow[];
  const applications = (applicationsData || []) as AnyRow[];
  const canOpenAdmin = hasAdminAccess(recruiter);
  const musicTracks = await loadInitialMusicTracks();

  const openJobs = jobs.filter((job) => job.is_active !== false && !job.filled_at && job.publish_status !== "closed" && job.publish_status !== "filled");

  const interviewQueue = applications.filter(isInterviewToComplete);
  const candidateQueue = applications.filter(isCandidateQueueActionable);
  const waitingOnCandidate = applications.filter(isWaitingOnCandidate);
  const reviewRequired = candidateQueue.filter((app) => hasAnyState(app, ["needs_review", "review"]));
  const packetPending = applications.filter(isPacketPending);
  const dealerScheduled = applications.filter(isDealerScheduled);
  const blocked = applications.filter(isPassedOrBlocked);

  const dealers = Array.from(new Set(openJobs.map((job) => label(job.dealer_slug || job.public_dealer_name, "unknown-dealer")))).map((dealerSlug) => {
    const dealerJobs = openJobs.filter((job) => label(job.dealer_slug || job.public_dealer_name, "unknown-dealer") === dealerSlug);
    const dealerJobIds = new Set(dealerJobs.map((job) => job.id));
    const dealerApps = applications.filter((app) => dealerJobIds.has(app.job_id));
    const readyForDealer = dealerApps.filter(isDealerScheduled);
    const needsInterview = dealerApps.filter(isInterviewToComplete);
    const packetPendingForDealer = dealerApps.filter(isPacketPending);

    let priority = "Monitor";
    if (dealerJobs.length > 0 && readyForDealer.length === 0) priority = "High";
    if (dealerJobs.length > 0 && needsInterview.length > 0) priority = "Action";

    return {
      dealerSlug,
      dealerName: label(dealerJobs[0]?.public_dealer_name || dealerJobs[0]?.dealer_slug, dealerSlug),
      openJobs: dealerJobs.length,
      pipeline: dealerApps.length,
      needsInterview: needsInterview.length,
      packetPending: packetPendingForDealer.length,
      readyForDealer: readyForDealer.length,
      priority,
    };
  });

  function renderApplicationCard(application: AnyRow, surface: QueueSurface) {
    const job = jobs.find((item) => item.id === application.job_id);
    const roleTitle = label(job?.title || application.role, "Candidate");
    const fitScore = typeof application.fit_score === "number" ? application.fit_score : null;
    const fit = getFitDecision(fitScore, roleTitle);
    const verificationItems = splitList(application.interview_questions).length ? splitList(application.interview_questions) : getFallbackVerification(roleTitle, fitScore);
    const coachingItems = splitList(application.verification_items).length ? splitList(application.verification_items) : getFallbackCoaching(roleTitle);
    const nextAction = getNextAction(application, roleTitle);
    const canOpenStudio = surface === "interview" || fit.canOpenStudio;
    const resumeUrl = getResumeUrl(application);
    const profilePhotoUrl = getProfilePhotoUrl(application);

    return (
      <article key={application.id} style={candidateCard}>
        <div style={{ display: "grid", gridTemplateColumns: "104px minmax(0, 1fr) auto", gap: 18, alignItems: "start" }}>
          <div style={candidateMedia}>
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt={`${application.name || "Candidate"} profile`}
                style={candidatePhoto}
              />
            ) : (
              <div style={candidatePhotoFallback}>{getCandidateInitials(application)}</div>
            )}

            {resumeUrl ? (
              <a href={resumeUrl} target="_blank" rel="noreferrer" style={resumeButton}>
                View resume
              </a>
            ) : (
              <span style={resumeMissing}>No resume</span>
            )}
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: 24 }}>{application.name || application.email || "Candidate"}</h2>
            <p style={{ margin: "8px 0 0", color: "#cfe2ff" }}>{roleTitle} · {label(job?.public_dealer_name || job?.dealer_slug, "Dealer pending")}</p>
            <p style={{ margin: "10px 0 0", color: "#9fb1cc" }}>
              Status: {application.status || "new"} · Virtual: {application.virtual_interview_status || "not_scheduled"} · Packet: {application.interview_packet_ready ? "ready" : "not ready"} · Dealer: {formatDate(application.dealer_interview_at)}
            </p>
            <p style={{ margin: "10px 0 0", color: "#9fb1cc", fontSize: 13 }}>
              Email: {application.email || "Not provided"} · Phone: {application.phone || "Not provided"}
            </p>
          </div>
          <span style={{ ...scoreBadge, ...getBadgeStyle(fit.tone) }}>
            Solace Fit {fitScore === null ? "—" : `${fitScore}/100`}<br />{fit.label}
          </span>
        </div>

        <div style={supportGrid}>
          <div style={supportBox}>
            <strong style={{ color: "#fff" }}>Role threshold</strong>
            <p style={supportText}>
              {fit.band.roleKey}: interview ready {fit.band.interviewReady}+ · recruiter review {fit.band.review}-{fit.band.interviewReady - 1} · do not advance below {fit.band.review}.
            </p>
          </div>
          <div style={supportBox}>
            <strong style={{ color: "#fff" }}>Why this score</strong>
            <p style={supportText}>{application.screening_summary || "No screening summary has been generated yet."}</p>
            <p style={{ ...supportText, color: "#fbbf24" }}>Decision: {application.decision_reason || "No decision reason recorded."}</p>
          </div>
        </div>

        <div style={supportGrid}>
          <Checklist title="Recruiter verification" items={verificationItems} />
          <Checklist title="Candidate support notes" items={coachingItems} />
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "center" }}>
          <p style={{ margin: 0, color: "#fbbf24", fontWeight: 900 }}>Next action: {nextAction}</p>
          {canOpenStudio ? (
            <Link href={`/recruiter/${recruiterSlug}/interviews/${application.id}`} className="btn btn-primary">Open studio</Link>
          ) : (
            <span style={{ ...pill, ...getBadgeStyle(fit.tone) }}>Review required before studio</span>
          )}
        </div>

        {surface === "candidate" ? (
          <div style={actionPanel}>
            <form action={approveForInterview} style={actionForm}>
              <input type="hidden" name="application_id" value={String(application.id)} />
              <input name="reason" placeholder="Approval note" style={miniInput} />
              <button className="btn btn-primary" type="submit">Approve + send invite</button>
            </form>
            <form action={holdCandidate} style={actionForm}>
              <input type="hidden" name="application_id" value={String(application.id)} />
              <input name="reason" placeholder="What proof is missing?" style={miniInput} />
              <button className="btn btn-secondary" type="submit">Hold / request info</button>
            </form>
            <form action={passCandidate} style={actionForm}>
              <input type="hidden" name="application_id" value={String(application.id)} />
              <input name="reason" placeholder="Pass reason" style={miniInput} />
              <button className="btn btn-secondary" type="submit">Pass candidate</button>
            </form>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <main className="shell">
      <Nav />

      <section style={{ width: "min(1180px, calc(100% - 40px))", margin: "0 auto", padding: "60px 0" }}>
        <NataSoundStateBridge
          candidateQueue={candidateQueue.length}
          interviewQueue={interviewQueue.length}
          waitingOnCandidate={waitingOnCandidate.length}
          reviewRequired={reviewRequired.length}
          dealerScheduled={dealerScheduled.length}
          blocked={blocked.length}
        />

        <div className="eyebrow">Recruiter Control Center</div>

        <div style={headerRow}>
          <div>
            <h1 style={{ marginTop: 0 }}>{recruiter.name} — Operations Command Center</h1>
            <p style={{ color: "#cfe2ff", maxWidth: 860 }}>
              Daily visibility for dealer demand, role-specific scoring, recruiter review, candidate coaching, interview readiness, and dealer handoff status.
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {canOpenAdmin ? (
              <Link
                href="/recruiter/admin"
                className="btn btn-primary"
                style={{ whiteSpace: "nowrap" }}
              >
                Admin Control Layer →
              </Link>
            ) : null}

            <Link
              href={`/recruiter/${recruiterSlug}/candidate-pool`}
              className="btn btn-primary"
              style={{ whiteSpace: "nowrap" }}
            >
              Candidate Pool →
            </Link>

            <Link
              href={`/recruiter/${recruiterSlug}/availability`}
              className="btn btn-secondary"
              style={{ whiteSpace: "nowrap" }}
            >
              Manage availability
            </Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14, marginTop: 34 }}>
          {[
            ["Active clients", dealers.length],
            ["Open jobs", openJobs.length],
            ["Assigned", applications.length],
            ["Review", reviewRequired.length],
            ["Interviews", interviewQueue.length],
            ["Ready dealer", dealerScheduled.length],
          ].map(([title, value]) => (
            <div key={String(title)} style={metricCard}>
              <div style={{ color: "#9fb1cc", fontSize: 13 }}>{title}</div>
              <div style={{ fontSize: 34, fontWeight: 900, marginTop: 8 }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={noticeGrid}>
          <div style={noticeCard}>
            <strong>Waiting on candidate scheduling</strong>
            <span>{waitingOnCandidate.length}</span>
            <p>Approved candidates are hidden until they book a time.</p>
          </div>
          <div style={noticeCard}>
            <strong>Actionable candidate queue</strong>
            <span>{candidateQueue.length}</span>
            <p>Only candidates requiring recruiter decision are shown below.</p>
          </div>
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Dealer Priority Board</div>
        <div style={{ display: "grid", gap: 14 }}>
          {dealers.length === 0 ? (
            <EmptyState>No active dealer jobs are currently open.</EmptyState>
          ) : (
            dealers.map((dealer) => (
              <article key={dealer.dealerSlug} style={dealerRow}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 21 }}>{dealer.dealerName}</h2>
                  <p style={{ margin: "6px 0 0", color: "#9fb1cc" }}>{dealer.dealerSlug}</p>
                </div>
                <strong>{dealer.openJobs}</strong>
                <strong>{dealer.pipeline}</strong>
                <strong>{dealer.needsInterview}</strong>
                <strong>{dealer.packetPending}</strong>
                <span style={{ ...pill, background: dealer.priority === "Action" ? "#1473ff" : "rgba(255,255,255,0.08)" }}>{dealer.priority}</span>
              </article>
            ))
          )}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Today’s Work</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {[
            ["Needs review", reviewRequired.length],
            ["Interviews to complete", interviewQueue.length],
            ["Packets pending", packetPending.length],
            ["Passed / blocked", blocked.length],
          ].map(([title, value]) => (
            <div key={String(title)} style={workCard}>
              <div style={{ color: "#fbbf24", fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase", fontSize: 12 }}>{title}</div>
              <div style={{ fontSize: 42, fontWeight: 950, marginTop: 12 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Interviews to Complete</div>
        <div style={{ display: "grid", gap: 18 }}>
          {interviewQueue.length === 0 ? (
            <EmptyState>No scheduled virtual interviews require action right now.</EmptyState>
          ) : (
            interviewQueue.map((application) => renderApplicationCard(application, "interview"))
          )}
        </div>

        <div className="section-kicker" style={{ marginTop: 48 }}>Candidate Queue</div>
        <div style={{ display: "grid", gap: 18 }}>
          {candidateQueue.length === 0 ? (
            <EmptyState>No candidates require a recruiter decision right now. Approved candidates are hidden until they schedule, and passed candidates are archived.</EmptyState>
          ) : (
            candidateQueue.map((application) => renderApplicationCard(application, "candidate"))
          )}
        </div>

        <MusicLibraryPlayer tracks={musicTracks} />

        <div className="section-kicker" style={{ marginTop: 48 }}>Communications</div>
        <CommunicationsCenter
          recruiter={recruiter}
          recruiterSlug={recruiterSlug}
          applications={applications}
        />
      </section>
    </main>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={supportBox}>
      <strong style={{ color: "#fff" }}>{title}</strong>
      <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#bfd6f5", lineHeight: 1.5, fontSize: 13 }}>
        {items.slice(0, 5).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 24, borderRadius: 20, background: "rgba(255,255,255,0.05)", color: "#cfe2ff" }}>{children}</div>;
}

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  flexWrap: "wrap",
};

const noticeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginTop: 18,
};

const noticeCard: React.CSSProperties = {
  display: "grid",
  gap: 6,
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(96,165,250,0.18)",
  background: "rgba(37,99,235,0.08)",
  color: "#dbeafe",
};

const metricCard: React.CSSProperties = { padding: 20, borderRadius: 20, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" };
const dealerRow: React.CSSProperties = { padding: 22, borderRadius: 22, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", display: "grid", gridTemplateColumns: "1.4fr repeat(5, .7fr)", gap: 14, alignItems: "center" };
const workCard: React.CSSProperties = { padding: 24, borderRadius: 22, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" };
const candidateCard: React.CSSProperties = { padding: 24, borderRadius: 24, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" };
const candidateMedia: React.CSSProperties = { display: "grid", gap: 10, justifyItems: "center" };
const candidatePhoto: React.CSSProperties = { width: 92, height: 92, borderRadius: 22, objectFit: "cover", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)" };
const candidatePhotoFallback: React.CSSProperties = { width: 92, height: 92, borderRadius: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(20,115,255,0.18)", color: "#dbeafe", fontSize: 26, fontWeight: 950 };
const resumeButton: React.CSSProperties = { width: "100%", minHeight: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(20,115,255,0.16)", border: "1px solid rgba(96,165,250,0.26)", color: "#bfdbfe", fontSize: 12, fontWeight: 900, textDecoration: "none" };
const resumeMissing: React.CSSProperties = { width: "100%", minHeight: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 999, background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.22)", color: "#fca5a5", fontSize: 12, fontWeight: 900 };
const supportGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 16 };
const supportBox: React.CSSProperties = { padding: 15, borderRadius: 18, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(3,10,20,0.34)" };
const supportText: React.CSSProperties = { margin: "8px 0 0", color: "#bfd6f5", lineHeight: 1.5, fontSize: 13, whiteSpace: "pre-line" };
const scoreBadge: React.CSSProperties = { display: "inline-flex", justifyContent: "center", alignItems: "center", minWidth: 154, minHeight: 54, padding: "8px 14px", borderRadius: 999, fontWeight: 950, fontSize: 12, textAlign: "center", lineHeight: 1.3 };
const pill: React.CSSProperties = { display: "inline-flex", justifyContent: "center", padding: "8px 12px", borderRadius: 999, fontWeight: 900, color: "#fff" };
const actionPanel: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" };
const actionForm: React.CSSProperties = { display: "grid", gap: 8 };
const miniInput: React.CSSProperties = { minHeight: 42, borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(3,7,18,0.8)", color: "#fff", padding: "0 12px", outline: "none" };
