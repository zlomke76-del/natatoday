import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sendBookingConfirmation } from "../../../../lib/nataNotifications";

type AnyRow = Record<string, any>;

type PageProps = {
  params: {
    applicationId: string;
  };
  searchParams?: {
    booked?: string;
  };
};

type Slot = {
  label: string;
  value: string;
  startsAt: string;
  endsAt: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const SLOT_MINUTES = 15;
const LOOKAHEAD_DAYS = 21;

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function label(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getWeekStartSunday(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - copy.getDay());
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getTimeParts(time: string) {
  const [hour, minute] = time.slice(0, 5).split(":").map((part) => Number(part));
  return {
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function getTimezoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return asUtc - date.getTime();
}

function zonedTimeToUtc(dateString: string, timeString: string, timeZone: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const { hour, minute } = getTimeParts(timeString);

  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimezoneOffsetMs(guess, timeZone);

  return new Date(guess.getTime() - offset);
}

function formatSlotLabel(startsAt: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(startsAt);
}

function overlaps(start: Date, end: Date, ranges: { startsAt: Date; endsAt: Date }[]) {
  return ranges.some((range) => start < range.endsAt && end > range.startsAt);
}

async function loadApplication(applicationId: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load application:", error);
  }

  return data as AnyRow | null;
}

async function loadJob(jobId: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    console.error("Failed to load job:", error);
  }

  return data as AnyRow | null;
}

async function loadRecruiter(recruiterId: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("id", recruiterId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recruiter:", error);
  }

  return data as AnyRow | null;
}

async function loadAvailability(recruiterId: string, weekStarts: string[]) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiter_weekly_availability")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .in("week_start", weekStarts)
    .eq("is_available", true);

  if (error) {
    console.error("Failed to load recruiter availability:", error);
  }

  return (data || []) as AnyRow[];
}

async function loadExistingRanges(recruiterId: string) {
  const now = new Date();
  const later = addDays(now, LOOKAHEAD_DAYS + 1);

  const { data: bookingsData } = await supabaseAdmin
    .schema("nata")
    .from("interview_bookings")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .neq("status", "canceled")
    .gte("starts_at", now.toISOString())
    .lte("starts_at", later.toISOString());

  const { data: blackoutsData } = await supabaseAdmin
    .schema("nata")
    .from("recruiter_blackouts")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .lte("starts_at", later.toISOString())
    .gte("ends_at", now.toISOString());

  const bookingRanges = (bookingsData || [])
    .filter((item) => item.starts_at && item.ends_at)
    .map((item) => ({
      startsAt: new Date(item.starts_at),
      endsAt: new Date(item.ends_at),
    }));

  const blackoutRanges = (blackoutsData || [])
    .filter((item) => item.starts_at && item.ends_at)
    .map((item) => ({
      startsAt: new Date(item.starts_at),
      endsAt: new Date(item.ends_at),
    }));

  return [...bookingRanges, ...blackoutRanges];
}

function buildSlots({
  availabilityRows,
  ranges,
  recruiterTimezone,
}: {
  availabilityRows: AnyRow[];
  ranges: { startsAt: Date; endsAt: Date }[];
  recruiterTimezone: string;
}) {
  const now = new Date();
  const earliest = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const slots: Slot[] = [];

  for (let dayOffset = 0; dayOffset < LOOKAHEAD_DAYS; dayOffset += 1) {
    const current = addDays(now, dayOffset);
    const key = dateKey(current);
    const weekStart = getWeekStartSunday(current);
    const dayOfWeek = current.getDay();

    const row = availabilityRows.find(
      (item) =>
        String(item.week_start).slice(0, 10) === weekStart &&
        Number(item.day_of_week) === dayOfWeek
    );

    if (!row || row.is_available === false || !row.start_time || !row.end_time) {
      continue;
    }

    const timezone = label(row.timezone, recruiterTimezone);
    const availabilityStart = zonedTimeToUtc(key, String(row.start_time), timezone);
    const availabilityEnd = zonedTimeToUtc(key, String(row.end_time), timezone);

    let cursor = new Date(availabilityStart);

    while (cursor < availabilityEnd) {
      const slotEnd = new Date(cursor.getTime() + SLOT_MINUTES * 60 * 1000);

      if (slotEnd > availabilityEnd) break;

      if (cursor > earliest && !overlaps(cursor, slotEnd, ranges)) {
        slots.push({
          label: formatSlotLabel(cursor, timezone),
          value: cursor.toISOString(),
          startsAt: cursor.toISOString(),
          endsAt: slotEnd.toISOString(),
        });
      }

      cursor = new Date(cursor.getTime() + SLOT_MINUTES * 60 * 1000);
    }
  }

  return slots.slice(0, 40);
}

