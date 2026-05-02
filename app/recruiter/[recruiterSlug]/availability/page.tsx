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

type AvailabilityBlock = {
  blockIndex: number;
  isAvailable: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
  note: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const MAX_BLOCKS_PER_DAY = 3;

const days = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
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

const timeSlots = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
];

const defaultWeekdayBlocks = [
  { startTime: "09:00", endTime: "12:00", note: "Morning interview block" },
  { startTime: "13:00", endTime: "17:00", note: "Afternoon interview block" },
  { startTime: "", endTime: "", note: "" },
];

const defaultWeekendBlocks = [
  { startTime: "10:00", endTime: "14:00", note: "Limited weekend availability" },
  { startTime: "", endTime: "", note: "" },
  { startTime: "", endTime: "", note: "" },
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

function formatDayNumber(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));
  } catch {
    return dateString.slice(-2);
  }
}

function formatMonthDay(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));
  } catch {
    return dateString;
  }
}

function formatTime(value: string) {
  if (!value) return "";

  const [hourRaw, minuteRaw] = value.slice(0, 5).split(":");
  const hour = Number(hourRaw);
  const minute = minuteRaw || "00";

  if (Number.isNaN(hour)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${minute} ${suffix}`;
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getAvailabilityBlocksForDay(
  rows: AnyRow[],
  day: number,
  timezone: string
): AvailabilityBlock[] {
  const dayRows = rows
    .filter((item) => Number(item.day_of_week) === day)
    .sort((a, b) => Number(a.block_index || 0) - Number(b.block_index || 0));

  const hasSavedAvailableRows = dayRows.some((row) => row.is_available !== false);

  if (dayRows.length > 0) {
    const normalized = Array.from({ length: MAX_BLOCKS_PER_DAY }).map((_, index) => {
      const row = dayRows.find((item) => Number(item.block_index || 0) === index);

      if (row) {
        return {
          blockIndex: index,
          isAvailable: row.is_available !== false,
          startTime: String(row.start_time || ""),
          endTime: String(row.end_time || ""),
          timezone: String(row.timezone || timezone),
          note: String(row.note || ""),
        };
      }

      return {
        blockIndex: index,
        isAvailable: false,
        startTime: "",
        endTime: "",
        timezone,
        note: "",
      };
    });

    if (!hasSavedAvailableRows) {
      return normalized.map((block) => ({ ...block, isAvailable: false }));
    }

    return normalized;
  }

  const defaults = day === 0 || day === 6 ? defaultWeekendBlocks : defaultWeekdayBlocks;

  return defaults.map((block, index) => ({
    blockIndex: index,
    isAvailable: index === 0 || (day !== 0 && day !== 6 && index === 1),
    startTime: block.startTime,
    endTime: block.endTime,
    timezone,
    note: block.note,
  }));
}

function getActiveBlocks(blocks: AvailabilityBlock[]) {
  return blocks.filter((block) => block.isAvailable && block.startTime && block.endTime);
}

function getSlotEventStyle(
  startTime: string,
  endTime: string,
  blockIndex: number
): React.CSSProperties {
  const startHour = Number(startTime.slice(0, 2));
  const startMinute = Number(startTime.slice(3, 5));
  const endHour = Number(endTime.slice(0, 2));
  const endMinute = Number(endTime.slice(3, 5));

  const normalizedStart = Number.isFinite(startHour)
    ? startHour + (startMinute || 0) / 60
    : 9;
  const normalizedEnd = Number.isFinite(endHour)
    ? endHour + (endMinute || 0) / 60
    : 17;
  const duration = Math.max(0.75, normalizedEnd - normalizedStart);

  return {
    top: `${Math.max(8, normalizedStart) * 72 - 8 * 72 + 10}px`,
    height: `${Math.max(64, duration * 72 - 12)}px`,
    left: `${10 + blockIndex * 4}px`,
    right: `${10 + (MAX_BLOCKS_PER_DAY - blockIndex - 1) * 4}px`,
    zIndex: 2 + blockIndex,
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
    .order("day_of_week", { ascending: true })
    .order("block_index", { ascending: true });

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
  const blocksByDay = days.reduce<Record<number, AvailabilityBlock[]>>((acc, day) => {
    acc[day.value] = getAvailabilityBlocksForDay(
      rows,
      day.value,
      recruiterTimezone
    );
    return acc;
  }, {});

  async function saveWeeklyAvailability(formData: FormData) {
    "use server";

    const recruiterId = clean(formData.get("recruiter_id"));
    const recruiterSlug = clean(formData.get("recruiter_slug"));
    const submittedWeekStart = clean(formData.get("week_start"));
    const submittedTimezone = clean(formData.get("timezone")) || "America/Chicago";

    if (!recruiterId || !recruiterSlug || !submittedWeekStart) {
      throw new Error("Missing recruiter availability context.");
    }

    const payload = days.flatMap((day) => {
      const blocks = Array.from({ length: MAX_BLOCKS_PER_DAY }).map((_, index) => {
        const available = clean(formData.get(`available_${day.value}_${index}`)) === "on";
        const startTime = clean(formData.get(`start_${day.value}_${index}`));
        const endTime = clean(formData.get(`end_${day.value}_${index}`));
        const note = clean(formData.get(`note_${day.value}_${index}`));

        return {
          recruiter_id: recruiterId,
          week_start: submittedWeekStart,
          day_of_week: day.value,
          block_index: index,
          start_time: available ? startTime || null : null,
          end_time: available ? endTime || null : null,
          timezone: submittedTimezone,
          is_available: available && Boolean(startTime) && Boolean(endTime),
          note: note || null,
          updated_at: new Date().toISOString(),
        };
      });

      const hasAvailableBlock = blocks.some((block) => block.is_available);

      if (hasAvailableBlock) {
        return blocks.filter((block) => block.is_available);
      }

      return [
        {
          recruiter_id: recruiterId,
          week_start: submittedWeekStart,
          day_of_week: day.value,
          block_index: 0,
          start_time: null,
          end_time: null,
          timezone: submittedTimezone,
          is_available: false,
          note: null,
          updated_at: new Date().toISOString(),
        },
      ];
    });

    const { error: deleteError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_weekly_availability")
      .delete()
      .eq("recruiter_id", recruiterId)
      .eq("week_start", submittedWeekStart);

    if (deleteError) {
      console.error("Failed to clear recruiter weekly availability:", deleteError);
      throw new Error("Availability could not be saved.");
    }

    const { error: insertError } = await supabaseAdmin
      .schema("nata")
      .from("recruiter_weekly_availability")
      .insert(payload);

    if (insertError) {
      console.error("Failed to save recruiter weekly availability:", insertError);
      throw new Error("Availability could not be saved.");
    }

    redirect(
      `/recruiter/${recruiterSlug}/availability?week=${submittedWeekStart}&saved=1`
    );
  }

  const weekEnd = addDays(weekStart, 6);
  const availableCount = days.filter((day) => {
    return getActiveBlocks(blocksByDay[day.value] || []).length > 0;
  }).length;

  const totalBlockCount = days.reduce((count, day) => {
    return count + getActiveBlocks(blocksByDay[day.value] || []).length;
  }, 0);

  return (
    <main className="shell">
      <Nav />

      <section style={wrap}>
        <div style={headerRow}>
          <div>
            <div className="eyebrow">Recruiter Availability</div>
            <h1 style={title}>{recruiter.name} — Calendar</h1>
            <p style={muted}>
              Manage interview availability in a weekly calendar view. Add multiple
              blocks per day for split schedules, lunch breaks, evening availability,
              or limited weekend windows.
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

        <form action={saveWeeklyAvailability} style={calendarPanel}>
          <input type="hidden" name="recruiter_id" value={String(recruiter.id)} />
          <input type="hidden" name="recruiter_slug" value={params.recruiterSlug} />
          <input type="hidden" name="week_start" value={weekStart} />

          <div style={calendarTopbar}>
            <div style={calendarNavigation}>
              <a
                href={`/recruiter/${params.recruiterSlug}/availability?week=${previousWeek}`}
                style={calendarNavButton}
              >
                ‹
              </a>

              <div>
                <span style={kicker}>Week view</span>
                <strong style={weekTitle}>
                  {formatMonthDay(weekStart)} – {formatMonthDay(weekEnd)}
                </strong>
              </div>

              <a
                href={`/recruiter/${params.recruiterSlug}/availability?week=${nextWeek}`}
                style={calendarNavButton}
              >
                ›
              </a>
            </div>

            <div style={toolbarRight}>
              <div style={miniStat}>
                <strong>{availableCount}/7</strong>
                <span>days open</span>
              </div>

              <div style={miniStat}>
                <strong>{totalBlockCount}</strong>
                <span>active blocks</span>
              </div>

              <label style={timezoneField}>
                <span style={labelStyle}>Timezone</span>
                <select name="timezone" defaultValue={recruiterTimezone} style={toolbarSelect}>
                  {timezones.map((timezone) => (
                    <option key={timezone} value={timezone}>
                      {timezone}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ border: 0, cursor: "pointer", minHeight: 46 }}
              >
                Save schedule
              </button>
            </div>
          </div>

          <div style={calendarMetaRow}>
            <div>
              <strong>Weekly interview availability</strong>
              <span>
                Each day supports up to {MAX_BLOCKS_PER_DAY} separate availability blocks.
                Enable only the blocks you want candidates to see.
              </span>
            </div>

            <div style={legend}>
              <span style={legendAvailable}>Available block</span>
              <span style={legendClosed}>Disabled / unavailable</span>
            </div>
          </div>

          <div style={calendarScroll}>
            <div style={calendarGrid}>
              <div style={calendarCorner}>
                <span>Time</span>
              </div>

              {days.map((day) => {
                const date = addDays(weekStart, day.value);
                const activeBlocks = getActiveBlocks(blocksByDay[day.value] || []);

                return (
                  <div
                    key={day.value}
                    style={{
                      ...calendarDayHeader,
                      opacity: activeBlocks.length > 0 ? 1 : 0.62,
                    }}
                  >
                    <span>{day.short}</span>
                    <strong>{formatDayNumber(date)}</strong>
                    <small>{activeBlocks.length} block{activeBlocks.length === 1 ? "" : "s"}</small>
                  </div>
                );
              })}

              <div style={timeColumn}>
                {timeSlots.map((slot) => (
                  <div key={slot} style={timeSlotLabel}>
                    {formatTime(slot)}
                  </div>
                ))}
              </div>

              {days.map((day) => {
                const blocks = blocksByDay[day.value] || [];
                const activeBlocks = getActiveBlocks(blocks);
                const date = addDays(weekStart, day.value);

                return (
                  <div
                    key={day.value}
                    style={{
                      ...calendarDayColumn,
                      background: activeBlocks.length
                        ? "rgba(255,255,255,0.035)"
                        : "rgba(148,163,184,0.05)",
                    }}
                  >
                    {timeSlots.map((slot) => (
                      <div key={slot} style={calendarHourLine} />
                    ))}

                    {activeBlocks.length > 0 ? (
                      activeBlocks.map((block, renderIndex) => {
                        const startValue = block.startTime.slice(0, 5);
                        const endValue = block.endTime.slice(0, 5);

                        return (
                          <div
                            key={block.blockIndex}
                            style={{
                              ...availabilityBlock,
                              ...getSlotEventStyle(
                                startValue,
                                endValue,
                                Math.min(renderIndex, MAX_BLOCKS_PER_DAY - 1)
                              ),
                            }}
                          >
                            <div style={eventHeader}>
                              <strong>Available block {block.blockIndex + 1}</strong>
                              <span>{formatTime(startValue)} – {formatTime(endValue)}</span>
                            </div>

                            {block.note ? <p style={eventNote}>{block.note}</p> : null}
                          </div>
                        );
                      })
                    ) : (
                      <div style={closedBlock}>
                        <strong>Unavailable</strong>
                        <span>No candidate bookings</span>
                      </div>
                    )}

                    <div style={dayDateLabel}>{formatDisplayDate(date)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={blockEditor}>
            {days.map((day) => {
              const date = addDays(weekStart, day.value);
              const blocks = blocksByDay[day.value] || [];

              return (
                <article key={day.value} style={editorDayCard}>
                  <div style={editorDayHeader}>
                    <div>
                      <strong>{day.label}</strong>
                      <span>{formatDisplayDate(date)}</span>
                    </div>
                    <small>Enable up to {MAX_BLOCKS_PER_DAY} blocks</small>
                  </div>

                  <div style={editorBlockList}>
                    {Array.from({ length: MAX_BLOCKS_PER_DAY }).map((_, index) => {
                      const block = blocks[index] || {
                        blockIndex: index,
                        isAvailable: false,
                        startTime: "",
                        endTime: "",
                        timezone: recruiterTimezone,
                        note: "",
                      };

                      return (
                        <div key={index} style={editorBlock}>
                          <label style={togglePill}>
                            <input
                              type="checkbox"
                              name={`available_${day.value}_${index}`}
                              defaultChecked={block.isAvailable && Boolean(block.startTime) && Boolean(block.endTime)}
                              style={{ accentColor: "#1473ff" }}
                            />
                            <span>Block {index + 1}</span>
                          </label>

                          <label style={compactField}>
                            <span>Start</span>
                            <input
                              type="time"
                              name={`start_${day.value}_${index}`}
                              defaultValue={block.startTime.slice(0, 5)}
                              style={compactInput}
                            />
                          </label>

                          <label style={compactField}>
                            <span>End</span>
                            <input
                              type="time"
                              name={`end_${day.value}_${index}`}
                              defaultValue={block.endTime.slice(0, 5)}
                              style={compactInput}
                            />
                          </label>

                          <label style={compactFieldWide}>
                            <span>Note</span>
                            <input
                              name={`note_${day.value}_${index}`}
                              defaultValue={block.note}
                              placeholder="Optional note"
                              style={compactInput}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>

          <div style={submitRow}>
            <div style={mutedSmall}>
              Candidate-facing slots are generated from every active block, then reduced
              by bookings and blackouts before scheduling.
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
  width: "min(1320px, calc(100% - 40px))",
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

const kicker: React.CSSProperties = {
  display: "block",
  color: "#fbbf24",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: ".14em",
  textTransform: "uppercase",
};

const calendarPanel: React.CSSProperties = {
  marginTop: 34,
  overflow: "hidden",
  borderRadius: 30,
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "linear-gradient(180deg, rgba(15,23,42,0.94), rgba(7,16,31,0.96))",
  boxShadow: "0 28px 90px rgba(0,0,0,0.32)",
};

const calendarTopbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  padding: 22,
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.045)",
  flexWrap: "wrap",
};

const calendarNavigation: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
};

const calendarNavButton: React.CSSProperties = {
  width: 42,
  height: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.07)",
  color: "#fff",
  fontSize: 28,
  lineHeight: 1,
  fontWeight: 800,
};

const weekTitle: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  color: "#ffffff",
  fontSize: 24,
  letterSpacing: "-0.03em",
};

const toolbarRight: React.CSSProperties = {
  display: "flex",
  alignItems: "end",
  justifyContent: "flex-end",
  gap: 14,
  flexWrap: "wrap",
};

const miniStat: React.CSSProperties = {
  minHeight: 46,
  display: "grid",
  alignContent: "center",
  padding: "8px 14px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.13)",
  background: "rgba(255,255,255,0.06)",
};

const timezoneField: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 250,
};

const labelStyle: React.CSSProperties = {
  color: "#d7e8ff",
  fontSize: 13,
  fontWeight: 850,
};

const toolbarSelect: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#07101f",
  color: "#fff",
  padding: "0 13px",
  outline: "none",
};

const calendarMetaRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  padding: "18px 22px",
  borderBottom: "1px solid rgba(255,255,255,0.09)",
  color: "#dbeafe",
  flexWrap: "wrap",
};

const legend: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const legendAvailable: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 999,
  background: "rgba(20,115,255,0.18)",
  border: "1px solid rgba(96,165,250,0.32)",
  color: "#bfdbfe",
  fontSize: 12,
  fontWeight: 900,
};

const legendClosed: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 999,
  background: "rgba(148,163,184,0.1)",
  border: "1px solid rgba(148,163,184,0.18)",
  color: "#cbd5e1",
  fontSize: 12,
  fontWeight: 900,
};

const calendarScroll: React.CSSProperties = {
  overflowX: "auto",
};

const calendarGrid: React.CSSProperties = {
  minWidth: 1120,
  display: "grid",
  gridTemplateColumns: "86px repeat(7, minmax(138px, 1fr))",
  gridTemplateRows: "74px 792px",
};

const calendarCorner: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRight: "1px solid rgba(255,255,255,0.1)",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.035)",
  color: "#9fb4d6",
  fontSize: 13,
  fontWeight: 900,
};

const calendarDayHeader: React.CSSProperties = {
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: 4,
  borderRight: "1px solid rgba(255,255,255,0.1)",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#dbeafe",
};

const timeColumn: React.CSSProperties = {
  borderRight: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.025)",
};

const timeSlotLabel: React.CSSProperties = {
  height: 72,
  padding: "8px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.07)",
  color: "#8fa6ca",
  fontSize: 12,
  textAlign: "right",
};

const calendarDayColumn: React.CSSProperties = {
  position: "relative",
  minHeight: 792,
  borderRight: "1px solid rgba(255,255,255,0.08)",
};

const calendarHourLine: React.CSSProperties = {
  height: 72,
  borderBottom: "1px solid rgba(255,255,255,0.065)",
};

const availabilityBlock: React.CSSProperties = {
  position: "absolute",
  minHeight: 64,
  padding: 12,
  borderRadius: 18,
  border: "1px solid rgba(147,197,253,0.38)",
  background:
    "linear-gradient(180deg, rgba(20,115,255,0.9), rgba(7,87,201,0.86))",
  boxShadow: "0 18px 46px rgba(20,115,255,0.25)",
  color: "#ffffff",
  overflow: "hidden",
};

const eventHeader: React.CSSProperties = {
  display: "grid",
  gap: 3,
};

const eventNote: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.82)",
  fontSize: 12,
  lineHeight: 1.35,
};

const closedBlock: React.CSSProperties = {
  position: "absolute",
  left: 10,
  right: 10,
  top: 92,
  display: "grid",
  gap: 4,
  padding: 14,
  borderRadius: 18,
  border: "1px dashed rgba(148,163,184,0.24)",
  background: "rgba(148,163,184,0.08)",
  color: "#cbd5e1",
};

const dayDateLabel: React.CSSProperties = {
  position: "absolute",
  left: 10,
  right: 10,
  bottom: 10,
  color: "#8fa6ca",
  fontSize: 11,
};

const blockEditor: React.CSSProperties = {
  display: "grid",
  gap: 14,
  padding: 22,
  borderTop: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.025)",
};

const editorDayCard: React.CSSProperties = {
  padding: 18,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.28)",
};

const editorDayHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
  marginBottom: 14,
  color: "#ffffff",
};

const editorBlockList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const editorBlock: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "140px 120px 120px minmax(220px, 1fr)",
  gap: 10,
  alignItems: "end",
};

const togglePill: React.CSSProperties = {
  minHeight: 36,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  color: "#dbeafe",
  fontSize: 13,
  fontWeight: 850,
};

const compactField: React.CSSProperties = {
  display: "grid",
  gap: 5,
  fontSize: 11,
  fontWeight: 850,
  color: "rgba(255,255,255,0.84)",
};

const compactFieldWide: React.CSSProperties = {
  ...compactField,
};

const compactInput: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  minHeight: 36,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(7,16,31,0.78)",
  color: "#fff",
  padding: "0 10px",
  outline: "none",
};

const submitRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 18,
  padding: 22,
  borderTop: "1px solid rgba(255,255,255,0.09)",
  flexWrap: "wrap",
};
