import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import Nav from "../../../components/Nav";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type PageProps = {
  params: {
    recruiterSlug: string;
  };
  searchParams?: {
    week?: string;
    saved?: string;
  };
};

type AnyRow = Record<string, any>;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const days = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const timezones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

function getCurrentWeekStartSunday() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);

  return start.toISOString().slice(0, 10);
}

function getWeekStart(value: unknown) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return getCurrentWeekStartSunday();
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + amount);

  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));
  } catch {
    return dateString;
  }
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getAvailabilityForDay(rows: AnyRow[], day: number, timezone: string) {
  const row = rows.find((item) => Number(item.day_of_week) === day);

  if (row) {
    return {
      isAvailable: row.is_available !== false,
      startTime: String(row.start_time || ""),
      endTime: String(row.end_time || ""),
      timezone: String(row.timezone || timezone),
      note: String(row.note || ""),
    };
  }

  const isWeekend = day === 0 || day === 6;

  return {
    isAvailable: true,
    startTime: isWeekend ? "10:00" : "09:00",
    endTime: isWeekend ? "14:00" : "17:00",
    timezone,
    note: "",
  };
}

async function loadRecruiter(slug: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiters")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to load recruiter:", error);
  }

  return data as AnyRow | null;
}

async function loadWeeklyAvailability(recruiterId: string, weekStart: string) {
  const { data, error } = await supabaseAdmin
    .schema("nata")
    .from("recruiter_weekly_availability")
    .select("*")
    .eq("recruiter_id", recruiterId)
    .eq("week_start", weekStart)
    .order("day_of_week", { ascending: true });

  if (error) {
    console.error("Failed to load weekly availability:", error);
  }

  return (data || []) as AnyRow[];
}

