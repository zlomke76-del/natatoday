"use client";

import { useMemo, useState, useTransition } from "react";

type AnyRow = Record<string, any>;

type RecruiterPayload = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

type AvailabilityBlock = {
  id: string;
  dayOfWeek: number;
  blockIndex: number;
  startTime: string;
  endTime: string;
  note: string;
  isAvailable: boolean;
};

type ScheduledInterview = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  title: string;
  subtitle: string;
  status: string;
  meetingUrl: string;
};

type CalendarHoliday = {
  id: string;
  date: string;
  dayOfWeek: number;
  title: string;
  subtitle: string;
  kind: "federal" | "birthday";
};

type Props = {
  recruiter: RecruiterPayload;
  rows: AnyRow[];
  scheduledInterviews: AnyRow[];
  weekStart: string;
  previousWeek: string;
  nextWeek: string;
  saved: boolean;
  saveWeeklyAvailability: (formData: FormData) => void | Promise<void>;
};

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

function formatDayNumber(dateString: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));
  } catch {
    return dateString.slice(-2);
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

function makeBlockId(dayOfWeek: number, blockIndex: number) {
  return `${dayOfWeek}-${blockIndex}`;
}

function getDefaultBlocks(dayOfWeek: number): AvailabilityBlock[] {
  const weekend = dayOfWeek === 0 || dayOfWeek === 6;

  if (weekend) {
    return [
      {
        id: makeBlockId(dayOfWeek, 0),
        dayOfWeek,
        blockIndex: 0,
        startTime: "10:00",
        endTime: "14:00",
        note: "Limited weekend availability",
        isAvailable: true,
      },
    ];
  }

  return [
    {
      id: makeBlockId(dayOfWeek, 0),
      dayOfWeek,
      blockIndex: 0,
      startTime: "09:00",
      endTime: "12:00",
      note: "Morning interview block",
      isAvailable: true,
    },
    {
      id: makeBlockId(dayOfWeek, 1),
      dayOfWeek,
      blockIndex: 1,
      startTime: "13:00",
      endTime: "17:00",
      note: "Afternoon interview block",
      isAvailable: true,
    },
  ];
}

function buildInitialBlocks(rows: AnyRow[]): AvailabilityBlock[] {
  const blocks: AvailabilityBlock[] = [];

  for (const day of days) {
    const dayRows = rows
      .filter((row) => Number(row.day_of_week) === day.value)
      .sort((a, b) => Number(a.block_index || 0) - Number(b.block_index || 0));

    const activeRows = dayRows.filter((row) => row.is_available !== false);

    if (dayRows.length === 0) {
      blocks.push(...getDefaultBlocks(day.value));
      continue;
    }

    if (activeRows.length === 0) {
      continue;
    }

    activeRows.forEach((row, index) => {
      blocks.push({
        id: makeBlockId(day.value, index),
        dayOfWeek: day.value,
        blockIndex: index,
        startTime: String(row.start_time || "").slice(0, 5),
        endTime: String(row.end_time || "").slice(0, 5),
        note: String(row.note || ""),
        isAvailable: true,
      });
    });
  }

  return blocks;
}

function getSlotEventStyle(
  startTime: string,
  endTime: string,
  overlapIndex: number
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
    left: `${10 + overlapIndex * 6}px`,
    right: `${10 + overlapIndex * 2}px`,
    zIndex: 2 + overlapIndex,
  };
}

function normalizeBlocksForSave(blocks: AvailabilityBlock[]) {
  return days.flatMap((day) => {
    const dayBlocks = blocks
      .filter((block) => block.dayOfWeek === day.value && block.isAvailable)
      .filter((block) => block.startTime && block.endTime && block.startTime < block.endTime)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((block, index) => ({
        dayOfWeek: day.value,
        blockIndex: index,
        startTime: block.startTime,
        endTime: block.endTime,
        note: block.note,
        isAvailable: true,
      }));

    return dayBlocks;
  });
}