export default async function CandidateSchedulePage({
  params,
  searchParams,
}: PageProps) {
  noStore();

  const application = await loadApplication(params.applicationId);

  if (!application) {
    return (
      <main className="shell">
        <Nav />
        <section style={wrap}>
          <div className="eyebrow">Interview Scheduling</div>
          <h1>Application not found.</h1>
          <p style={muted}>This scheduling link is no longer valid.</p>
        </section>
      </main>
    );
  }

  const job = application.job_id ? await loadJob(String(application.job_id)) : null;
  const recruiter = application.recruiter_id
    ? await loadRecruiter(String(application.recruiter_id))
    : null;

  if (!recruiter) {
    return (
      <main className="shell">
        <Nav />
        <section style={wrap}>
          <div className="eyebrow">Interview Scheduling</div>
          <h1>Recruiter unavailable.</h1>
          <p style={muted}>
            This application does not currently have an active recruiter assigned.
          </p>
        </section>
      </main>
    );
  }

  const recruiterTimezone = label(recruiter.timezone, "America/Chicago");
  const today = new Date();
  const weekStarts = Array.from(
    new Set(
      Array.from({ length: 4 }).map((_, index) =>
        getWeekStartSunday(addDays(today, index * 7))
      )
    )
  );

  const availabilityRows = await loadAvailability(String(recruiter.id), weekStarts);
  const ranges = await loadExistingRanges(String(recruiter.id));
  const slots = buildSlots({ availabilityRows, ranges, recruiterTimezone });

  const roleTitle = label(job?.title || application.role, "this role");
  const dealerName = label(job?.public_dealer_name || job?.dealer_slug, "the dealership");
  const booked = searchParams?.booked === "1";

  async function bookInterview(formData: FormData) {
    "use server";

    const applicationId = clean(formData.get("application_id"));
    const selectedStart = clean(formData.get("slot"));
    const recruiterId = clean(formData.get("recruiter_id"));
    const recruiterTimezone = clean(formData.get("timezone")) || "America/Chicago";

    if (!applicationId || !selectedStart || !recruiterId) {
      throw new Error("Missing interview booking details.");
    }

    const startsAt = new Date(selectedStart);
    const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60 * 1000);
    const bookingToken =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${applicationId}-${Date.now()}`;

    const { data: currentApplication, error: currentApplicationError } =
      await supabaseAdmin
        .schema("nata")
        .from("applications")
        .select("*")
        .eq("id", applicationId)
        .maybeSingle();

    if (currentApplicationError) throw new Error(currentApplicationError.message);
    if (!currentApplication) throw new Error("Application not found.");

    const { data: currentJob } = await supabaseAdmin
      .schema("nata")
      .from("jobs")
      .select("*")
      .eq("id", currentApplication.job_id)
      .maybeSingle();

    const { data: currentRecruiter } = await supabaseAdmin
      .schema("nata")
      .from("recruiters")
      .select("*")
      .eq("id", recruiterId)
      .maybeSingle();

    const { data: conflicts, error: conflictError } = await supabaseAdmin
      .schema("nata")
      .from("interview_bookings")
      .select("id")
      .eq("recruiter_id", recruiterId)
      .neq("status", "canceled")
      .lt("starts_at", endsAt.toISOString())
      .gt("ends_at", startsAt.toISOString());

    if (conflictError) throw new Error(conflictError.message);

    if ((conflicts || []).length > 0) {
      throw new Error("That time was just booked. Please go back and choose another slot.");
    }

    const { error: bookingError } = await supabaseAdmin
      .schema("nata")
      .from("interview_bookings")
      .insert({
        application_id: applicationId,
        recruiter_id: recruiterId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        timezone: recruiterTimezone,
        status: "scheduled",
        booking_token: bookingToken,
        candidate_email: currentApplication.email || null,
        candidate_phone: currentApplication.phone || null,
      });

    if (bookingError) throw new Error(bookingError.message);

    const { error: applicationUpdateError } = await supabaseAdmin
      .schema("nata")
      .from("applications")
      .update({
        status: "virtual_scheduled",
        screening_status: "virtual_scheduled",
        virtual_interview_status: "scheduled",
        virtual_interview_at: startsAt.toISOString(),
        virtual_interview_url: `${appUrl()}/candidate/schedule/${applicationId}?booked=1`,
      })
      .eq("id", applicationId);

    if (applicationUpdateError) throw new Error(applicationUpdateError.message);

    try {
      await sendBookingConfirmation({
        candidateName: label(currentApplication.name || currentApplication.email, "Candidate"),
        candidateEmail: currentApplication.email || null,
        candidatePhone: currentApplication.phone || null,
        roleTitle: label(currentJob?.title || currentApplication.role, "this role"),
        dealerName: label(currentJob?.public_dealer_name || currentJob?.dealer_slug, "the dealership"),
        recruiterName: label(currentRecruiter?.name, "your recruiter"),
        scheduledLabel: formatSlotLabel(startsAt, recruiterTimezone),
      });
    } catch (notificationError) {
      console.error("Booking confirmation notification failed:", notificationError);
    }

    redirect(`/candidate/schedule/${applicationId}?booked=1`);
  }

  return (
    <main className="shell">
      <Nav />

      <section style={wrap}>
        <div className="eyebrow">NATA Today Interview Scheduling</div>

        {booked ? (
          <div style={successPanel}>
            <h1 style={title}>Interview confirmed.</h1>
            <p style={muted}>
              Your 15-minute virtual interview has been scheduled. You should also
              receive a confirmation by email and text if your contact information is available.
            </p>
          </div>
        ) : (
          <>
            <h1 style={title}>Choose your 15-minute virtual interview.</h1>
            <p style={muted}>
              {label(application.name, "Candidate")}, your application for{" "}
              <strong style={{ color: "#fff" }}>{roleTitle}</strong> with{" "}
              <strong style={{ color: "#fff" }}>{dealerName}</strong> has advanced.
              Choose one available time with {label(recruiter.name, "your recruiter")}.
            </p>

            <div style={summaryGrid}>
              <div style={summaryCard}>
                <span style={kicker}>Candidate</span>
                <strong>{label(application.name || application.email, "Candidate")}</strong>
              </div>
              <div style={summaryCard}>
                <span style={kicker}>Recruiter</span>
                <strong>{label(recruiter.name, "Recruiter")}</strong>
              </div>
              <div style={summaryCard}>
                <span style={kicker}>Timezone</span>
                <strong>{recruiterTimezone}</strong>
              </div>
            </div>

            <form action={bookInterview} style={panel}>
              <input type="hidden" name="application_id" value={String(application.id)} />
              <input type="hidden" name="recruiter_id" value={String(recruiter.id)} />
              <input type="hidden" name="timezone" value={recruiterTimezone} />

              <div style={slotGrid}>
                {slots.length > 0 ? (
                  slots.map((slot, index) => (
                    <label key={slot.value} style={slotCard}>
                      <input
                        type="radio"
                        name="slot"
                        value={slot.value}
                        required
                        defaultChecked={index === 0}
                        style={{ accentColor: "#1473ff" }}
                      />
                      <span>{slot.label}</span>
                    </label>
                  ))
                ) : (
                  <div style={emptyState}>
                    No interview slots are currently available. Please contact NATA Today
                    or check back after the recruiter updates availability.
                  </div>
                )}
              </div>

              {slots.length > 0 ? (
                <div style={submitRow}>
                  <span style={mutedSmall}>
                    This will reserve a 15-minute virtual interview and notify NATA Today.
                  </span>
                  <button type="submit" className="btn btn-primary" style={{ border: 0, cursor: "pointer" }}>
                    Confirm interview time
                  </button>
                </div>
              ) : null}
            </form>
          </>
        )}
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = {
  width: "min(1040px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "64px 0 96px",
};

const title: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: "clamp(44px, 6vw, 72px)",
  lineHeight: 0.95,
};

const muted: React.CSSProperties = {
  color: "#cfe2ff",
  lineHeight: 1.6,
  maxWidth: 820,
};

const mutedSmall: React.CSSProperties = {
  color: "#9fb4d6",
  lineHeight: 1.5,
  fontSize: 14,
};

const kicker: React.CSSProperties = {
  display: "block",
  color: "#fbbf24",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: ".14em",
  textTransform: "uppercase",
  marginBottom: 8,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  marginTop: 28,
};

const summaryCard: React.CSSProperties = {
  padding: 18,
  borderRadius: 20,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const panel: React.CSSProperties = {
  marginTop: 26,
  padding: 24,
  borderRadius: 28,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
};

const slotGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const slotCard: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 16,
  borderRadius: 18,
  background: "rgba(3,10,20,0.35)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#e8f2ff",
  fontWeight: 850,
};

const submitRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  flexWrap: "wrap",
  marginTop: 22,
};

const emptyState: React.CSSProperties = {
  gridColumn: "1 / -1",
  padding: 22,
  borderRadius: 20,
  background: "rgba(251,191,36,0.08)",
  border: "1px solid rgba(251,191,36,0.22)",
  color: "#fde68a",
  lineHeight: 1.5,
};

const successPanel: React.CSSProperties = {
  padding: 34,
  borderRadius: 30,
  background: "linear-gradient(145deg, rgba(34,197,94,0.12), rgba(255,255,255,0.045))",
  border: "1px solid rgba(34,197,94,0.26)",
};