export default async function RecruiterAvailabilityPage({
  params,
  searchParams,
}: PageProps) {
  noStore();

  const recruiter = await loadRecruiter(params.recruiterSlug);
  const weekStart = getWeekStart(searchParams?.week);
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  if (!recruiter) {
    return (
      <main className="shell">
        <Nav />
        <section style={wrap}>
          <div className="eyebrow">Recruiter Availability</div>
          <h1>Recruiter not found.</h1>
          <p style={muted}>
            This recruiter workspace does not exist or is inactive.
          </p>
        </section>
      </main>
    );
  }

  const rows = await loadWeeklyAvailability(String(recruiter.id), weekStart);
  const recruiterTimezone = String(
    rows[0]?.timezone || recruiter.timezone || "America/Chicago"
  );
  const saved = searchParams?.saved === "1";

  async function saveWeeklyAvailability(formData: FormData) {
    "use server";

    const recruiterId = clean(formData.get("recruiter_id"));
    const recruiterSlug = clean(formData.get("recruiter_slug"));
    const submittedWeekStart = clean(formData.get("week_start"));
    const submittedTimezone = clean(formData.get("timezone")) || "America/Chicago";

    if (!recruiterId || !recruiterSlug || !submittedWeekStart) {
      throw new Error("Missing recruiter availability context.");
    }

    const payload = days.map((day) => {
      const available = clean(formData.get(`available_${day.value}`)) === "on";
      const startTime = clean(formData.get(`start_${day.value}`));
      const endTime = clean(formData.get(`end_${day.value}`));
      const note = clean(formData.get(`note_${day.value}`));

      return {
        recruiter_id: recruiterId,
        week_start: submittedWeekStart,
        day_of_week: day.value,
        start_time: available ? startTime || null : null,
        end_time: available ? endTime || null : null,
        timezone: submittedTimezone,
        is_available: available,
        note: note || null,
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_weekly_availability")
      .upsert(payload, {
        onConflict: "recruiter_id,week_start,day_of_week",
      });

    if (error) {
      console.error("Failed to save recruiter weekly availability:", error);
      throw new Error("Availability could not be saved.");
    }

    redirect(
      `/recruiter/${recruiterSlug}/availability?week=${submittedWeekStart}&saved=1`
    );
  }

  return (
    <main className="shell">
      <Nav />

      <section style={wrap}>
        <div style={headerRow}>
          <div>
            <div className="eyebrow">Recruiter Availability</div>
            <h1 style={title}>{recruiter.name} — Weekly Schedule</h1>
            <p style={muted}>
              Control interview availability week by week. Candidates will only see valid
              15-minute slots after bookings and blackouts are removed.
            </p>
          </div>

          <a
            href={`/recruiter/${params.recruiterSlug}/dashboard`}
            className="btn btn-secondary"
          >
            Back to command center
          </a>
        </div>

        {saved ? (
          <div style={notice}>
            <strong>Availability saved.</strong>
            <span>This week’s schedule is ready for interview booking.</span>
          </div>
        ) : null}

        <div style={weekControls}>
          <a
            href={`/recruiter/${params.recruiterSlug}/availability?week=${previousWeek}`}
            className="btn btn-secondary"
          >
            Previous week
          </a>

          <div style={weekCenter}>
            <span style={kicker}>Week of</span>
            <strong>{formatDisplayDate(weekStart)}</strong>
          </div>

          <a
            href={`/recruiter/${params.recruiterSlug}/availability?week=${nextWeek}`}
            className="btn btn-secondary"
          >
            Next week
          </a>
        </div>

        <form action={saveWeeklyAvailability} style={panel}>
          <input type="hidden" name="recruiter_id" value={String(recruiter.id)} />
          <input type="hidden" name="recruiter_slug" value={params.recruiterSlug} />
          <input type="hidden" name="week_start" value={weekStart} />

          <div style={formTop}>
            <div>
              <span style={kicker}>Timezone</span>
              <p style={mutedSmall}>
                Availability is stored in the recruiter’s timezone. Bookings are stored
                as exact timestamps for safe conversion later.
              </p>
            </div>

            <label style={field}>
              <span style={labelStyle}>Recruiter timezone</span>
              <select name="timezone" defaultValue={recruiterTimezone} style={input}>
                {timezones.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={scheduleGrid}>
            {days.map((day) => {
              const value = getAvailabilityForDay(rows, day.value, recruiterTimezone);
              const date = addDays(weekStart, day.value);

              return (
                <article key={day.value} style={dayCard}>
                  <div style={dayHeader}>
                    <div>
                      <strong style={{ color: "#fff", fontSize: 20 }}>
                        {day.label}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          color: "#9fb4d6",
                          marginTop: 4,
                        }}
                      >
                        {formatDisplayDate(date)}
                      </span>
                    </div>

                    <label style={togglePill}>
                      <input
                        type="checkbox"
                        name={`available_${day.value}`}
                        defaultChecked={value.isAvailable}
                        style={{ accentColor: "#1473ff" }}
                      />
                      <span>Available</span>
                    </label>
                  </div>

                  <div style={timeGrid}>
                    <label style={field}>
                      <span style={labelStyle}>Start</span>
                      <input
                        type="time"
                        name={`start_${day.value}`}
                        defaultValue={value.startTime.slice(0, 5)}
                        style={input}
                      />
                    </label>

                    <label style={field}>
                      <span style={labelStyle}>End</span>
                      <input
                        type="time"
                        name={`end_${day.value}`}
                        defaultValue={value.endTime.slice(0, 5)}
                        style={input}
                      />
                    </label>
                  </div>

                  <label style={field}>
                    <span style={labelStyle}>Note</span>
                    <input
                      name={`note_${day.value}`}
                      defaultValue={value.note}
                      placeholder="Optional: limited slots, family event, early close..."
                      style={input}
                    />
                  </label>
                </article>
              );
            })}
          </div>

          <div style={submitRow}>
            <div style={mutedSmall}>
              Weekend availability is supported. Leave a day unavailable if the recruiter
              should not receive bookings.
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ border: 0, cursor: "pointer" }}
            >
              Save weekly availability
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = {
  width: "min(1180px, calc(100% - 40px))",
  margin: "0 auto",
  padding: "56px 0 92px",
};

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 22,
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  margin: 0,
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
  lineHeight: 1.55,
  margin: "8px 0 0",
  fontSize: 14,
};

const notice: React.CSSProperties = {
  marginTop: 24,
  padding: 18,
  borderRadius: 20,
  background: "rgba(34,197,94,0.11)",
  border: "1px solid rgba(34,197,94,0.24)",
  color: "#d1fae5",
  display: "grid",
  gap: 5,
};

const weekControls: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  marginTop: 34,
  flexWrap: "wrap",
};

const weekCenter: React.CSSProperties = {
  minWidth: 260,
  padding: 18,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  textAlign: "center",
};

const kicker: React.CSSProperties = {
  display: "block",
  color: "#fbbf24",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: ".14em",
  textTransform: "uppercase",
};

const panel: React.CSSProperties = {
  marginTop: 24,
  padding: 28,
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
};

const formTop: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(260px, .36fr)",
  gap: 18,
  alignItems: "end",
  marginBottom: 22,
};

const scheduleGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const dayCard: React.CSSProperties = {
  padding: 20,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.32)",
};

const dayHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  marginBottom: 16,
};

const togglePill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.055)",
  color: "#dbeafe",
  fontSize: 13,
  fontWeight: 850,
};

const timeGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 12,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: React.CSSProperties = {
  color: "#d7e8ff",
  fontSize: 13,
  fontWeight: 850,
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#07101f",
  color: "#fff",
  padding: "0 13px",
  outline: "none",
};

const submitRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  marginTop: 22,
  flexWrap: "wrap",
};