function getFirstString(row: AnyRow, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function getInterviewStart(row: AnyRow) {
  return getFirstString(row, [
    "start_time",
    "starts_at",
    "scheduled_at",
    "interview_at",
    "virtual_interview_at",
    "booking_start",
    "meeting_start",
    "start",
  ]);
}

function getInterviewEnd(row: AnyRow, startIso: string) {
  const explicitEnd = getFirstString(row, [
    "end_time",
    "ends_at",
    "booking_end",
    "meeting_end",
    "end",
  ]);

  if (explicitEnd) {
    return explicitEnd;
  }

  const durationRaw =
    Number(row?.duration_minutes) ||
    Number(row?.duration) ||
    Number(row?.interview_duration_minutes) ||
    30;

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return "";
  }

  start.setMinutes(start.getMinutes() + Math.max(15, durationRaw));
  return start.toISOString();
}

function getTimeFromIso(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toTimeString().slice(0, 5);
}

function getDayFromIso(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return -1;
  }

  return date.getDay();
}

function normalizeScheduledInterviews(rows: AnyRow[]): ScheduledInterview[] {
  return rows
    .map((row, index) => {
      const startIso = getInterviewStart(row);
      const endIso = getInterviewEnd(row, startIso);
      const startTime = getTimeFromIso(startIso);
      const endTime = getTimeFromIso(endIso);
      const dayOfWeek = getDayFromIso(startIso);

      if (dayOfWeek < 0 || !startTime || !endTime) {
        return null;
      }

      const candidateName =
        getFirstString(row, ["candidate_name", "name", "applicant_name"]) ||
        getFirstString(row?.candidate || {}, ["name"]) ||
        getFirstString(row?.application || {}, ["name"]) ||
        "Scheduled interview";

      const role =
        getFirstString(row, ["role", "job_title", "position_title"]) ||
        getFirstString(row?.job || {}, ["title"]) ||
        getFirstString(row?.application || {}, ["role", "job_title"]) ||
        "";

      return {
        id: String(row?.id || `${dayOfWeek}-${startTime}-${index}`),
        dayOfWeek,
        startTime,
        endTime,
        title: candidateName,
        subtitle: role || `${formatTime(startTime)} – ${formatTime(endTime)}`,
        status: getFirstString(row, ["status", "booking_status", "virtual_interview_status"]),
        meetingUrl: getFirstString(row, ["meeting_url", "virtual_interview_room_url", "room_url"]),
      };
    })
    .filter(Boolean) as ScheduledInterview[];
}


function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function observedDate(year: number, monthIndex: number, day: number) {
  const date = new Date(Date.UTC(year, monthIndex, day));
  const dayOfWeek = date.getUTCDay();

  if (dayOfWeek === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  if (dayOfWeek === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return toDateKey(date);
}

function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  weekday: number,
  occurrence: number
) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  const firstWeekday = date.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  date.setUTCDate(1 + offset + (occurrence - 1) * 7);

  return toDateKey(date);
}

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const date = new Date(Date.UTC(year, monthIndex + 1, 0));

  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return toDateKey(date);
}

function federalHolidaysForYear(year: number) {
  return [
    {
      id: `new-years-${year}`,
      date: observedDate(year, 0, 1),
      title: "New Year’s Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `mlk-${year}`,
      date: nthWeekdayOfMonth(year, 0, 1, 3),
      title: "Martin Luther King Jr. Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `washington-${year}`,
      date: nthWeekdayOfMonth(year, 1, 1, 3),
      title: "Washington’s Birthday",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `memorial-${year}`,
      date: lastWeekdayOfMonth(year, 4, 1),
      title: "Memorial Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `juneteenth-${year}`,
      date: observedDate(year, 5, 19),
      title: "Juneteenth",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `independence-${year}`,
      date: observedDate(year, 6, 4),
      title: "Independence Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `labor-${year}`,
      date: nthWeekdayOfMonth(year, 8, 1, 1),
      title: "Labor Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `columbus-${year}`,
      date: nthWeekdayOfMonth(year, 9, 1, 2),
      title: "Columbus Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `veterans-${year}`,
      date: observedDate(year, 10, 11),
      title: "Veterans Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `thanksgiving-${year}`,
      date: nthWeekdayOfMonth(year, 10, 4, 4),
      title: "Thanksgiving Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `christmas-${year}`,
      date: observedDate(year, 11, 25),
      title: "Christmas Day",
      subtitle: "Federal holiday",
      kind: "federal" as const,
    },
    {
      id: `tim-zlomke-birthday-${year}`,
      date: toDateKey(new Date(Date.UTC(year, 7, 31))),
      title: "🎂 Tim Zlomke Day",
      subtitle: "Happy Birthday",
      kind: "birthday" as const,
    },
  ];
}

function holidaysForVisibleWeek(weekStart: string): CalendarHoliday[] {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const years = new Set([start.getUTCFullYear(), end.getUTCFullYear()]);
  const startKey = weekStart;
  const endKey = toDateKey(end);

  return Array.from(years)
    .flatMap((year) => federalHolidaysForYear(year))
    .filter((holiday) => holiday.date >= startKey && holiday.date <= endKey)
    .map((holiday) => ({
      ...holiday,
      dayOfWeek: new Date(`${holiday.date}T00:00:00`).getDay(),
    }));
}

export default function AvailabilityCalendarClient({
  recruiter,
  rows,
  scheduledInterviews,
  weekStart,
  previousWeek,
  nextWeek,
  saved,
  saveWeeklyAvailability,
}: Props) {
  const [timezone, setTimezone] = useState(recruiter.timezone || "America/Chicago");
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(() =>
    buildInitialBlocks(rows)
  );
  const [selectedDay, setSelectedDay] = useState(1);
  const [isPending, startTransition] = useTransition();

  const weekEnd = addDays(weekStart, 6);

  const activeBlocks = useMemo(() => {
    return blocks
      .filter((block) => block.isAvailable && block.startTime && block.endTime)
      .sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [blocks]);

  const normalizedInterviews = useMemo(() => {
    return normalizeScheduledInterviews(scheduledInterviews);
  }, [scheduledInterviews]);

  const visibleHolidays = useMemo(() => {
    return holidaysForVisibleWeek(weekStart);
  }, [weekStart]);

  const availableDayCount = useMemo(() => {
    return days.filter((day) =>
      activeBlocks.some((block) => block.dayOfWeek === day.value)
    ).length;
  }, [activeBlocks]);

  const selectedDayBlocks = blocks
    .filter((block) => block.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  function addBlock(dayOfWeek: number) {
    setBlocks((current) => {
      const dayBlocks = current.filter((block) => block.dayOfWeek === dayOfWeek);
      const nextIndex =
        dayBlocks.length > 0
          ? Math.max(...dayBlocks.map((block) => block.blockIndex)) + 1
          : 0;

      const previous = dayBlocks[dayBlocks.length - 1];
      const startTime = previous?.endTime && previous.endTime < "18:00" ? previous.endTime : "09:00";
      const endTime = startTime < "17:00" ? "17:00" : "18:00";

      return [
        ...current,
        {
          id: `${dayOfWeek}-${Date.now()}-${nextIndex}`,
          dayOfWeek,
          blockIndex: nextIndex,
          startTime,
          endTime,
          note: "",
          isAvailable: true,
        },
      ];
    });
  }

  function removeBlock(id: string) {
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  function updateBlock(id: string, updates: Partial<AvailabilityBlock>) {
    setBlocks((current) =>
      current.map((block) => (block.id === id ? { ...block, ...updates } : block))
    );
  }

  function clearDay(dayOfWeek: number) {
    setBlocks((current) => current.filter((block) => block.dayOfWeek !== dayOfWeek));
  }

  function restoreDefaultDay(dayOfWeek: number) {
    setBlocks((current) => [
      ...current.filter((block) => block.dayOfWeek !== dayOfWeek),
      ...getDefaultBlocks(dayOfWeek),
    ]);
  }

  function handleSubmit(formData: FormData) {
    formData.set("timezone", timezone);
    formData.set(
      "availability_blocks",
      JSON.stringify(normalizeBlocksForSave(blocks))
    );

    startTransition(() => {
      void saveWeeklyAvailability(formData);
    });
  }

  return (
    <section style={wrap}>
      <div style={headerRow}>
        <div>
          <div className="eyebrow">Recruiter Availability</div>
          <h1 style={title}>{recruiter.name} — Calendar</h1>
          <p style={muted}>
            Build Outlook-style interview windows with multiple blocks per day.
            Add morning, afternoon, evening, or weekend availability without forcing
            one continuous schedule.
          </p>
        </div>

        <a href={`/recruiter/${recruiter.slug}/dashboard`} className="btn btn-secondary">
          Back to command center
        </a>
      </div>

      {saved ? (
        <div style={notice}>
          <strong>Availability saved.</strong>
          <span>This week’s schedule is ready for interview booking.</span>
        </div>
      ) : null}

      <form action={handleSubmit} style={calendarPanel}>
        <input type="hidden" name="recruiter_id" value={recruiter.id} />
        <input type="hidden" name="recruiter_slug" value={recruiter.slug} />
        <input type="hidden" name="week_start" value={weekStart} />
        <input type="hidden" name="timezone" value={timezone} />
        <input
          type="hidden"
          name="availability_blocks"
          value={JSON.stringify(normalizeBlocksForSave(blocks))}
          readOnly
        />

        <div style={calendarTopbar}>
          <div style={calendarNavigation}>
            <a
              href={`/recruiter/${recruiter.slug}/availability?week=${previousWeek}`}
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
              href={`/recruiter/${recruiter.slug}/availability?week=${nextWeek}`}
              style={calendarNavButton}
            >
              ›
            </a>
          </div>

          <div style={toolbarRight}>
            <div style={miniStat}>
              <strong>{availableDayCount}/7</strong>
              <span>days open</span>
            </div>

            <div style={miniStat}>
              <strong>{activeBlocks.length}</strong>
              <span>active blocks</span>
            </div>

            <div style={miniStat}>
              <strong>{normalizedInterviews.length}</strong>
              <span>scheduled</span>
            </div>

            <div style={miniStat}>
              <strong>{visibleHolidays.length}</strong>
              <span>holidays</span>
            </div>

            <label style={timezoneField}>
              <span style={labelStyle}>Timezone</span>
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                style={toolbarSelect}
              >
                {timezones.map((timezoneOption) => (
                  <option key={timezoneOption} value={timezoneOption}>
                    {timezoneOption}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ border: 0, cursor: "pointer", minHeight: 46 }}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save schedule"}
            </button>
          </div>
        </div>

        <div style={calendarMetaRow}>
          <div>
            <strong>Weekly interview availability</strong>
            <span>
              Click a day, add blocks, edit times, or remove windows. Candidate slots
              are generated from every active block and reduced by scheduled interviews.
            </span>
          </div>

          <div style={legend}>
            <span style={legendAvailable}>Available block</span>
            <span style={legendBooked}>Scheduled interview</span>
            <span style={legendHoliday}>Holiday</span>
            <span style={legendClosed}>No blocks</span>
          </div>
        </div>

        <div style={calendarScroll}>
          <div style={calendarGrid}>
            <div style={calendarCorner}>
              <span>Time</span>
            </div>

            {days.map((day) => {
              const date = addDays(weekStart, day.value);
              const dayBlocks = activeBlocks.filter(
                (block) => block.dayOfWeek === day.value
              );
              const dayInterviews = normalizedInterviews.filter(
                (interview) => interview.dayOfWeek === day.value
              );
              const dayHolidays = visibleHolidays.filter(
                (holiday) => holiday.dayOfWeek === day.value
              );

              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setSelectedDay(day.value)}
                  style={{
                    ...calendarDayHeader,
                    opacity: dayBlocks.length > 0 ? 1 : 0.62,
                    outline:
                      selectedDay === day.value
                        ? "2px solid rgba(96,165,250,0.72)"
                        : "none",
                  }}
                >
                  <span>{day.short}</span>
                  <strong>{formatDayNumber(date)}</strong>
                  <small>
                    {dayBlocks.length} block{dayBlocks.length === 1 ? "" : "s"}
                    {dayInterviews.length ? ` · ${dayInterviews.length} booked` : ""}
                    {dayHolidays.length ? ` · ${dayHolidays.length} holiday` : ""}
                  </small>
                </button>
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
              const date = addDays(weekStart, day.value);
              const dayBlocks = activeBlocks.filter(
                (block) => block.dayOfWeek === day.value
              );
              const dayInterviews = normalizedInterviews.filter(
                (interview) => interview.dayOfWeek === day.value
              );
              const dayHolidays = visibleHolidays.filter(
                (holiday) => holiday.dayOfWeek === day.value
              );

              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setSelectedDay(day.value)}
                  style={{
                    ...calendarDayColumn,
                    background:
                      selectedDay === day.value
                        ? "rgba(20,115,255,0.08)"
                        : dayBlocks.length
                          ? "rgba(255,255,255,0.035)"
                          : "rgba(148,163,184,0.05)",
                  }}
                >
                  {timeSlots.map((slot) => (
                    <span key={slot} style={calendarHourLine} />
                  ))}

                  {dayBlocks.length > 0 ? (
                    dayBlocks.map((block, index) => (
                      <span
                        key={block.id}
                        style={{
                          ...availabilityBlock,
                          ...getSlotEventStyle(block.startTime, block.endTime, index),
                        }}
                      >
                        <strong>Available</strong>
                        <span>
                          {formatTime(block.startTime)} – {formatTime(block.endTime)}
                        </span>
                        {block.note ? <em>{block.note}</em> : null}
                      </span>
                    ))
                  ) : (
                    <span style={closedBlock}>
                      <strong>No availability</strong>
                      <span>Click to add a block</span>
                    </span>
                  )}

                  {dayHolidays.map((holiday, index) => (
                    <span
                      key={holiday.id}
                      style={{
                        ...holidayBlock,
                        top: `${14 + index * 58}px`,
                      }}
                    >
                      <strong>{holiday.title}</strong>
                      <span>{holiday.subtitle}</span>
                    </span>
                  ))}

                  {dayInterviews.map((interview, index) => (
                    <span
                      key={interview.id}
                      style={{
                        ...scheduledInterviewBlock,
                        ...getSlotEventStyle(
                          interview.startTime,
                          interview.endTime,
                          index
                        ),
                      }}
                      title={interview.meetingUrl || interview.status || undefined}
                    >
                      <strong>{interview.title}</strong>
                      <span>
                        {formatTime(interview.startTime)} – {formatTime(interview.endTime)}
                      </span>
                      {interview.subtitle ? <em>{interview.subtitle}</em> : null}
                    </span>
                  ))}

                  <span style={dayDateLabel}>{formatDisplayDate(date)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={editorShell}>
          <div style={editorHeader}>
            <div>
              <span style={kicker}>Edit blocks</span>
              <h2 style={editorTitle}>
                {days.find((day) => day.value === selectedDay)?.label} ·{" "}
                {formatDisplayDate(addDays(weekStart, selectedDay))}
              </h2>
            </div>

            <div style={editorActions}>
              <button
                type="button"
                onClick={() => addBlock(selectedDay)}
                style={secondaryAction}
              >
                + Add block
              </button>
              <button
                type="button"
                onClick={() => restoreDefaultDay(selectedDay)}
                style={secondaryAction}
              >
                Restore default
              </button>
              <button
                type="button"
                onClick={() => clearDay(selectedDay)}
                style={dangerAction}
              >
                Clear day
              </button>
            </div>
          </div>

          {visibleHolidays.filter((holiday) => holiday.dayOfWeek === selectedDay).length > 0 ? (
            <div style={holidayList}>
              {visibleHolidays
                .filter((holiday) => holiday.dayOfWeek === selectedDay)
                .map((holiday) => (
                  <article
                    key={holiday.id}
                    style={{
                      ...holidayListItem,
                      borderColor:
                        holiday.kind === "birthday"
                          ? "rgba(244,114,182,0.4)"
                          : "rgba(96,165,250,0.26)",
                    }}
                  >
                    <strong>{holiday.title}</strong>
                    <span>{holiday.subtitle}</span>
                  </article>
                ))}
            </div>
          ) : null}

          {normalizedInterviews.filter((interview) => interview.dayOfWeek === selectedDay).length > 0 ? (
            <div style={scheduledList}>
              {normalizedInterviews
                .filter((interview) => interview.dayOfWeek === selectedDay)
                .map((interview) => (
                  <article key={interview.id} style={scheduledListItem}>
                    <div>
                      <strong>{interview.title}</strong>
                      <span>
                        {formatTime(interview.startTime)} – {formatTime(interview.endTime)}
                        {interview.subtitle ? ` · ${interview.subtitle}` : ""}
                      </span>
                    </div>
                    {interview.meetingUrl ? (
                      <a href={interview.meetingUrl} target="_blank" rel="noreferrer">
                        Join
                      </a>
                    ) : null}
                  </article>
                ))}
            </div>
          ) : null}

          {selectedDayBlocks.length > 0 ? (
            <div style={editorBlockList}>
              {selectedDayBlocks.map((block, index) => {
                const invalid =
                  Boolean(block.startTime && block.endTime) &&
                  block.startTime >= block.endTime;

                return (
                  <article key={block.id} style={editorBlock}>
                    <div style={blockNumber}>
                      <strong>{index + 1}</strong>
                    </div>

                    <label style={compactField}>
                      <span>Start</span>
                      <input
                        type="time"
                        value={block.startTime}
                        onChange={(event) =>
                          updateBlock(block.id, { startTime: event.target.value })
                        }
                        style={{
                          ...compactInput,
                          borderColor: invalid
                            ? "rgba(248,113,113,0.64)"
                            : "rgba(255,255,255,0.16)",
                        }}
                      />
                    </label>

                    <label style={compactField}>
                      <span>End</span>
                      <input
                        type="time"
                        value={block.endTime}
                        onChange={(event) =>
                          updateBlock(block.id, { endTime: event.target.value })
                        }
                        style={{
                          ...compactInput,
                          borderColor: invalid
                            ? "rgba(248,113,113,0.64)"
                            : "rgba(255,255,255,0.16)",
                        }}
                      />
                    </label>

                    <label style={compactFieldWide}>
                      <span>Note</span>
                      <input
                        value={block.note}
                        onChange={(event) =>
                          updateBlock(block.id, { note: event.target.value })
                        }
                        placeholder="Optional note"
                        style={compactInput}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removeBlock(block.id)}
                      style={removeButton}
                    >
                      Remove
                    </button>

                    {invalid ? (
                      <div style={blockWarning}>
                        End time must be later than start time.
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div style={emptyEditor}>
              <strong>No availability blocks for this day.</strong>
              <span>Add a block to open candidate scheduling for this day.</span>
              <button
                type="button"
                onClick={() => addBlock(selectedDay)}
                style={secondaryAction}
              >
                + Add first block
              </button>
            </div>
          )}
        </div>

        <div style={submitRow}>
          <div style={mutedSmall}>
            Every saved block becomes a source window for candidate-facing 15-minute
            interview slots.
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ border: 0, cursor: "pointer" }}
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save weekly availability"}
          </button>
        </div>
      </form>
    </section>
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
  appearance: "none",
  border: 0,
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  gap: 4,
  borderRight: "1px solid rgba(255,255,255,0.1)",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.04)",
  color: "#dbeafe",
  cursor: "pointer",
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
  appearance: "none",
  padding: 0,
  textAlign: "left",
  color: "inherit",
  position: "relative",
  minHeight: 792,
  border: 0,
  borderRight: "1px solid rgba(255,255,255,0.08)",
  cursor: "pointer",
};

const calendarHourLine: React.CSSProperties = {
  display: "block",
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
  display: "grid",
  alignContent: "start",
  gap: 4,
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

const editorShell: React.CSSProperties = {
  padding: 22,
  borderTop: "1px solid rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.025)",
};

const editorHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  marginBottom: 16,
};

const editorTitle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#ffffff",
  fontSize: 28,
  letterSpacing: "-0.04em",
};

const editorActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const secondaryAction: React.CSSProperties = {
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.075)",
  color: "#ffffff",
  fontWeight: 900,
  cursor: "pointer",
};

const dangerAction: React.CSSProperties = {
  ...secondaryAction,
  border: "1px solid rgba(248,113,113,0.26)",
  background: "rgba(248,113,113,0.1)",
  color: "#fecaca",
};

const editorBlockList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const editorBlock: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "52px 140px 140px minmax(220px, 1fr) 96px",
  gap: 10,
  alignItems: "end",
  padding: 12,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(3,10,20,0.32)",
};

const blockNumber: React.CSSProperties = {
  width: 40,
  height: 40,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 14,
  background: "rgba(20,115,255,0.18)",
  color: "#bfdbfe",
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
  minHeight: 40,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(7,16,31,0.78)",
  color: "#fff",
  padding: "0 10px",
  outline: "none",
};

const removeButton: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.24)",
  background: "rgba(248,113,113,0.1)",
  color: "#fecaca",
  fontWeight: 900,
  cursor: "pointer",
};

const blockWarning: React.CSSProperties = {
  gridColumn: "2 / -1",
  color: "#fecaca",
  fontSize: 13,
};

const emptyEditor: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 20,
  borderRadius: 20,
  border: "1px dashed rgba(148,163,184,0.28)",
  background: "rgba(148,163,184,0.08)",
  color: "#dbeafe",
};



const holidayBlock: React.CSSProperties = {
  position: "absolute",
  left: 10,
  right: 10,
  minHeight: 48,
  display: "grid",
  gap: 2,
  padding: 10,
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.36)",
  background:
    "linear-gradient(180deg, rgba(59,130,246,0.24), rgba(30,64,175,0.18))",
  color: "#dbeafe",
  zIndex: 9,
};

const holidayList: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const holidayListItem: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(96,165,250,0.26)",
  background: "rgba(59,130,246,0.1)",
  color: "#dbeafe",
};

const legendHoliday: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 999,
  background: "rgba(59,130,246,0.14)",
  border: "1px solid rgba(96,165,250,0.28)",
  color: "#bfdbfe",
  fontSize: 12,
  fontWeight: 900,
};

const scheduledInterviewBlock: React.CSSProperties = {
  position: "absolute",
  minHeight: 54,
  padding: 10,
  borderRadius: 14,
  border: "1px solid rgba(251,191,36,0.48)",
  background:
    "linear-gradient(180deg, rgba(251,191,36,0.98), rgba(217,119,6,0.92))",
  boxShadow: "0 16px 40px rgba(217,119,6,0.24)",
  color: "#111827",
  overflow: "hidden",
  display: "grid",
  alignContent: "start",
  gap: 3,
};

const scheduledList: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const scheduledListItem: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 16,
  border: "1px solid rgba(251,191,36,0.3)",
  background: "rgba(251,191,36,0.12)",
  color: "#fde68a",
};

const legendBooked: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: 999,
  background: "rgba(251,191,36,0.15)",
  border: "1px solid rgba(251,191,36,0.32)",
  color: "#fde68a",
  fontSize: 12,
  fontWeight: 900,
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
